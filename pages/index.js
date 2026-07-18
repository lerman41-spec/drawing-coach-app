import React, { useState, useEffect, useRef } from "react";
import {
  Pencil, Upload, Loader2, TrendingUp, BookOpen, X, RotateCcw,
  Info, ChevronLeft, ImageOff, Sparkles
} from "lucide-react";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer
} from "recharts";

/* ---------------------------------------------------------------
   PALETTE & TOKENS
--------------------------------------------------------------- */
const C = {
  paper: "#F3EEE1",
  paperDark: "#E8DFC8",
  paperDarker: "#DCD0AF",
  ink: "#2B2A26",
  inkSoft: "#5B564C",
  inkFaint: "#8B8375",
  red: "#A63D2F",
  redSoft: "#C97463",
  blue: "#3C4A5E",
  blueSoft: "#6E7F92",
  grid: "#C9BFA0",
};

const CAT_COLOR = {
  line: "#A63D2F",
  proportion: "#3C4A5E",
  values: "#8A6A2F",
  perspective: "#4C6B4E",
  composition: "#7A4568",
  texture: "#4B4B46",
};

const CATS = [
  { key: "line", label: "איכות הקו" },
  { key: "proportion", label: "פרופורציה" },
  { key: "values", label: "גווני אור-צל" },
  { key: "perspective", label: "פרספקטיבה" },
  { key: "composition", label: "קומפוזיציה" },
  { key: "texture", label: "מרקם וטקסטורה" },
];
const CAT_LABEL = Object.fromEntries(CATS.map((c) => [c.key, c.label]));

/* ---------------------------------------------------------------
   SMALL UI PRIMITIVES
--------------------------------------------------------------- */

function WobbleCircle({ size = 46, color = C.red, strokeWidth = 2.5 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 54 54" style={{ position: "absolute", inset: 0 }}>
      <path
        d="M27,4 C39,2 50,9 50,23 C50,37 42,49 27,50 C12,51 3,39 3,25 C3,11 14,5 27,4 Z"
        fill="none"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
      />
    </svg>
  );
}

function ScoreBadge({ value, size = 46 }) {
  return (
    <div style={{ position: "relative", width: size, height: size, flexShrink: 0 }}>
      <WobbleCircle size={size} />
      <div
        style={{
          position: "absolute",
          inset: 0,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontFamily: "'Space Mono', monospace",
          fontWeight: 700,
          fontSize: size > 40 ? 16 : 13,
          color: C.red,
        }}
      >
        {value}
      </div>
    </div>
  );
}

function Underline({ width = 90, color = C.red }) {
  return (
    <svg width={width} height="8" viewBox={`0 0 ${width} 8`} style={{ display: "block", marginTop: -3 }}>
      <path
        d={`M2,4 C${width * 0.3},1 ${width * 0.6},7 ${width - 2},3`}
        fill="none"
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  );
}

function clampBoxForDisplay(box) {
  const b = box || {};
  let x = Math.min(95, Math.max(0, Number(b.x) || 0));
  let y = Math.min(95, Math.max(0, Number(b.y) || 0));
  let w = Math.min(100 - x, Math.max(5, Number(b.w) || 60));
  let h = Math.min(100 - y, Math.max(5, Number(b.h) || 60));
  return { x, y, w, h };
}

// Full drawing with a "spotlight" rectangle over the region a tip refers to
function MarkedImage({ src, box }) {
  const { x, y, w, h } = clampBoxForDisplay(box);
  return (
    <div style={{ position: "relative", width: "100%", borderRadius: 12, overflow: "hidden", border: `1px solid ${C.grid}`, background: "#fff" }}>
      <img src={src} alt="הרישום שלך" style={{ width: "100%", display: "block" }} />
      <div
        style={{
          position: "absolute", left: `${x}%`, top: `${y}%`, width: `${w}%`, height: `${h}%`,
          border: `2.5px solid ${C.red}`, borderRadius: 8,
          boxShadow: "0 0 0 2000px rgba(43,42,38,0.34)",
          pointerEvents: "none",
        }}
      />
    </div>
  );
}

// Zoomed-in crop of just the relevant region, using pure percentage background-size math
// so no image-dimension measurement is needed and it stays responsive.
function CropView({ src, box }) {
  const { x, y, w, h } = clampBoxForDisplay(box);
  const bgSizeX = 10000 / w;
  const bgSizeY = 10000 / h;
  const denomX = 100 - w;
  const denomY = 100 - h;
  const bgPosX = denomX <= 0 ? 0 : Math.min(100, Math.max(0, (x / denomX) * 100));
  const bgPosY = denomY <= 0 ? 0 : Math.min(100, Math.max(0, (y / denomY) * 100));
  return (
    <div
      style={{
        width: "100%", aspectRatio: `${w} / ${h}`, borderRadius: 12, overflow: "hidden",
        border: `1px solid ${C.grid}`, background: `#fff url(${src}) no-repeat`,
        backgroundSize: `${bgSizeX}% ${bgSizeY}%`, backgroundPosition: `${bgPosX}% ${bgPosY}%`,
      }}
    />
  );
}

function useImageEl(src) {
  const [img, setImg] = useState(null);
  useEffect(() => {
    if (!src) { setImg(null); return; }
    let cancelled = false;
    const el = new Image();
    el.onload = () => { if (!cancelled) setImg(el); };
    el.src = src;
    return () => { cancelled = true; };
  }, [src]);
  return img;
}

function toggleBtnStyle(active) {
  return {
    flex: 1, padding: "7px 10px", borderRadius: 8, fontSize: 12, fontWeight: 700,
    border: `1px solid ${active ? C.ink : C.grid}`, background: active ? C.ink : "#fff",
    color: active ? "#fff" : C.inkSoft,
  };
}

function buildDirectionalGradient(ctx, W, H, direction) {
  let x0 = 0, y0 = 0, x1 = 0, y1 = 0;
  if (direction === "bottom") { x0 = 0; y0 = 0; x1 = 0; y1 = H; }
  else if (direction === "top") { x0 = 0; y0 = H; x1 = 0; y1 = 0; }
  else if (direction === "right") { x0 = 0; y0 = 0; x1 = W; y1 = 0; }
  else if (direction === "left") { x0 = W; y0 = 0; x1 = 0; y1 = 0; }
  else { x0 = 0; y0 = 0; x1 = W; y1 = H; }
  const g = ctx.createLinearGradient(x0, y0, x1, y1);
  g.addColorStop(0, "rgba(20,16,8,0)");
  g.addColorStop(1, "rgba(20,16,8,1)");
  return g;
}

