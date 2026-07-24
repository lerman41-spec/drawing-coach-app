import { useState, useEffect } from "react";
import Link from "next/link";
import { Search, Loader2, Heart, ExternalLink, ImageOff } from "lucide-react";

const C = {
  paper: "#F3EEE1",
  paperDark: "#E8DFC8",
  paperDarker: "#DCD0AF",
  ink: "#2B2A26",
  inkSoft: "#5B564C",
  inkFaint: "#8B8375",
  red: "#A63D2F",
  blue: "#3C4A5E",
  grid: "#C9BFA0",
};

const SUGGESTIONS = ["ידיים", "דיוקנאות", "בעלי חיים", "טבע דומם", "אנטומיה", "נוף", "דמויות בתנועה"];

export default function ReferenceLibrary() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [view, setView] = useState("search"); // search | board
  const [saved, setSaved] = useState([]);
  const [searched, setSearched] = useState(false);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem("savedRefs");
      if (raw) setSaved(JSON.parse(raw));
    } catch (e) {}
  }, []);

  function persistSaved(next) {
    setSaved(next);
    try { window.localStorage.setItem("savedRefs", JSON.stringify(next)); } catch (e) {}
  }

  function isSaved(item) {
    return saved.some((s) => s.id === item.id);
  }

  function toggleSave(item) {
    if (isSaved(item)) persistSaved(saved.filter((s) => s.id !== item.id));
    else persistSaved([item, ...saved]);
  }

  async function doSearch(term) {
    const q = (term != null ? term : query).trim();
    if (!q) return;
    setQuery(q);
    setLoading(true);
    setError(null);
    setSearched(true);
    try {
      const res = await fetch(`/api/references?q=${encodeURIComponent(q)}`);
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || ("שגיאת שרת (" + res.status + ")"));
      setResults(data.results || []);
    } catch (err) {
      setError((err && err.message) || "שגיאה לא ידועה בחיפוש");
      setResults([]);
    } finally {
      setLoading(false);
    }
  }

  const shown = view === "board" ? saved : results;

  return (
    <div dir="rtl" style={{ fontFamily: "sans-serif", background: C.paper, minHeight: "100vh", color: C.ink }}>
      <div style={{ maxWidth: 720, margin: "0 auto", padding: "20px 18px 60px" }}>
        <nav style={{ display: "flex", gap: 14, marginBottom: 18, fontSize: 13 }}>
          <Link href="/" style={{ color: C.inkFaint, textDecoration: "none" }}>עריכת אזור</Link>
          <span style={{ color: C.grid }}>|</span>
          <span style={{ color: C.ink, fontWeight: 700 }}>מאגר רפרנסים</span>
        </nav>

        <h1 style={{ fontSize: 22, margin: "0 0 4px" }}>מאגר רפרנסים לרישום</h1>
        <p style={{ fontSize: 13, color: C.inkFaint, margin: "0 0 18px" }}>
          חיפוש חי בשתי ספריות פתוחות וחוקיות לחלוטין - The Metropolitan Museum of Art ו-Wikimedia Commons
          (יצירות בנחלת הכלל / רישיון פתוח). אין כאן שום תוכן מוגן בזכויות יוצרים.
        </p>

        <form
          onSubmit={(e) => { e.preventDefault(); doSearch(); }}
          style={{ display: "flex", gap: 8, marginBottom: 10 }}
        >
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="לדוגמה: ידיים, סוסים, אור וצל..."
            style={{ flex: 1, padding: "11px 14px", borderRadius: 10, border: `1px solid ${C.grid}`, fontSize: 14, background: "#fff" }}
          />
          <button
            type="submit"
            disabled={loading}
            style={{ padding: "11px 18px", borderRadius: 10, border: "none", background: C.blue, color: "#fff", fontWeight: 700, display: "flex", alignItems: "center", gap: 6 }}
          >
            {loading ? <Loader2 size={16} style={{ animation: "spin 1s linear infinite" }} /> : <Search size={16} />}
            חפשי
          </button>
        </form>

        <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 18 }}>
          {SUGGESTIONS.map((s) => (
            <button
              key={s}
              onClick={() => doSearch(s)}
              style={{ fontSize: 12, padding: "5px 12px", borderRadius: 20, border: `1px solid ${C.grid}`, background: "#fff", color: C.inkSoft }}
            >
              {s}
            </button>
          ))}
        </div>

        <div style={{ display: "flex", gap: 6, marginBottom: 16, background: C.paperDark, padding: 4, borderRadius: 10, width: "fit-content" }}>
          {[
            { key: "search", label: "תוצאות חיפוש" },
            { key: "board", label: `הלוח שלי (${saved.length})` },
          ].map((t) => (
            <button
              key={t.key}
              onClick={() => setView(t.key)}
              style={{
                padding: "7px 14px", borderRadius: 7, border: "none", fontSize: 12.5, fontWeight: 600,
                background: view === t.key ? C.ink : "transparent", color: view === t.key ? "#fff" : C.inkSoft,
              }}
            >
              {t.label}
            </button>
          ))}
        </div>

        {error && (
          <div style={{ padding: "10px 12px", background: "#F3DFDA", color: C.red, borderRadius: 9, fontSize: 13, marginBottom: 14 }}>
            {error}
          </div>
        )}

        {view === "search" && !loading && searched && results.length === 0 && !error && (
          <div style={{ textAlign: "center", padding: 40, color: C.inkFaint }}>
            <ImageOff size={26} style={{ marginBottom: 8, opacity: 0.5 }} />
            <div>לא נמצאו תוצאות. נסי מונח אחר.</div>
          </div>
        )}

        {view === "board" && saved.length === 0 && (
          <div style={{ textAlign: "center", padding: 40, color: C.inkFaint }}>
            <Heart size={26} style={{ marginBottom: 8, opacity: 0.5 }} />
            <div>עוד לא שמרת רפרנסים ללוח - לחצי על הלב בתמונות שאת אוהבת.</div>
          </div>
        )}

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(150px, 1fr))", gap: 12 }}>
          {shown.map((item) => (
            <div key={item.id} style={{ background: "#fff", border: `1px solid ${C.grid}`, borderRadius: 12, overflow: "hidden" }}>
              <div style={{ position: "relative", aspectRatio: "1 / 1", background: C.paperDark }}>
                <img
                  src={item.thumbUrl}
                  alt={item.title}
                  loading="lazy"
                  style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
                />
                <button
                  onClick={() => toggleSave(item)}
                  style={{
                    position: "absolute", top: 6, left: 6, width: 28, height: 28, borderRadius: "50%",
                    border: "none", background: "rgba(255,255,255,0.9)",
                    display: "flex", alignItems: "center", justifyContent: "center",
                  }}
                >
                  <Heart size={14} color={isSaved(item) ? C.red : C.inkFaint} fill={isSaved(item) ? C.red : "none"} />
                </button>
              </div>
              <div style={{ padding: "8px 10px" }}>
                <div style={{ fontSize: 12, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{item.title}</div>
                {item.artist && <div style={{ fontSize: 11, color: C.inkFaint, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{item.artist}</div>}
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 5 }}>
                  <span style={{ fontSize: 9.5, color: C.inkFaint }}>{item.sourceLabel} · {item.license}</span>
                  <a href={item.sourceUrl} target="_blank" rel="noreferrer" style={{ color: C.blue }}>
                    <ExternalLink size={12} />
                  </a>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
      <style>{`@keyframes spin { from { transform: rotate(0); } to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
