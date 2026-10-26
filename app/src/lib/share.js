// Share cards (US-8.2): a branded 1200×630 PNG with source and timestamp,
// sent through the Web Share API when available, otherwise downloaded.
// Returns "shared" | "cancelled" | "downloaded" | "failed"; never throws.
import { locale, t } from "./i18n.js";

const tones = { up: "#55d6a7", down: "#f1727f", neutral: "#b4b0d0" };

async function drawCard({ title, headline, detail, detailTone = "neutral" }) {
  const canvas = document.createElement("canvas");
  canvas.width = 1200;
  canvas.height = 630;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas is not available");
  ctx.fillStyle = "#0b0c10";
  ctx.fillRect(0, 0, 1200, 630);
  ctx.fillStyle = "#f4f5f8";
  ctx.beginPath();
  if (ctx.roundRect) ctx.roundRect(72, 64, 64, 64, 18);
  else ctx.rect(72, 64, 64, 64);
  ctx.fill();
  ctx.fillStyle = "#0b0c10";
  ctx.font = "800 40px Inter, sans-serif";
  ctx.fillText("C", 90, 110);
  ctx.fillStyle = "#f4f5f8";
  ctx.font = "800 34px Inter, sans-serif";
  ctx.fillText("CPA", 156, 108);
  ctx.font = "600 52px Inter, sans-serif";
  ctx.fillText(title, 72, 260);
  ctx.font = "700 104px Inter, sans-serif";
  ctx.fillText(headline, 72, 390);
  ctx.fillStyle = tones[detailTone] ?? tones.neutral;
  ctx.font = "600 44px Inter, sans-serif";
  ctx.fillText(detail, 72, 460);
  ctx.fillStyle = "#8a909c";
  ctx.font = "400 26px Inter, sans-serif";
  ctx.fillText(t("Source: CPA sample data · {time} · Not financial advice", { time: new Date().toLocaleString(locale()) }), 72, 560);
  ctx.fillText(window.location.href, 72, 596);
  const blob = await new Promise((resolve) => canvas.toBlob(resolve, "image/png"));
  if (!blob) throw new Error("Couldn't create the image");
  return blob;
}

export async function shareCard({ fileName, ...content }) {
  let blob;
  try {
    blob = await drawCard(content);
  } catch {
    return "failed";
  }
  const file = new File([blob], `${fileName}.png`, { type: "image/png" });
  if (navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: t("{title} on CPA", { title: content.title }), url: window.location.href });
      return "shared";
    } catch {
      return "cancelled";
    }
  }
  try {
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = file.name;
    link.click();
    URL.revokeObjectURL(url);
    return "downloaded";
  } catch {
    return "failed";
  }
}