// Real before/after: crops the exact same region of the user's actual photo and
// applies a genuine canvas filter (brightness/contrast/blur) to simulate the tonal change -
// this is a real pixel transformation of their own drawing, not an AI-generated image.
function BeforeAfterCrop({ src, box, demo, rawImageBase64, instruction }) {
  const { x, y, w, h } = clampBoxForDisplay(box);
  const [mode, setMode] = useState("before");
  const img = useImageEl(src);
  const canvasRef = useRef(null);
  const simulatable = !!(demo && demo.simulatable);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState(null);
  const [aiSrc, setAiSrc] = useState(null);

  useEffect(() => {
    if (mode !== "after" || !img || !canvasRef.current) return;
    const NW = img.naturalWidth, NH = img.naturalHeight;
    const sx = (x / 100) * NW, sy = (y / 100) * NH, sw = (w / 100) * NW, sh = (h / 100) * NH;
    const canvas = canvasRef.current;
    const outW = 480, outH = Math.max(1, Math.round(outW * (sh / sw)));
    canvas.width = outW; canvas.height = outH;
    const ctx = canvas.getContext("2d");
    const intensity = demo.intensity;
    let filter = "none";
    if (demo.effect === "darken") filter = `brightness(${100 - intensity * 0.45}%) saturate(92%)`;
    else if (demo.effect === "lighten") filter = `brightness(${100 + intensity * 0.45}%)`;
    else if (demo.effect === "contrast") filter = `contrast(${100 + intensity}%) brightness(${100 - intensity * 0.12}%)`;
    else if (demo.effect === "soften") filter = `blur(${0.3 + intensity / 130}px) saturate(90%)`;
    ctx.filter = filter;
    ctx.drawImage(img, sx, sy, sw, sh, 0, 0, outW, outH);
    ctx.filter = "none";
    if ((demo.effect === "darken" || demo.effect === "contrast") && demo.direction !== "center") {
      ctx.fillStyle = buildDirectionalGradient(ctx, outW, outH, demo.direction);
      ctx.globalAlpha = Math.min(0.4, intensity / 180);
      ctx.fillRect(0, 0, outW, outH);
      ctx.globalAlpha = 1;
    }
  }, [mode, img, x, y, w, h, demo]);

  async function generateAiEdit() {
    setAiLoading(true);
    setAiError(null);
    try {
      const res = await fetch("/api/edit-image", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ imageBase64: rawImageBase64, box, instruction }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || ("שגיאת שרת (" + res.status + ")"));
      setAiSrc(`data:image/png;base64,${data.imageBase64}`);
      setMode("ai");
    } catch (err) {
      setAiError((err && err.message) || "שגיאה לא ידועה");
    } finally {
      setAiLoading(false);
    }
  }

  return (
    <div>
      {simulatable && (
        <div style={{ display: "flex", gap: 6, marginBottom: 8, flexWrap: "wrap" }}>
          <button onClick={() => setMode("before")} style={toggleBtnStyle(mode === "before")}>לפני</button>
          <button onClick={() => setMode("after")} style={toggleBtnStyle(mode === "after")}>אחרי (הדמיה מהירה)</button>
          {rawImageBase64 && (
            <button
              onClick={aiSrc ? () => setMode("ai") : generateAiEdit}
              disabled={aiLoading}
              style={{ ...toggleBtnStyle(mode === "ai"), background: mode === "ai" ? C.red : "#fff", borderColor: aiLoading ? C.grid : C.red, color: mode === "ai" ? "#fff" : C.red }}
            >
              {aiLoading ? "יוצר עריכה..." : aiSrc ? "עריכה אמיתית (AI)" : "צרי עריכה אמיתית (AI)"}
            </button>
          )}
        </div>
      )}
      {mode === "ai" && aiSrc ? (
        <img src={aiSrc} alt="עריכה אמיתית" style={{ width: "100%", height: "auto", display: "block", borderRadius: 12, border: `1px solid ${C.grid}` }} />
      ) : mode === "after" && simulatable ? (
        <canvas ref={canvasRef} style={{ width: "100%", height: "auto", display: "block", borderRadius: 12, border: `1px solid ${C.grid}` }} />
      ) : (
        <CropView src={src} box={box} />
      )}
      {aiError && (
        <div style={{ fontSize: 11.5, color: C.red, marginTop: 7 }}>{aiError}</div>
      )}
      {simulatable && rawImageBase64 && (
        <div style={{ fontSize: 11, color: C.inkFaint, marginTop: 7 }}>
          "עריכה אמיתית" שולחת בקשה אמיתית ל-OpenAI ועולה כסף קטן בכל לחיצה.
        </div>
      )}
      {!simulatable && (
        <div style={{ fontSize: 11.5, color: C.inkFaint, marginTop: 7, display: "flex", gap: 5, alignItems: "flex-start" }}>
          <Info size={12} style={{ marginTop: 1, flexShrink: 0 }} />
          זה שינוי מבני (מיקום/צורה/פרופורציה) - ה"הדמיה המהירה" לא רלוונטית עבורו, אבל אפשר עדיין לנסות עריכה אמיתית עם AI אם היא זמינה למעלה.
        </div>
      )}
    </div>
  );
}

