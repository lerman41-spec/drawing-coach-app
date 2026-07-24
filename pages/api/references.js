// No API key needed - both Met Museum and Wikimedia Commons are free, open,
// key-less APIs. We proxy through our own server anyway (not directly from
// the browser) just to avoid any CORS surprises and to merge two sources
// into one clean response.

export default async function handler(req, res) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }
  const q = (req.query.q || "").toString().trim();
  if (!q) {
    return res.status(400).json({ error: "נא להזין מונח חיפוש" });
  }

  try {
    const [metResults, commonsResults] = await Promise.all([
      searchMet(q).catch(() => []),
      searchCommons(q).catch(() => []),
    ]);
    const results = interleave(metResults, commonsResults).slice(0, 24);
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

async function searchCommons(q) {
  const url =
    "https://commons.wikimedia.org/w/api.php?action=query&generator=search&gsrnamespace=6&gsrlimit=10&prop=imageinfo&iiprop=url%7Cextmetadata&iiurlwidth=400&format=json&origin=*&gsrsearch=" +
    encodeURIComponent("filetype:bitmap " + q);
  const r = await fetch(url);
  const d = await r.json();
  const pages = (d.query && d.query.pages) || {};
  const items = Object.values(pages)
    .map((p) => {
      const info = p.imageinfo && p.imageinfo[0];
      if (!info) return null;
      const meta = info.extmetadata || {};
      return {
        id: `commons-${p.pageid}`,
        source: "commons",
        sourceLabel: "Wikimedia Commons",
        title: (meta.ObjectName && meta.ObjectName.value) || String(p.title || "").replace(/^File:/, ""),
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

function stripHtml(s) {
  return String(s).replace(/<[^>]*>/g, "").trim();
}

function interleave(a, b) {
  const out = [];
  const max = Math.max(a.length, b.length);
  for (let i = 0; i < max; i++) {
    if (a[i]) out.push(a[i]);
    if (b[i]) out.push(b[i]);
  }
  return out;
}
