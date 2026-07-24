import { useState, useRef } from "react";
import Link from "next/link";
import { Upload, Loader2, X, Sparkles, Info } from "lucide-react";

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

function resizeImage(file, maxDim, quality) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        let { width, height } = img;
        if (width > height) {
          if (width > maxDim) { height = Math.round((height * maxDim) / width); width = maxDim; }
        } else {
          if (height > maxDim) { width = Math.round((width * maxDim) / height); height = maxDim; }
        }
        const canvas = document.createElement("canvas");
        canvas.width = width; canvas.height = height;
        const ctx = canvas.getContext("2d");
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(0, 0, width, height);
        ctx.drawImage(img, 0, 0, width, height);
        const dataUrl = canvas.toDataURL("image/jpeg", quality);
        resolve({ dataUrl, base64: dataUrl.split(",")[1] });
      };
      img.onerror = () => reject(new Error("שגיאה בטעינת התמונה"));
      img.src = e.target.result;
    };
    reader.onerror = () => reject(new Error("שגיאה בקריאת הקובץ"));
    reader.readAsDataURL(file);
  });
}

const clamp = (n, min, max) => Math.min(max, Math.max(min, n));

export default function RealEditTool() {
  const [file, setFile] = useState(null); // { previewUrl, base64 }
  const [selection, setSelection] = useState(null); // { x, y, w, h } in %
  const [dragStart, setDragStart] = useState(null);
  const [instruction, setInstruction] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [resultSrc, setResultSrc] = useState(null);
  const [mode, setMode] = useState("before"); // before | after
  const imgRef = useRef(null);
  const fileInputRef = useRef(null);

  async function handleFileChange(e) {
    const f = e.target.files && e.target.files[0];
    if (!f) return;
    setError(null);
    setResultSrc(null);
    setSelection(null);
    try {
      const { dataUrl, base64 } = await resizeImage(f, 1024, 0.85);
      setFile({ previewUrl: dataUrl, base64 });
    } catch (err) {
      setError("לא הצלחתי לטעון את התמונה. נסי קובץ אחר.");
    }
  }

  function pointFromEvent(e) {
    const rect = imgRef.current.getBoundingClientRect();
    const x = clamp(((e.clientX - rect.left) / rect.width) * 100, 0, 100);
    const y = clamp(((e.clientY - rect.top) / rect.height) * 100, 0, 100);
    return { x, y };
  }

  function onPointerDown(e) {
    e.target.setPointerCapture && e.target.setPointerCapture(e.pointerId);
    const p = pointFromEvent(e);
    setDragStart(p);
    setSelection({ x: p.x, y: p.y, w: 0, h: 0 });
    setResultSrc(null);
    setMode("before");
  }
  function onPointerMove(e) {
    if (!dragStart) return;
    const p = pointFromEvent(e);
    const x = Math.min(dragStart.x, p.x), y = Math.min(dragStart.y, p.y);
    const w = Math.abs(p.x - dragStart.x), h = Math.abs(p.y - dragStart.y);
    setSelection({ x, y, w, h });
  }
  function onPointerUp() {
    setDragStart(null);
  }

  async function generate() {
    if (!file || !selection || selection.w < 2 || selection.h < 2 || !instruction.trim()) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/edit-image", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ imageBase64: file.base64, box: selection, instruction: instruction.trim() }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || ("שגיאת שרת (" + res.status + ")"));
      setResultSrc(`data:image/png;base64,${data.imageBase64}`);
      setMode("after");
    } catch (err) {
      setError((err && err.message) || "שגיאה לא ידועה");
    } finally {
      setLoading(false);
    }
  }

  const hasSelection = selection && selection.w > 2 && selection.h > 2;

  return (
    <div dir="rtl" style={{ fontFamily: "sans-serif", background: C.paper, minHeight: "100vh", color: C.ink }}>
      <div style={{ maxWidth: 560, margin: "0 auto", padding: "24px 18px 60px" }}>
        <nav style={{ display: "flex", gap: 14, marginBottom: 18, fontSize: 13 }}>
          <span style={{ color: C.ink, fontWeight: 700 }}>עריכת אזור</span>
          <span style={{ color: C.grid }}>|</span>
          <Link href="/references" style={{ color: C.inkFaint, textDecoration: "none" }}>מאגר רפרנסים</Link>
        </nav>

        <h1 style={{ fontSize: 22, margin: "0 0 4px" }}>עריכת אזור אמיתית ברישום</h1>
        <p style={{ fontSize: 13, color: C.inkFaint, margin: "0 0 20px" }}>
          מעלים תמונה, מסמנים עם העכבר את האזור, כותבים מה לשנות (למשל מהמשוב שקיבלת מ-Claude בחינם), ולוחצים צרי עריכה.
          כל לחיצה על "צרי עריכה" היא בקשה אמיתית בתשלום קטן ל-OpenAI - שום דבר אחר בעמוד הזה לא עולה כסף.
        </p>

        {!file && (
          <button
            onClick={() => fileInputRef.current && fileInputRef.current.click()}
            style={{ width: "100%", border: `2px dashed ${C.grid}`, borderRadius: 14, background: C.paperDark, padding: "38px 18px", display: "flex", flexDirection: "column", alignItems: "center", gap: 10 }}
          >
            <Upload size={26} color={C.inkFaint} />
            <div style={{ fontWeight: 600, fontSize: 14.5 }}>לחצי כאן להעלאת תמונה</div>
          </button>
        )}
        <input ref={fileInputRef} type="file" accept="image/*" onChange={handleFileChange} style={{ display: "none" }} />

        {file && (
          <div>
            <div style={{ position: "relative", borderRadius: 12, overflow: "hidden", border: `1px solid ${C.grid}`, marginBottom: 10, background: "#fff", userSelect: "none" }}>
              <img
                ref={imgRef}
                src={mode === "after" && resultSrc ? resultSrc : file.previewUrl}
                alt="הרישום שלך"
                onPointerDown={mode === "before" ? onPointerDown : undefined}
                onPointerMove={mode === "before" ? onPointerMove : undefined}
                onPointerUp={mode === "before" ? onPointerUp : undefined}
                style={{ width: "100%", display: "block", cursor: mode === "before" ? "crosshair" : "default", touchAction: "none" }}
              />
              {mode === "before" && selection && (
                <div
                  style={{
                    position: "absolute", left: `${selection.x}%`, top: `${selection.y}%`,
                    width: `${selection.w}%`, height: `${selection.h}%`,
                    border: `2px solid ${C.red}`, background: "rgba(166,61,47,0.12)", pointerEvents: "none",
                  }}
                />
              )}
              <button
                onClick={() => { setFile(null); setSelection(null); setResultSrc(null); setMode("before"); }}
                style={{ position: "absolute", top: 8, left: 8, background: "rgba(43,42,38,0.75)", border: "none", borderRadius: "50%", width: 30, height: 30, display: "flex", alignItems: "center", justifyContent: "center" }}
              >
                <X size={16} color="#fff" />
              </button>
            </div>

            {resultSrc && (
              <div style={{ display: "flex", gap: 6, marginBottom: 10 }}>
                <button onClick={() => setMode("before")} style={toggleStyle(mode === "before")}>לפני</button>
                <button onClick={() => setMode("after")} style={toggleStyle(mode === "after")}>אחרי (תוצאה אמיתית)</button>
              </div>
            )}

            {!hasSelection && (
              <div style={{ fontSize: 12.5, color: C.inkFaint, marginBottom: 10, display: "flex", gap: 6 }}>
                <Info size={14} style={{ flexShrink: 0, marginTop: 1 }} />
                גררי עם העכבר על התמונה כדי לסמן את האזור לעריכה.
              </div>
            )}

            <textarea
              placeholder="מה לשנות באזור המסומן? (למשל: להעמיק את הצל בצד השמאלי של הכוס)"
              value={instruction}
              onChange={(e) => setInstruction(e.target.value)}
              rows={2}
              style={{ width: "100%", resize: "none", borderRadius: 10, border: `1px solid ${C.grid}`, padding: "10px 12px", fontSize: 13.5, background: "#fff", marginBottom: 12 }}
            />

            <button
              onClick={generate}
              disabled={loading || !hasSelection || !instruction.trim()}
              style={{
                width: "100%", padding: "13px 16px", borderRadius: 10, border: "none",
                background: loading || !hasSelection || !instruction.trim() ? C.inkFaint : C.blue,
                color: "#fff", fontWeight: 700, fontSize: 14.5,
                display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
              }}
            >
              {loading ? (<><Loader2 size={17} style={{ animation: "spin 1s linear infinite" }} /> יוצר עריכה...</>) : (<><Sparkles size={16} /> צרי עריכה אמיתית</>)}
            </button>
            <style>{`@keyframes spin { from { transform: rotate(0); } to { transform: rotate(360deg); } }`}</style>
          </div>
        )}

        {error && (
          <div style={{ marginTop: 12, padding: "10px 12px", background: "#F3DFDA", color: C.red, borderRadius: 9, fontSize: 13 }}>
            {error}
          </div>
        )}
      </div>
    </div>
  );
}

function toggleStyle(active) {
  return {
    flex: 1, padding: "8px 10px", borderRadius: 8, fontSize: 12.5, fontWeight: 700,
    border: `1px solid ${active ? C.ink : C.grid}`, background: active ? C.ink : "#fff",
    color: active ? "#fff" : C.inkSoft,
  };
}