function TipDemoModal({ entry, tip, onClose, onOpenGuide }) {
  if (!entry || !tip) return null;
  const guide = GUIDES[tip.category] || GUIDES.values;
  const Svg = guide.Svg;
  return (
    <div
      onClick={onClose}
      style={{ position: "fixed", inset: 0, background: "rgba(43,42,38,0.55)", zIndex: 60, display: "flex", alignItems: "flex-end", justifyContent: "center" }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        dir="rtl"
        style={{
          background: C.paper, width: "100%", maxWidth: 640, maxHeight: "90vh", overflowY: "auto",
          borderRadius: "18px 18px 0 0", padding: "16px 18px 30px", fontFamily: "'Heebo', sans-serif",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 10 }}>
          <div>
            <div style={{ fontSize: 10.5, fontWeight: 700, color: CAT_COLOR[tip.category], background: C.paperDark, display: "inline-block", padding: "2px 9px", borderRadius: 20, marginBottom: 6 }}>
              {CAT_LABEL[tip.category] || tip.category}
            </div>
            <h3 style={{ fontFamily: "'Frank Ruhl Libre', serif", fontSize: 19, margin: 0 }}>{tip.title}</h3>
          </div>
          <button onClick={onClose} style={{ background: C.paperDark, border: "none", borderRadius: "50%", width: 30, height: 30, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
            <X size={15} />
          </button>
        </div>

        <p style={{ fontSize: 13.5, lineHeight: 1.6, color: C.inkSoft, margin: "0 0 14px" }}>{tip.explanation}</p>

        <div style={{ fontSize: 11.5, fontWeight: 700, color: C.inkFaint, marginBottom: 6 }}>המיקום בציור שלך</div>
        <div style={{ marginBottom: 12 }}>
          <MarkedImage src={entry.thumbnail} box={tip.location} />
        </div>

        <div style={{ fontSize: 11.5, fontWeight: 700, color: C.inkFaint, marginBottom: 6 }}>תקריב על האזור - הדמיה אמיתית על התמונה שלך</div>
        <div style={{ marginBottom: 16 }}>
          <BeforeAfterCrop
            src={entry.thumbnail}
            box={tip.location}
            demo={tip.demo}
            rawImageBase64={entry.rawImageBase64}
            instruction={`${tip.title}. ${tip.explanation}`}
          />
        </div>

        <div style={{ height: 1, background: `repeating-linear-gradient(to left, ${C.grid} 0 6px, transparent 6px 10px)`, margin: "4px 0 16px" }} />

        <div style={{ fontSize: 11.5, fontWeight: 700, color: C.inkFaint, marginBottom: 8 }}>
          כך העיקרון נראה מודגם (איור כללי)
        </div>
        <div style={{ background: "#fff", border: `1px solid ${C.grid}`, borderRadius: 12, padding: 12, marginBottom: 12 }}>
          <Svg />
        </div>
        <div style={{ background: C.paperDark, borderRadius: 12, padding: "11px 13px", display: "flex", gap: 9, marginBottom: 14 }}>
          <Pencil size={15} style={{ flexShrink: 0, marginTop: 2, color: C.red }} />
          <p style={{ fontSize: 12.5, margin: 0, lineHeight: 1.5 }}>{guide.practice}</p>
        </div>

        <button
          onClick={() => onOpenGuide(tip.category)}
          style={{ width: "100%", padding: "10px 14px", borderRadius: 10, border: `1px solid ${C.ink}`, background: "transparent", color: C.ink, fontWeight: 600, fontSize: 13, display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}
        >
          למדריך המלא על {guide.label} <ChevronLeft size={14} />
        </button>
      </div>
    </div>
  );
}

function ScoreBar({ label, value, color }) {
  const pct = Math.max(0, Math.min(10, value)) * 10;
  return (
    <div style={{ marginBottom: 10 }}>
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, marginBottom: 3, color: C.inkSoft }}>
        <span>{label}</span>
        <span style={{ fontFamily: "'Space Mono', monospace", fontWeight: 700, color }}>{value}/10</span>
      </div>
      <div style={{ height: 8, background: C.paperDarker, borderRadius: 5, overflow: "hidden" }}>
        <div style={{ width: `${pct}%`, height: "100%", background: color, borderRadius: 5, transition: "width .6s ease" }} />
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------
   GUIDE ILLUSTRATIONS (SVG)
--------------------------------------------------------------- */

function LineSVG() {
  return (
    <svg viewBox="0 0 320 190" style={{ width: "100%", height: "auto" }}>
      <text x="160" y="24" textAnchor="middle" fontSize="12" fill={C.inkFaint} fontFamily="Heebo, sans-serif">קו מונוטוני (חלש) — אותו עובי לאורך כל הקו</text>
      <path d="M30,50 C90,55 150,45 290,52" fill="none" stroke={C.inkFaint} strokeWidth="1.6" strokeLinecap="round" />

      <text x="160" y="100" textAnchor="middle" fontSize="12" fill={C.red} fontFamily="Heebo, sans-serif">קו חי — עובי ולחץ משתנים</text>
      <path d="M30,135 C60,118 90,108 128,104" fill="none" stroke={C.red} strokeWidth="1.4" strokeLinecap="round" />
      <path d="M128,104 C165,99 195,102 225,112" fill="none" stroke={C.red} strokeWidth="4.5" strokeLinecap="round" />
      <path d="M225,112 C255,120 275,128 292,136" fill="none" stroke={C.red} strokeWidth="1.6" strokeLinecap="round" />
      <text x="60" y="160" fontSize="10.5" fill={C.inkFaint} fontFamily="Heebo, sans-serif">לחץ קל בקצוות</text>
      <text x="150" y="175" fontSize="10.5" fill={C.red} fontFamily="Heebo, sans-serif">לחץ חזק במרכז / בצל</text>
    </svg>
  );
}

function ProportionSVG() {
  return (
    <svg viewBox="0 0 300 210" style={{ width: "100%", height: "auto" }}>
      <ellipse cx="150" cy="105" rx="62" ry="85" fill="none" stroke={C.ink} strokeWidth="1.6" />
      {[38, 70, 105, 150, 175].map((y, i) => (
        <line key={i} x1="70" y1={y} x2="230" y2={y} stroke={C.grid} strokeDasharray="4 3" strokeWidth="1" />
      ))}
      <line x1="70" y1="105" x2="230" y2="105" stroke={C.red} strokeWidth="1.6" />
      <text x="238" y="41" fontSize="10.5" fill={C.inkFaint} fontFamily="Heebo, sans-serif">קו השיער</text>
      <text x="238" y="73" fontSize="10.5" fill={C.inkFaint} fontFamily="Heebo, sans-serif">גבות</text>
      <text x="238" y="109" fontSize="11" fill={C.red} fontFamily="Heebo, sans-serif" fontWeight="700">קו העיניים — בדיוק באמצע הראש</text>
      <text x="238" y="153" fontSize="10.5" fill={C.inkFaint} fontFamily="Heebo, sans-serif">תחתית האף</text>
      <text x="238" y="178" fontSize="10.5" fill={C.inkFaint} fontFamily="Heebo, sans-serif">הסנטר</text>
    </svg>
  );
}

function ValuesSVG() {
  const grad = "valGrad";
  return (
    <svg viewBox="0 0 300 230" style={{ width: "100%", height: "auto" }}>
      <defs>
        <radialGradient id={grad} cx="35%" cy="30%" r="75%">
          <stop offset="0%" stopColor="#F7F3E6" />
          <stop offset="35%" stopColor="#C9B98D" />
          <stop offset="60%" stopColor="#8A7A54" />
          <stop offset="75%" stopColor="#4A3F28" />
          <stop offset="88%" stopColor="#6B5C3B" />
          <stop offset="100%" stopColor="#5A4C30" />
        </radialGradient>
      </defs>
      <ellipse cx="150" cy="185" rx="55" ry="10" fill={C.ink} opacity="0.28" />
      <circle cx="150" cy="105" r="65" fill={`url(#${grad})`} stroke={C.ink} strokeWidth="1" />
      <line x1="95" y1="60" x2="145" y2="78" stroke={C.inkFaint} strokeWidth="0.8" />
      <text x="20" y="55" fontSize="10.5" fill={C.inkSoft} fontFamily="Heebo, sans-serif">אור חזק (הבהוב)</text>
      <line x1="200" y1="90" x2="170" y2="100" stroke={C.inkFaint} strokeWidth="0.8" />
      <text x="205" y="94" fontSize="10.5" fill={C.inkSoft} fontFamily="Heebo, sans-serif">אמצע-גוון</text>
      <line x1="210" y1="140" x2="185" y2="130" stroke={C.red} strokeWidth="0.8" />
      <text x="215" y="145" fontSize="10.5" fill={C.red} fontFamily="Heebo, sans-serif" fontWeight="700">קו הליבה — הכי כהה</text>
      <line x1="145" y1="160" x2="150" y2="150" stroke={C.inkFaint} strokeWidth="0.8" />
      <text x="95" y="172" fontSize="10.5" fill={C.inkSoft} fontFamily="Heebo, sans-serif">אור מוחזר (בהיר מהליבה)</text>
      <line x1="150" y1="188" x2="150" y2="178" stroke={C.inkFaint} strokeWidth="0.8" />
      <text x="115" y="205" fontSize="10.5" fill={C.inkSoft} fontFamily="Heebo, sans-serif">צל נטוי — כהה וחד קרוב לגוף</text>

      {[0, 1, 2, 3, 4, 5].map((i) => (
        <rect key={i} x={20 + i * 44} y="215" width="40" height="0" />
      ))}
    </svg>
  );
}

function ValueScaleSVG() {
  const steps = ["#F7F3E6", "#DCD0AF", "#B8A97C", "#8A7A54", "#5A4C30", "#241F14"];
  return (
    <svg viewBox="0 0 300 46" style={{ width: "100%", height: "auto" }}>
      {steps.map((c, i) => (
        <g key={i}>
          <rect x={i * 50} y="0" width="48" height="30" fill={c} stroke={C.ink} strokeWidth="0.5" />
          <text x={i * 50 + 24} y="42" fontSize="10" textAnchor="middle" fontFamily="'Space Mono', monospace" fill={C.inkFaint}>{i + 1}</text>
        </g>
      ))}
    </svg>
  );
}

function PerspectiveSVG() {
  return (
    <svg viewBox="0 0 300 200" style={{ width: "100%", height: "auto" }}>
      <line x1="10" y1="90" x2="290" y2="90" stroke={C.inkFaint} strokeWidth="1" strokeDasharray="5 4" />
      <text x="245" y="83" fontSize="10.5" fill={C.inkFaint} fontFamily="Heebo, sans-serif">קו האופק</text>
      <circle cx="150" cy="90" r="3" fill={C.red} />
      <text x="118" y="78" fontSize="10.5" fill={C.red} fontFamily="Heebo, sans-serif" fontWeight="700">נקודת המגוז</text>

      <rect x="60" y="110" width="70" height="60" fill="none" stroke={C.ink} strokeWidth="1.6" />
      <line x1="60" y1="110" x2="150" y2="90" stroke={C.blueSoft} strokeWidth="1" />
      <line x1="130" y1="110" x2="150" y2="90" stroke={C.blueSoft} strokeWidth="1" />
      <line x1="60" y1="170" x2="150" y2="90" stroke={C.blueSoft} strokeWidth="1" strokeDasharray="3 3" />
      <line x1="130" y1="170" x2="150" y2="90" stroke={C.blueSoft} strokeWidth="1" strokeDasharray="3 3" />
      <path d="M97,118 L150,105 L150,155 L97,168 Z" fill={C.paperDarker} opacity="0.6" stroke={C.ink} strokeWidth="1" />

      <text x="30" y="195" fontSize="10.5" fill={C.inkSoft} fontFamily="Heebo, sans-serif">כל הקווים המקבילים בעולם האמיתי נפגשים בנקודת המגוז על קו האופק</text>
    </svg>
  );
}

function CompositionSVG() {
  return (
    <svg viewBox="0 0 300 200" style={{ width: "100%", height: "auto" }}>
      <rect x="10" y="10" width="280" height="180" fill="none" stroke={C.ink} strokeWidth="1.5" />
      {[1, 2].map((i) => (
        <line key={"v" + i} x1={10 + (280 / 3) * i} y1="10" x2={10 + (280 / 3) * i} y2="190" stroke={C.grid} strokeWidth="1" />
      ))}
      {[1, 2].map((i) => (
        <line key={"h" + i} x1="10" y1={10 + (180 / 3) * i} x2="290" y2={10 + (180 / 3) * i} stroke={C.grid} strokeWidth="1" />
      ))}
      <circle cx={10 + 280 / 3} cy={10 + 180 / 3} r="14" fill={C.red} opacity="0.85" />
      <text x={10 + 280 / 3} y={10 + 180 / 3 + 34} fontSize="10" textAnchor="middle" fill={C.red} fontFamily="Heebo, sans-serif" fontWeight="700">נקודת עניין חזקה</text>

      <circle cx="150" cy="100" r="10" fill="none" stroke={C.inkFaint} strokeWidth="1.4" strokeDasharray="3 3" />
      <line x1="140" y1="90" x2="160" y2="110" stroke={C.inkFaint} strokeWidth="1" />
      <line x1="160" y1="90" x2="140" y2="110" stroke={C.inkFaint} strokeWidth="1" />
      <text x="150" y="130" fontSize="10" textAnchor="middle" fill={C.inkFaint} fontFamily="Heebo, sans-serif">מרכז מדויק — פחות מעניין לעין</text>
    </svg>
  );
}

function TextureSVG() {
  const cell = (x, y, draw, label) => (
    <g>
      <rect x={x} y={y} width="120" height="70" fill="none" stroke={C.ink} strokeWidth="1" />
      {draw(x, y)}
      <text x={x + 60} y={y + 86} fontSize="10.5" textAnchor="middle" fill={C.inkSoft} fontFamily="Heebo, sans-serif">{label}</text>
    </g>
  );
  const hatch = (x, y) => Array.from({ length: 10 }).map((_, i) => (
    <line key={i} x1={x + 8 + i * 11} y1={y + 8} x2={x + 8 + i * 11} y2={y + 62} stroke={C.ink} strokeWidth="1" />
  ));
  const cross = (x, y) => (
    <>
      {Array.from({ length: 10 }).map((_, i) => (
        <line key={"a" + i} x1={x + 8 + i * 11} y1={y + 8} x2={x + 8 + i * 11} y2={y + 62} stroke={C.ink} strokeWidth="1" />
      ))}
      {Array.from({ length: 8 }).map((_, i) => (
        <line key={"b" + i} x1={x + 6} y1={y + 10 + i * 7} x2={x + 114} y2={y + 10 + i * 7} stroke={C.ink} strokeWidth="1" opacity="0.75" />
      ))}
    </>
  );
  const stipple = (x, y) => Array.from({ length: 90 }).map((_, i) => {
    const rx = x + 6 + ((i * 37) % 108);
    const ry = y + 6 + ((i * 53) % 58);
    return <circle key={i} cx={rx} cy={ry} r="1.3" fill={C.ink} />;
  });
  const scribble = (x, y) => (
    <path
      d={`M${x + 10},${y + 20} C${x + 30},${y + 5} ${x + 20},${y + 35} ${x + 45},${y + 15} C${x + 70},${y - 5} ${x + 55},${y + 40} ${x + 85},${y + 20} C${x + 100},${y + 10} ${x + 90},${y + 45} ${x + 110},${y + 30} C${x + 60},${y + 55} ${x + 30},${y + 60} ${x + 10},${y + 50}`}
      fill="none"
      stroke={C.ink}
      strokeWidth="1.1"
    />
  );
  return (
    <svg viewBox="0 0 300 190" style={{ width: "100%", height: "auto" }}>
      <g transform="translate(15,5)">{cell(0, 0, hatch, "הצללה (hatching)")}</g>
      <g transform="translate(150,5)">{cell(0, 0, cross, "הצללה צולבת")}</g>
      <g transform="translate(15,100)">{cell(0, 0, stipple, "נקודתיות (stippling)")}</g>
      <g transform="translate(150,100)">{cell(0, 0, scribble, "קשקוש מבוקר (scumbling)")}</g>
    </svg>
  );
}

const GUIDES = {
  line: {
    label: "איכות הקו",
    intro:
      "קו טוב ברישום הוא לא קו 'מדויק' אלא קו חי — כזה שהעובי והכהות שלו משתנים לפי האור, המרחק והחשיבות של הצורה. תלמידים מתחילים נוטים לצייר בקו אחיד ומהוסס, ומאבדים בכך תחושת נפח ותנועה.",
    practice: "תרגול: ציירי 10 קווים על דף, כל אחד מתחיל בלחץ קל, עובר ללחץ חזק באמצע וחוזר לקל בסוף — בלי להרים את העיפרון.",
    Svg: LineSVG,
  },
  proportion: {
    label: "פרופורציה",
    intro:
      "השיטה הקלאסית למדידת פרופורציות היא שיטת ה'יחידת מידה' — לבחור יחידה קבועה (למשל גובה הראש) ולמדוד באמצעותה את שאר האלמנטים. בפורטרט, קו העיניים כמעט תמיד נמצא בדיוק באמצע גובה הראש — טעות נפוצה היא לצייר את העיניים גבוה מדי.",
    practice: "תרגול: לפני שאת מתחילה לרשום פרטים, סמני קלות בעיפרון קו אמצע אופקי ואנכי על הדף, והשוואי כל צורה חדשה אליהם.",
    Svg: ProportionSVG,
  },
  values: {
    label: "גווני אור-צל (Values)",
    intro:
      "בכל צורה תלת-ממדית מוארת ניתן לזהות חמישה אזורי גוון קלאסיים: אור חזק, אמצע-גוון, קו הליבה (הכי כהה), אור מוחזר (מעט בהיר מהליבה) וצל נטוי. שליטה בסולם הגוונים הזה היא מה שהופך רישום שטוח לרישום עם נפח.",
    practice: "תרגול: ציירי סולם גוונים מ-1 (הכי בהיר) עד 6 (הכי כהה) בלחץ עיפרון הולך וגובר, ואז נסי לשחזר אותו על כדור מצויר.",
    Svg: ValuesSVG,
  },
  perspective: {
    label: "פרספקטיבה",
    intro:
      "בפרספקטיבה בנקודה אחת, כל הקווים המקבילים בעולם האמיתי (כמו קצוות של קופסה) נראים מתכנסים לנקודה אחת על קו האופק — נקודת המגוז. הבנת העיקרון הזה עוזרת לצייר חדרים, רחובות ואובייקטים גיאומטריים בצורה משכנעת.",
    practice: "תרגול: ציירי קו אופק ונקודת מגוז אחת, ואז ציירי כמה קופסאות בגדלים שונים שכל הקווים הנעלמים שלהן נפגשים באותה נקודה.",
    Svg: PerspectiveSVG,
  },
  composition: {
    label: "קומפוזיציה",
    intro:
      "כלל השלישים הוא כלי בסיסי לארגון הדף: כשמחלקים את השטח לשלושה בכל ציר, נקודות החיתוך נוטות למשוך את העין יותר ממרכז מדויק. מיקום נקודת העניין המרכזית על אחת הנקודות האלה יוצר קומפוזיציה דינמית יותר.",
    practice: "תרגול: לפני שמתחילים לרשום, ציירי בקלילות רשת שלישים על הדף ותכנני איפה יעמוד מוקד העניין של הציור.",
    Svg: CompositionSVG,
  },
  texture: {
    label: "מרקם וטקסטורה",
    intro:
      "עיפרון יכול לדמות כמעט כל משטח באמצעות סוג הקווים בלבד: הצללה מקבילה למשטחים חלקים, הצללה צולבת לצללים כהים, נקודתיות למרקמים עדינים כמו עור, וקשקוש מבוקר לפרווה או עשב. בחירת סוג הסימון היא חלק מהשפה של הרישום.",
    practice: "תרגול: ציירי ריבוע 4 על 4 וחלקי אותו לארבעה תאים — מלאי כל תא בטכניקת מרקם אחרת על אותו גוון יעד.",
    Svg: TextureSVG,
  },
};

/* ---------------------------------------------------------------
   IMAGE HELPERS
--------------------------------------------------------------- */

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
        resolve({ dataUrl, base64: dataUrl.split(",")[1], mediaType: "image/jpeg" });
      };
      img.onerror = () => reject(new Error("שגיאה בטעינת התמונה"));
      img.src = e.target.result;
    };
    reader.onerror = () => reject(new Error("שגיאה בקריאת הקובץ"));
    reader.readAsDataURL(file);
  });
}

