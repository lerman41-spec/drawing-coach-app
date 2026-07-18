// This runs ONLY on the server (Vercel), never in the browser.
// It is the only place that touches OPENAI_API_KEY.
//
// How it works:
// 1. The browser sends the full drawing photo + a box (x,y,w,h in percent) + an instruction.
// 2. We build a "mask" image the same size as the photo: opaque (keep) everywhere,
//    except transparent (edit) inside the box.
// 3. We send both to OpenAI's images.edit endpoint with model "gpt-image-2".
//    OpenAI only regenerates the transparent part and keeps the rest identical.

import OpenAI from "openai";
import { toFile } from "openai/uploads";
import sharp from "sharp";

export const config = {
  api: { bodyParser: { sizeLimit: "10mb" } },
};

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }
  if (!process.env.OPENAI_API_KEY) {
    return res.status(500).json({ error: "חסר OPENAI_API_KEY בהגדרות השרת (Environment Variables ב-Vercel)" });
  }

  const { imageBase64, box, instruction } = req.body || {};
  if (!imageBase64 || !box || !instruction) {
    return res.status(400).json({ error: "חסרים פרטים בבקשה (תמונה / אזור / הוראה)" });
  }

  try {
    const inputBuffer = Buffer.from(imageBase64, "base64");
    // Normalize to PNG so dimensions/format are predictable for masking.
    const pngBuffer = await sharp(inputBuffer).png().toBuffer();
    const meta = await sharp(pngBuffer).metadata();
    const W = meta.width, H = meta.height;
    if (!W || !H) throw new Error("לא הצלחתי לקרוא את ממדי התמונה");

    const clamp01 = (n) => Math.max(0, Math.min(100, Number(n) || 0));
    const bx = Math.round((clamp01(box.x) / 100) * W);
    const by = Math.round((clamp01(box.y) / 100) * H);
    const bw = Math.max(1, Math.round((clamp01(box.w) / 100) * W));
    const bh = Math.max(1, Math.round((clamp01(box.h) / 100) * H));

    // Build an RGBA mask: fully opaque (255) = keep untouched,
    // fully transparent (alpha 0) inside the box = the region OpenAI should regenerate.
    const channels = 4;
    const mask = Buffer.alloc(W * H * channels, 255);
    for (let y = by; y < Math.min(by + bh, H); y++) {
      for (let x = bx; x < Math.min(bx + bw, W); x++) {
        const idx = (y * W + x) * channels;
        mask[idx + 3] = 0; // alpha = 0 -> editable region
      }
    }
    const maskPng = await sharp(mask, { raw: { width: W, height: H, channels } }).png().toBuffer();

    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

    const prompt =
      `This is a pencil sketch on paper. Only modify the masked (transparent) region of the image. ` +
      `Requested change for that region: ${instruction} ` +
      `Keep everything outside the masked region pixel-identical. Inside the region, keep the same subject, ` +
      `linework, paper texture and pencil-sketch style - this must still clearly look like the same hand-drawn ` +
      `pencil drawing, just with this one specific local improvement applied.`;

    const result = await openai.images.edit({
      model: "gpt-image-2",
      image: await toFile(pngBuffer, "drawing.png", { type: "image/png" }),
      mask: await toFile(maskPng, "mask.png", { type: "image/png" }),
      prompt,
    });

    const outBase64 = result.data && result.data[0] && result.data[0].b64_json;
    if (!outBase64) throw new Error("לא התקבלה תמונה מהשירות");

    return res.status(200).json({ imageBase64: outBase64 });
  } catch (err) {
    const msg = (err && err.message) || "שגיאה לא ידועה בעריכת התמונה";
    return res.status(500).json({ error: msg });
  }
}
