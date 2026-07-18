// This runs ONLY on the server (Vercel), never in the browser.
// It is the only place that touches ANTHROPIC_API_KEY.

const CATS = [
  { key: "line", label: "איכות הקו" },
  { key: "proportion", label: "פרופורציה" },
  { key: "values", label: "גווני אור-צל" },
  { key: "perspective", label: "פרספקטיבה" },
  { key: "composition", label: "קומפוזיציה" },
  { key: "texture", label: "מרקם וטקסטורה" },
];

// NOTE: model names change over time. If you get a "model not found" style
// error, check the current model list at https://docs.claude.com and swap
// the string below.
const MODEL = "claude-sonnet-5";

export const config = {
  api: { bodyParser: { sizeLimit: "8mb" } },
};

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }
  if (!process.env.ANTHROPIC_API_KEY) {
    return res.status(500).json({ error: "חסר ANTHROPIC_API_KEY בהגדרות השרת (Environment Variables ב-Vercel)" });
  }

  const { base64, mediaType, note, historyContext } = req.body || {};
  if (!base64) {
    return res.status(400).json({ error: "לא התקבלה תמונה" });
  }

  const systemPrompt = `את/ה מורה מקצועי/ת ומנוסה לרישום בעפרון, המלמד/ת לפי עקרונות קלאסיים של רישום תצפיתי (איכות קו, פרופורציה, גווני אור-צל, פרספקטיבה, קומפוזיציה, מרקם). מקבלים ממך תמונה של רישום עפרון של תלמיד/ה. תני משוב פרקטי, ממוקד וידידותי בעברית, שמתאים לרמת התלמיד/ה כפי שהיא נראית בתמונה - בלי להיות מתנשא/ת ובלי גנרי מדי. התבססי אך ורק על מה שרואים בפועל בתמונה.

החזר/י אך ורק אובייקט JSON תקני, ללא טקסט נוסף, ללא הסברים, ללא markdown וללא גרשיים משולשים, במבנה המדויק הבא:
{
  "overall_feedback": "משוב כללי, עד 3 משפטים, טון תומך אך כן",
  "tips": [
    {
      "category": "אחד מ: line, proportion, values, perspective, composition, texture",
      "title": "כותרת קצרה של הטיפ",
      "explanation": "1-2 משפטים, עצה פרקטית וקונקרטית לשלב הבא, שמתייחסת ספציפית לאזור המסומן",
      "location": {"x": 0-100, "y": 0-100, "w": 5-100, "h": 5-100},
      "demo": {
        "simulatable": true/false,
        "effect": "darken | lighten | contrast | soften",
        "intensity": 0-100,
        "direction": "top | bottom | left | right | center"
      }
    }
  ],
  "scores": {"line": 1-10, "proportion": 1-10, "values": 1-10, "perspective": 1-10, "composition": 1-10, "texture": 1-10},
  "strengths": ["1-2 מפתחות קטגוריה החזקים ביותר ברישום הזה"],
  "weaknesses": ["1-2 מפתחות קטגוריה שהכי כדאי לתרגל"]
}
ספקי בין 3 ל-5 טיפים בשדה tips, כל אחד עם category תקין מהרשימה. תני ציון גם לתחומים שלא רלוונטיים ישירות לתוכן הציור לפי מיטב שיפוטך (למשל אם אין פרספקטיבה בציור, שפטי לפי מה שכן ניתן להעריך). היי ספציפית - התייחסי למה שבאמת רואים בתמונה הזו, לא למשפטים כלליים שמתאימים לכל רישום.

שדה location הוא קריטי: x,y הם אחוזים (0-100) של הפינה השמאלית-עליונה של האזור הספציפי בתמונה שהטיפ מתייחס אליו (0,0 = פינה שמאלית-עליונה של כל התמונה, 100,100 = פינה ימנית-תחתונה), ו-w,h הם רוחב וגובה האזור באחוזים. בחרי אזור צר וממוקד (בדרך כלל 15-45 אחוז מהתמונה בכל ציר) שבאמת מדגים את הבעיה או ההזדמנות שהטיפ מדבר עליה - למשל קצה מסוים, אזור צל, או פרט קונקרטי - ולא את כל התמונה.

שדה demo קובע האם וכיצד אפשר להדגים את השיפור באמצעות סימולציית טונים אמיתית על התמונה עצמה (לא ציור מחדש - רק שינוי בהירות/ניגודיות/רכות של האזור המסומן):
- simulatable=true רק כאשר השיפור הוא באמת עניין של גוון, ניגודיות, כהות או רכות (בעיקר קטגוריות values, texture, ולפעמים line) - כלומר משהו שאפשר לקרב ע"י החשכה/הבהרה/הגברת ניגודיות של האזור, לא שינוי צורה, מיקום או פרופורציה.
- simulatable=false עבור טיפים מבניים/מרחביים (למשל proportion, perspective, composition, או כל טיפ שדורש לזוז/לשנות צורה/להוסיף אלמנט) - עבורם אין להמציא simulatable=true כי סימולציית טונים לא באמת תדגים את השינוי.
- effect: darken (להעמיק צללים), lighten (להבהיר אור), contrast (להגביר ניגודיות/חדות סימון), soften (לרכך מעברים).
- intensity: כמה חזקה ההדגמה (0 חלש, 100 חזק) - בהתאם לכמה התלמיד/ה צריכ/ה לשנות.
- direction: לאיזה כיוון בתוך האזור המסומן ההשפעה צריכה להיות חזקה יותר (לדוגמה "bottom" אם רוצים להעמיק צל בתחתית האזור) - "center" אם ההשפעה אחידה.`;

  const userText = `${note ? `הערה מהתלמיד/ה: ${note}\n\n` : ""}${historyContext || ""}\n\nנתח/י את הרישום המצורף ותן/י משוב לפי הפורמט שהוגדר.`;

  let anthropicRes;
  try {
    anthropicRes = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": process.env.ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 1500,
        system: systemPrompt,
        messages: [
          {
            role: "user",
            content: [
              { type: "image", source: { type: "base64", media_type: mediaType || "image/jpeg", data: base64 } },
              { type: "text", text: userText },
            ],
          },
        ],
      }),
    });
  } catch (networkErr) {
    return res.status(502).json({ error: "בעיית רשת בעת פנייה ל-Claude: " + networkErr.message });
  }

  let data;
  try {
    data = await anthropicRes.json();
  } catch (e) {
    return res.status(502).json({ error: "התקבלה תשובה לא תקינה מ-Claude (סטטוס " + anthropicRes.status + ")" });
  }

  if (!anthropicRes.ok) {
    const apiMsg = (data && data.error && data.error.message) || ("סטטוס " + anthropicRes.status);
    return res.status(anthropicRes.status).json({ error: "שגיאת API של Claude: " + apiMsg });
  }

  const textBlock = (data.content || []).find((b) => b.type === "text");
  let raw = (textBlock && textBlock.text) || "";
  raw = raw.replace(/```json|```/g, "").trim();
  const firstBrace = raw.indexOf("{");
  const lastBrace = raw.lastIndexOf("}");
  if (firstBrace === -1 || lastBrace === -1) {
    return res.status(502).json({ error: "התשובה מ-Claude לא הכילה JSON תקין: " + raw.slice(0, 200) });
  }
  raw = raw.slice(firstBrace, lastBrace + 1);

  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch (e) {
    return res.status(502).json({ error: "לא הצלחתי לפרש את תשובת הניתוח (JSON שבור)" });
  }

  if (!parsed.scores) parsed.scores = {};
  CATS.forEach((c) => {
    const v = Number(parsed.scores[c.key]);
    parsed.scores[c.key] = Number.isFinite(v) ? v : 5;
  });
  if (!Array.isArray(parsed.tips)) parsed.tips = [];
  const validCats = CATS.map((c) => c.key);
  parsed.tips = parsed.tips.map((t) => {
    const category = validCats.includes(t.category) ? t.category : "values";
    const loc = t.location || {};
    const clamp = (n, def) => { const v = Number(n); return Number.isFinite(v) ? Math.min(100, Math.max(0, v)) : def; };
    let x = clamp(loc.x, 10), y = clamp(loc.y, 10);
    let w = Math.min(100 - x, clamp(loc.w, 70) || 70);
    let h = Math.min(100 - y, clamp(loc.h, 70) || 70);
    if (w < 5) w = Math.min(100 - x, 30);
    if (h < 5) h = Math.min(100 - y, 30);
    const d = t.demo || {};
    const demo = {
      simulatable: d.simulatable === true,
      effect: ["darken", "lighten", "contrast", "soften"].includes(d.effect) ? d.effect : "contrast",
      intensity: (() => { const v = Number(d.intensity); return Number.isFinite(v) ? Math.min(100, Math.max(0, v)) : 40; })(),
      direction: ["top", "bottom", "left", "right", "center"].includes(d.direction) ? d.direction : "center",
    };
    return { ...t, category, location: { x, y, w, h }, demo };
  });
  if (!Array.isArray(parsed.strengths)) parsed.strengths = [];
  if (!Array.isArray(parsed.weaknesses)) parsed.weaknesses = [];
  if (!parsed.overall_feedback) parsed.overall_feedback = "";

  return res.status(200).json(parsed);
}