function buildHistoryContext(entries) {
  if (!entries.length) return "זהו הרישום הראשון שהתלמיד/ה מעלה - אין עדיין היסטוריה קודמת.";
  const recent = entries.slice(-5);
  const sums = {}, counts = {};
  recent.forEach((e) => {
    Object.entries(e.scores || {}).forEach(([k, v]) => {
      sums[k] = (sums[k] || 0) + Number(v);
      counts[k] = (counts[k] || 0) + 1;
    });
  });
  const avgs = {};
  Object.keys(sums).forEach((k) => { avgs[k] = Math.round((sums[k] / counts[k]) * 10) / 10; });
  const sorted = Object.entries(avgs).sort((a, b) => a[1] - b[1]);
  const weakest = sorted.slice(0, 2).map(([k]) => CAT_LABEL[k] || k).join(", ");
  const strongest = sorted.slice(-2).map(([k]) => CAT_LABEL[k] || k).join(", ");
  return `היסטוריית התלמיד/ה (${recent.length} רישומים אחרונים) - ממוצע ציונים: ${JSON.stringify(avgs)}. תחומי חולשה בולטים עד כה: ${weakest}. תחומי חוזק בולטים עד כה: ${strongest}. התייחס/י בקצרה האם הרישום הנוכחי ממשיך את הדפוס הזה או משתפר, ותן/י דגש בעצות דווקא לתחומי החולשה.`;
}

