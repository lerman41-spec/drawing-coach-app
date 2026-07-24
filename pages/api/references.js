// Met Museum + Wikimedia Commons are free, key-less, open-license APIs.
// Unsplash needs one free key (UNSPLASH_ACCESS_KEY) but gives much more
// relevant photographic reference results (poses, hands, animals, nature).
// All three calls happen server-side so no key is ever exposed to the browser.

export default async function handler(req, res) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }
  const q = (req.query.q || "").toString().trim();
  if (!q) {
    return res.status(400).json({ error: "נא להזין מונח חיפוש" });
  }

  try {
    const [metResults, commonsResults, unsplashResults] = await Promise.all([
      searchMet(q).catch(() => []),
      searchCommons(q).catch(() => []),
      searchUnsplash(q).catch(() => []),
    ]);
    const results = interleave([unsplashResults, metResults, commonsResults]).slice(0, 30);
    return res.status(200).json({ results });
  } catch (err) {
    return res.status(500).json({ error: (err && err.message) || "שגיאה בחיפוש רפרנסים" });
  }
}

async function searchMet(q) {
  const searchRes = await fetch(
    `https://collectionapi.metmuseum.org/public/collection/v1/search?q=${encodeURIComponent(q)}&hasImages=true`
  );
  const searchData = await searchRes.json();
  const ids = (searchData.objectIDs || []).slice(0, 10);
  const objects = await Promise.all(
    ids.map(async (id) => {
      try {
        const r = await fetch(`https://collectionapi.metmuseum.org/public/collection/v1/objects/${id}`);
        const d = await r.json();
        if (!d.primaryImageSmall) return null;
        return {
          id: `met-${id}`,
          source: "met",
          sourceLabel: "The Met",
          title: d.title || "ללא כותרת",
          artist: d.artistDisplayName || "",
          imageUrl: d.primaryImage || d.primaryImageSmall,
          thumbUrl: d.primaryImageSmall,
          sourceUrl: d.objectURL,
          license: "CC0 / נחלת הכלל",
        };
      } catch (e) {
        return null;
      }
    })
  );
  return objects.filter(Boolean);
}

// Junk filters: Commons full-text search often surfaces icons, logos, flags,
// maps and coats of arms for common search terms - these are useless as
// drawing references, so we filter them out by title keywords and by
// rejecting very small images (icons/logos tend to be tiny).
const JUNK_TITLE_PATTERN = /(icon|logo|flag of|coat of arms|map of|emblem|seal of|symbol|favicon|button)/i;

async function searchCommons(q) {
  const url =
    "https://commons.wikimedia.org/w/api.php?action=query&generator=search&gsrnamespace=6&gsrlimit=15&prop=imageinfo&iiprop=url%7Cextmetadata%7Csize&iiurlwidth=400&format=json&origin=*&gsrsearch=" +
    encodeURIComponent("filetype:bitmap " + q);
  const r = await fetch(url);
  const d = await r.json();
  const pages = (d.query && d.query.pages) || {};
  const items = Object.values(pages)
    .map((p) => {
      const info = p.imageinfo && p.imageinfo[0];
      if (!info) return null;
      const title = String(p.title || "").replace(/^File:/, "");
      if (JUNK_TITLE_PATTERN.test(title)) return null;
      if ((info.width && info.width < 250) || (info.height && info.height < 250)) return null;
      const meta = info.extmetadata || {};
      return {
        id: `commons-${p.pageid}`,
        source: "commons",
        sourceLabel: "Wikimedia Commons",
        title: (meta.ObjectName && meta.ObjectName.value) || title,
        artist: (meta.Artist && stripHtml(meta.Artist.value)) || "",
        imageUrl: info.url,
        thumbUrl: info.thumburl || info.url,
        sourceUrl: info.descriptionurl,
        license: (meta.LicenseShortName && meta.LicenseShortName.value) || "בדקי רישיון במקור",
      };
    })
    .filter(Boolean);
  return items;
}

async function searchUnsplash(q) {
  if (!process.env.UNSPLASH_ACCESS_KEY) return []; // silently skip if not configured yet
  const r = await fetch(
    `https://api.unsplash.com/search/photos?query=${encodeURIComponent(q)}&per_page=12&content_filter=high`,
    { headers: { Authorization: `Client-ID ${process.env.UNSPLASH_ACCESS_KEY}` } }
  );
  if (!r.ok) return [];
  const d = await r.json();
  const items = (d.results || []).map((p) => ({
    id: `unsplash-${p.id}`,
    source: "unsplash",
    sourceLabel: "Unsplash",
    title: p.alt_description || p.description || "תמונת רפרנס",
    artist: (p.user && p.user.name) || "",
    imageUrl: p.urls && (p.urls.regular || p.urls.small),
    thumbUrl: p.urls && (p.urls.small || p.urls.thumb),
    sourceUrl: (p.links && p.links.html) || "",
    license: "Unsplash License (חינם, עם קרדיט)",
  }));
  return items.filter((i) => i.imageUrl);
}

function stripHtml(s) {
  return String(s).replace(/<[^>]*>/g, "").trim();
}

// Round-robin merge across any number of source arrays.
function interleave(lists) {
  const out = [];
  const max = Math.max(0, ...lists.map((l) => l.length));
  for (let i = 0; i < max; i++) {
    for (const list of lists) {
      if (list[i]) out.push(list[i]);
    }
  }
  return out;
}