function getWeakestCategory(scores) {
  if (!scores) return "values";
  const sorted = Object.entries(scores).sort((a, b) => a[1] - b[1]);
  return sorted.length ? sorted[0][0] : "values";
}

async function callClaude(base64, mediaType, note, historyContext) {
  let response;
  try {
    response = await fetch("/api/analyze", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ base64, mediaType, note, historyContext }),
    });
  } catch (networkErr) {
    throw new Error("בעיית רשת מול השרת שלך: " + networkErr.message);
  }
  let data;
  try {
    data = await response.json();
  } catch (e) {
    throw new Error("התקבלה תשובה לא תקינה מהשרת (סטטוס " + response.status + ")");
  }
  if (!response.ok) {
    throw new Error(data.error || ("שגיאת שרת (סטטוס " + response.status + ")"));
  }
  return data;
}

/* ---------------------------------------------------------------
   MAIN APP
--------------------------------------------------------------- */

/* ---------------------------------------------------------------
   LOCAL STORAGE (standalone app - window.storage doesn't exist here,
   that API only exists inside Claude artifacts)
--------------------------------------------------------------- */
const localDB = {
  async get(key) {
    try {
      if (typeof window === "undefined") return null;
      const v = window.localStorage.getItem(key);
      return v != null ? { key, value: v } : null;
    } catch (e) { return null; }
  },
  async set(key, value) {
    try {
      if (typeof window === "undefined") return null;
      window.localStorage.setItem(key, value);
      return { key, value };
    } catch (e) { return null; }
  },
  async delete(key) {
    try {
      if (typeof window === "undefined") return null;
      window.localStorage.removeItem(key);
      return { key, deleted: true };
    } catch (e) { return null; }
  },
};

export default function DrawingCoachApp() {
  const [activeTab, setActiveTab] = useState("upload");
  const [entries, setEntries] = useState([]);
  const [storageReady, setStorageReady] = useState(false);
  const [file, setFile] = useState(null);
  const [note, setNote] = useState("");
  const [analyzing, setAnalyzing] = useState(false);
  const [error, setError] = useState(null);
  const [result, setResult] = useState(null);
  const [selectedGuide, setSelectedGuide] = useState("values");
  const [expandedEntry, setExpandedEntry] = useState(null);
  const [activeChartCats, setActiveChartCats] = useState(CATS.map((c) => c.key));
  const [confirmReset, setConfirmReset] = useState(false);
  const [demo, setDemo] = useState(null); // { entry, tip }
  const fileInputRef = useRef(null);

  useEffect(() => {
    (async () => {
      try {
        const res = await localDB.get("entries");
        if (res && res.value) setEntries(JSON.parse(res.value));
      } catch (e) {
        setEntries([]);
      } finally {
        setStorageReady(true);
      }
    })();
  }, []);

  async function saveEntries(updated) {
    try {
      await localDB.set("entries", JSON.stringify(updated));
    } catch (e) {
      // storage failure is non-fatal - keep working in-memory
    }
  }

  async function handleFileChange(e) {
    const f = e.target.files && e.target.files[0];
    if (!f) return;
    setError(null);
    try {
      const analysis = await resizeImage(f, 1024, 0.85);
      const thumb = await resizeImage(f, 560, 0.65);
      setFile({ analysisBase64: analysis.base64, mediaType: analysis.mediaType, previewUrl: analysis.dataUrl, thumbUrl: thumb.dataUrl });
      setResult(null);
    } catch (err) {
      setError("לא הצלחתי לטעון את התמונה. נסי קובץ אחר.");
    }
  }

  async function handleAnalyze() {
    if (!file) return;
    setAnalyzing(true);
    setError(null);
    try {
      const historyContext = buildHistoryContext(entries);
      const parsed = await callClaude(file.analysisBase64, file.mediaType, note, historyContext);
      const newEntry = {
        id: Date.now().toString(36),
        date: new Date().toISOString(),
        thumbnail: file.thumbUrl,
        note,
        overall_feedback: parsed.overall_feedback,
        tips: parsed.tips || [],
        scores: parsed.scores || {},
        strengths: parsed.strengths || [],
        weaknesses: parsed.weaknesses || [],
      };
      const updated = [...entries, newEntry];
      setEntries(updated);
      setResult({ ...newEntry, rawImageBase64: file.analysisBase64 });
      await saveEntries(updated);
      setSelectedGuide(getWeakestCategory(newEntry.scores));
      setFile(null);
      setNote("");
    } catch (err) {
      setError("הניתוח נכשל: " + (err && err.message ? err.message : "שגיאה לא ידועה") + ". נסי שוב, ואם זה חוזר - נסי תמונה אחרת או רעננ/י את הדף.");
    } finally {
      setAnalyzing(false);
    }
  }

  async function handleReset() {
    try {
      await localDB.delete("entries");
    } catch (e) {}
    setEntries([]);
    setResult(null);
    setConfirmReset(false);
  }

  function openGuideFor(category) {
    setSelectedGuide(category);
    setActiveTab("guide");
  }

  const avgAll = (() => {
    if (!entries.length) return {};
    const sums = {}, counts = {};
    entries.forEach((e) => Object.entries(e.scores || {}).forEach(([k, v]) => {
      sums[k] = (sums[k] || 0) + Number(v);
      counts[k] = (counts[k] || 0) + 1;
    }));
    const out = {};
    Object.keys(sums).forEach((k) => { out[k] = Math.round((sums[k] / counts[k]) * 10) / 10; });
    return out;
  })();
  const avgSorted = Object.entries(avgAll).sort((a, b) => b[1] - a[1]);
  const topStrength = avgSorted[0];
  const topWeakness = avgSorted[avgSorted.length - 1];

  const chartData = entries.map((e, i) => ({
    attempt: i + 1,
    dateLabel: new Date(e.date).toLocaleDateString("he-IL", { day: "2-digit", month: "2-digit" }),
    ...e.scores,
  }));

  return (
    <div dir="rtl" style={{ fontFamily: "'Heebo', sans-serif", background: C.paper, minHeight: "100%", color: C.ink }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Frank+Ruhl+Libre:wght@400;500;700&family=Heebo:wght@300;400;500;600;700&family=Space+Mono:wght@400;700&display=swap');
        * { box-sizing: border-box; }
        .dc-scroll::-webkit-scrollbar { height: 6px; width: 6px; }
        .dc-scroll::-webkit-scrollbar-thumb { background: ${C.paperDarker}; border-radius: 4px; }
        button { font-family: inherit; cursor: pointer; }
        input, textarea { font-family: inherit; }
      `}</style>

      <div style={{ maxWidth: 640, margin: "0 auto", padding: "22px 18px 60px" }}>
        {/* HERO */}
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 6 }}>
          <div style={{ width: 40, height: 40, borderRadius: "50%", background: C.ink, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
            <Pencil size={19} color={C.paper} />
          </div>
          <div>
            <h1 style={{ fontFamily: "'Frank Ruhl Libre', serif", fontSize: 26, fontWeight: 700, margin: 0, lineHeight: 1.15 }}>
              יומן הרישום שלי
            </h1>
            <div style={{ fontSize: 13, color: C.inkFaint }}>מורה אישי לתרגול רישום בעפרון</div>
          </div>
        </div>
        <div style={{ height: 1, background: `repeating-linear-gradient(to left, ${C.grid} 0 6px, transparent 6px 10px)`, margin: "14px 0 20px" }} />

        {/* TABS */}
        <div style={{ display: "flex", gap: 6, marginBottom: 18, background: C.paperDark, padding: 4, borderRadius: 10 }}>
          {[
            { key: "upload", label: "העלאה וניתוח", icon: Upload },
            { key: "progress", label: "ההתקדמות שלי", icon: TrendingUp },
            { key: "guide", label: "מדריך טכניקות", icon: BookOpen },
          ].map((t) => {
            const Icon = t.icon;
            const active = activeTab === t.key;
            return (
              <button
                key={t.key}
                onClick={() => setActiveTab(t.key)}
                style={{
                  flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
                  padding: "9px 6px", borderRadius: 7, border: "none",
                  background: active ? C.ink : "transparent",
                  color: active ? C.paper : C.inkSoft,
                  fontSize: 12.5, fontWeight: 600, transition: "all .2s",
                }}
              >
                <Icon size={14} /> {t.label}
              </button>
            );
          })}
        </div>

        {/* ---------------- UPLOAD TAB ---------------- */}
        {activeTab === "upload" && (
          <div>
            {!file && (
              <button
                onClick={() => fileInputRef.current && fileInputRef.current.click()}
                style={{
                  width: "100%", border: `2px dashed ${C.grid}`, borderRadius: 14, background: C.paperDark,
                  padding: "38px 18px", display: "flex", flexDirection: "column", alignItems: "center", gap: 10,
                }}
              >
                <Upload size={26} color={C.inkFaint} />
                <div style={{ fontWeight: 600, fontSize: 14.5 }}>לחצי כאן להעלאת תמונה של הרישום</div>
                <div style={{ fontSize: 12, color: C.inkFaint }}>מומלץ לצלם באור טוב ובזווית ישרה אל הדף</div>
              </button>
            )}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              capture="environment"
              onChange={handleFileChange}
              style={{ display: "none" }}
            />

            {file && (
              <div>
                <div style={{ position: "relative", borderRadius: 12, overflow: "hidden", border: `1px solid ${C.grid}`, marginBottom: 12 }}>
                  <img src={file.previewUrl} alt="תצוגה מקדימה" style={{ width: "100%", display: "block", maxHeight: 340, objectFit: "contain", background: "#fff" }} />
                  <button
                    onClick={() => { setFile(null); setResult(null); }}
                    style={{ position: "absolute", top: 8, left: 8, background: "rgba(43,42,38,0.75)", border: "none", borderRadius: "50%", width: 30, height: 30, display: "flex", alignItems: "center", justifyContent: "center" }}
                  >
                    <X size={16} color="#fff" />
                  </button>
                </div>
                <textarea
                  placeholder="יש הערה או שאלה ספציפית לגבי הרישום הזה? (אופציונלי)"
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  rows={2}
                  style={{ width: "100%", resize: "none", borderRadius: 10, border: `1px solid ${C.grid}`, padding: "10px 12px", fontSize: 13.5, background: "#fff", marginBottom: 12 }}
                />
                <button
                  onClick={handleAnalyze}
                  disabled={analyzing}
                  style={{
                    width: "100%", padding: "13px 16px", borderRadius: 10, border: "none",
                    background: analyzing ? C.inkFaint : C.blue, color: "#fff", fontWeight: 700, fontSize: 14.5,
                    display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                  }}
                >
                  {analyzing ? (<><Loader2 size={17} className="dc-spin" style={{ animation: "spin 1s linear infinite" }} /> מנתח/ת את הרישום…</>) : (<><Sparkles size={16} /> נתחי את הציור</>)}
                </button>
                <style>{`@keyframes spin { from { transform: rotate(0); } to { transform: rotate(360deg); } }`}</style>
              </div>
            )}

            {error && (
              <div style={{ marginTop: 12, padding: "10px 12px", background: "#F3DFDA", color: C.red, borderRadius: 9, fontSize: 13, display: "flex", gap: 8, alignItems: "flex-start" }}>
                <Info size={15} style={{ flexShrink: 0, marginTop: 1 }} /> {error}
              </div>
            )}

            {result && (
              <div style={{ marginTop: 22 }}>
                <div style={{ background: "#fff", border: `1px solid ${C.grid}`, borderRadius: 14, padding: "16px 16px 4px", marginBottom: 16, position: "relative" }}>
                  <div style={{ position: "absolute", top: -10, right: 16, background: C.red, color: "#fff", fontSize: 11, fontWeight: 700, padding: "3px 10px", borderRadius: 20 }}>
                    משוב המורה
                  </div>
                  <p style={{ fontFamily: "'Frank Ruhl Libre', serif", fontSize: 16, lineHeight: 1.6, margin: "10px 0 14px", color: C.ink }}>
                    {result.overall_feedback}
                  </p>
                </div>

                <div style={{ background: C.paperDark, borderRadius: 14, padding: 16, marginBottom: 16 }}>
                  <div style={{ fontWeight: 700, fontSize: 13.5, marginBottom: 10 }}>ציונים לרישום הזה</div>
                  {CATS.map((c) => (
                    <ScoreBar key={c.key} label={c.label} value={result.scores[c.key]} color={CAT_COLOR[c.key]} />
                  ))}
                </div>

                <div style={{ marginBottom: 8, fontWeight: 700, fontSize: 13.5 }}>טיפים לשלב הבא</div>
                {result.tips.map((tip, i) => (
                  <div key={i} onClick={() => setDemo({ entry: result, tip })} style={{ background: "#fff", border: `1px solid ${C.grid}`, borderRadius: 12, padding: "12px 14px", marginBottom: 10, cursor: "pointer" }}>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 3 }}>
                      <span style={{ fontWeight: 700, fontSize: 14 }}>{tip.title}</span>
                      <span style={{ fontSize: 10.5, color: CAT_COLOR[tip.category] || C.inkFaint, background: C.paperDark, padding: "2px 8px", borderRadius: 20 }}>{CAT_LABEL[tip.category] || tip.category}</span>
                    </div>
                    <Underline width={70} color={CAT_COLOR[tip.category] || C.red} />
                    <p style={{ fontSize: 13, color: C.inkSoft, margin: "4px 0 0", lineHeight: 1.5 }}>{tip.explanation}</p>
                    <div style={{ fontSize: 11, color: C.inkFaint, marginTop: 6, display: "flex", alignItems: "center", gap: 4 }}>
                      <Sparkles size={11} /> לחצי כדי לראות מודגם על הציור שלך
                    </div>
                  </div>
                ))}

                <button
                  onClick={() => openGuideFor(getWeakestCategory(result.scores))}
                  style={{ width: "100%", marginTop: 6, padding: "11px 14px", borderRadius: 10, border: `1px solid ${C.ink}`, background: "transparent", color: C.ink, fontWeight: 600, fontSize: 13.5, display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}
                >
                  ראי מדריך מצויר על {CAT_LABEL[getWeakestCategory(result.scores)]} <ChevronLeft size={15} />
                </button>
              </div>
            )}
          </div>
        )}

        {/* ---------------- PROGRESS TAB ---------------- */}
        {activeTab === "progress" && (
          <div>
            {!storageReady ? (
              <div style={{ textAlign: "center", padding: 40, color: C.inkFaint }}>טוען נתונים…</div>
            ) : entries.length === 0 ? (
              <div style={{ textAlign: "center", padding: "50px 20px", color: C.inkFaint }}>
                <ImageOff size={30} style={{ marginBottom: 10, opacity: 0.5 }} />
                <div style={{ fontSize: 14 }}>עוד לא העלית רישומים.</div>
                <div style={{ fontSize: 13 }}>לכי לטאב "העלאה וניתוח" כדי להתחיל לבנות תיק עבודות.</div>
              </div>
            ) : (
              <div>
                <div style={{ display: "flex", gap: 10, marginBottom: 18 }}>
                  <div style={{ flex: 1, background: "#fff", border: `1px solid ${C.grid}`, borderRadius: 12, padding: "12px 10px", textAlign: "center" }}>
                    <div style={{ fontFamily: "'Space Mono', monospace", fontSize: 20, fontWeight: 700 }}>{entries.length}</div>
                    <div style={{ fontSize: 11, color: C.inkFaint }}>רישומים</div>
                  </div>
                  <div style={{ flex: 1, background: "#fff", border: `1px solid ${C.grid}`, borderRadius: 12, padding: "12px 10px", textAlign: "center" }}>
                    <div style={{ fontSize: 12.5, fontWeight: 700, color: CAT_COLOR[topStrength ? topStrength[0] : "line"] }}>{topStrength ? CAT_LABEL[topStrength[0]] : "-"}</div>
                    <div style={{ fontSize: 11, color: C.inkFaint }}>החוזק שלך</div>
                  </div>
                  <div style={{ flex: 1, background: "#fff", border: `1px solid ${C.grid}`, borderRadius: 12, padding: "12px 10px", textAlign: "center" }}>
                    <div style={{ fontSize: 12.5, fontWeight: 700, color: C.red }}>{topWeakness ? CAT_LABEL[topWeakness[0]] : "-"}</div>
                    <div style={{ fontSize: 11, color: C.inkFaint }}>כדאי לתרגל</div>
                  </div>
                </div>

                <div style={{ background: "#fff", border: `1px solid ${C.grid}`, borderRadius: 14, padding: "14px 10px 6px", marginBottom: 18 }} dir="ltr">
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 5, marginBottom: 6, direction: "rtl", paddingRight: 6 }}>
                    {CATS.map((c) => {
                      const on = activeChartCats.includes(c.key);
                      return (
                        <button
                          key={c.key}
                          onClick={() => setActiveChartCats((prev) => on ? prev.filter((k) => k !== c.key) : [...prev, c.key])}
                          style={{
                            fontSize: 10.5, padding: "3px 9px", borderRadius: 20, border: `1px solid ${on ? CAT_COLOR[c.key] : C.grid}`,
                            background: on ? CAT_COLOR[c.key] : "transparent", color: on ? "#fff" : C.inkFaint, fontWeight: 600,
                          }}
                        >
                          {c.label}
                        </button>
                      );
                    })}
                  </div>
                  <ResponsiveContainer width="100%" height={230}>
                    <LineChart data={chartData} margin={{ top: 6, right: 10, left: -20, bottom: 0 }}>
                      <CartesianGrid stroke={C.paperDark} strokeDasharray="3 3" />
                      <XAxis dataKey="dateLabel" tick={{ fontSize: 10, fill: C.inkFaint }} />
                      <YAxis domain={[0, 10]} tick={{ fontSize: 10, fill: C.inkFaint }} />
                      <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8 }} />
                      {CATS.filter((c) => activeChartCats.includes(c.key)).map((c) => (
                        <Line key={c.key} type="monotone" dataKey={c.key} name={c.label} stroke={CAT_COLOR[c.key]} strokeWidth={2} dot={{ r: 3 }} connectNulls />
                      ))}
                    </LineChart>
                  </ResponsiveContainer>
                </div>

                <div style={{ fontWeight: 700, fontSize: 13.5, marginBottom: 8 }}>היסטוריית רישומים</div>
                {[...entries].reverse().map((e) => {
                  const avg = Math.round((Object.values(e.scores).reduce((a, b) => a + Number(b), 0) / Object.values(e.scores).length) * 10) / 10;
                  const open = expandedEntry === e.id;
                  return (
                    <div key={e.id} style={{ background: "#fff", border: `1px solid ${C.grid}`, borderRadius: 12, marginBottom: 10, overflow: "hidden" }}>
                      <div onClick={() => setExpandedEntry(open ? null : e.id)} style={{ display: "flex", alignItems: "center", gap: 10, padding: 10, cursor: "pointer" }}>
                        <img src={e.thumbnail} alt="" style={{ width: 46, height: 46, objectFit: "cover", borderRadius: 8, border: `1px solid ${C.grid}` }} />
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 12.5, color: C.inkFaint }}>{new Date(e.date).toLocaleDateString("he-IL", { day: "2-digit", month: "2-digit", year: "numeric" })}</div>
                          <div style={{ fontSize: 12, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{e.overall_feedback}</div>
                        </div>
                        <ScoreBadge value={avg} size={38} />
                      </div>
                      {open && (
                        <div style={{ padding: "0 12px 14px" }}>
                          {e.tips.map((tip, i) => (
                            <div key={i} onClick={() => setDemo({ entry: e, tip })} style={{ fontSize: 12.5, marginBottom: 6, color: C.inkSoft, cursor: "pointer" }}>
                              <span style={{ fontWeight: 700, color: C.ink }}>{tip.title}: </span>{tip.explanation}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}

                {!confirmReset ? (
                  <button onClick={() => setConfirmReset(true)} style={{ marginTop: 10, background: "transparent", border: "none", color: C.inkFaint, fontSize: 12, display: "flex", alignItems: "center", gap: 5 }}>
                    <RotateCcw size={12} /> אפס את כל ההיסטוריה
                  </button>
                ) : (
                  <div style={{ marginTop: 10, fontSize: 12.5, display: "flex", alignItems: "center", gap: 8 }}>
                    למחוק את כל ההיסטוריה לצמיתות?
                    <button onClick={handleReset} style={{ color: C.red, fontWeight: 700, background: "none", border: "none" }}>כן, מחקי</button>
                    <button onClick={() => setConfirmReset(false)} style={{ color: C.inkFaint, background: "none", border: "none" }}>ביטול</button>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* ---------------- GUIDE TAB ---------------- */}
        {activeTab === "guide" && (
          <div>
            <div className="dc-scroll" style={{ display: "flex", gap: 6, overflowX: "auto", paddingBottom: 8, marginBottom: 14 }}>
              {CATS.map((c) => {
                const active = selectedGuide === c.key;
                return (
                  <button
                    key={c.key}
                    onClick={() => setSelectedGuide(c.key)}
                    style={{
                      flexShrink: 0, padding: "8px 14px", borderRadius: 20, border: `1.5px solid ${active ? CAT_COLOR[c.key] : C.grid}`,
                      background: active ? CAT_COLOR[c.key] : "#fff", color: active ? "#fff" : C.inkSoft, fontWeight: 600, fontSize: 12.5,
                    }}
                  >
                    {c.label}
                  </button>
                );
              })}
            </div>

            {(() => {
              const g = GUIDES[selectedGuide];
              const Svg = g.Svg;
              return (
                <div>
                  <h2 style={{ fontFamily: "'Frank Ruhl Libre', serif", fontSize: 21, margin: "0 0 10px", color: CAT_COLOR[selectedGuide] }}>{g.label}</h2>
                  <div style={{ background: "#fff", border: `1px solid ${C.grid}`, borderRadius: 14, padding: 14, marginBottom: 14 }}>
                    <Svg />
                  </div>
                  {selectedGuide === "values" && (
                    <div style={{ background: "#fff", border: `1px solid ${C.grid}`, borderRadius: 14, padding: 14, marginBottom: 14 }}>
                      <div style={{ fontSize: 12, color: C.inkFaint, marginBottom: 8 }}>סולם גוונים - כלי בסיסי לתרגול</div>
                      <ValueScaleSVG />
                    </div>
                  )}
                  <p style={{ fontSize: 14, lineHeight: 1.7, color: C.inkSoft, margin: "0 0 12px" }}>{g.intro}</p>
                  <div style={{ background: C.paperDark, borderRadius: 12, padding: "12px 14px", display: "flex", gap: 10 }}>
                    <Pencil size={16} style={{ flexShrink: 0, marginTop: 2, color: C.red }} />
                    <p style={{ fontSize: 13, margin: 0, lineHeight: 1.55 }}>{g.practice}</p>
                  </div>
                </div>
              );
            })()}
          </div>
        )}
      </div>

      {demo && (
        <TipDemoModal
          entry={demo.entry}
          tip={demo.tip}
          onClose={() => setDemo(null)}
          onOpenGuide={(category) => { setDemo(null); openGuideFor(category); }}
        />
      )}
    </div>
  );
}
