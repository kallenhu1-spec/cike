const DEFAULT_BASE_URL = "https://ark.cn-beijing.volces.com/api/v3";
const DEFAULT_MODEL = "doubao-seedream-5-0-pro-260628";

function envValue(name, fallback = "") {
  return String(process.env[name] || fallback).trim();
}

function imagePrompt({ purpose, style, action }) {
  const styleText = style === "线条风" ? "clean line illustration" :
    style === "3D风" ? "soft toy-like 3D illustration" :
    style === "插画风" ? "warm editorial illustration" :
    style === "手办风" ? "small collectible figurine render" :
    "warm felt-like hand-painted illustration";
  if (purpose === "action") {
    return [
      "[CONSISTENT CHARACTER ACTION]",
      `Use the reference image as the same character identity. Keep face, colors, clothing and proportions consistent.`,
      `Create one simple desktop-companion action: ${action || "quietly drinking water"}.`,
      `${styleText}; centered full character; clean simple background; one clear readable pose.`,
      "No text, no watermark, no extra characters, no collage, no realistic child, no frame."
    ].join("\n");
  }
  return [
    "[PHOTO TO DESKTOP IP CHARACTER]",
    "Transform the person in the reference photo into a friendly desktop companion IP character（桌面陪伴 IP 形象）.",
    "Keep the same character identity across later action images: face cues, hair silhouette, palette and signature details.",
    `Visual direction: ${styleText}.`,
    "Preserve recognizable hair, colors, expression and gentle personality without producing a realistic person.",
    "Full-body or three-quarter character, centered, isolated on a simple light background.",
    "No text, no watermark, no extra characters, no collage, no photo border."
  ].join("\n");
}

async function generate({ referenceImage, purpose = "character", style = "彩绘风", action = "" }) {
  if (!referenceImage || !/^data:image\/[a-z0-9.+-]+;base64,/i.test(referenceImage)) {
    throw new Error("请先选择一张有效的照片。");
  }
  const apiKey = envValue("ARK_API_KEY");
  const endpoint = envValue("CIKE_IMAGE_API_URL");
  if (!apiKey && !endpoint) {
    throw new Error("尚未配置生图服务。开发测试请设置 ARK_API_KEY；给用户分发时请设置 CIKE_IMAGE_API_URL 代理。");
  }
  const url = `${endpoint || DEFAULT_BASE_URL}`.replace(/\/$/, "") + "/images/generations";
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {}) },
    body: JSON.stringify({
      model: envValue("ARK_IMAGE_MODEL", DEFAULT_MODEL),
      prompt: imagePrompt({ purpose, style, action }),
      image: [referenceImage],
      size: "2K",
      response_format: "b64_json",
      watermark: false
    })
  });
  let payload = null;
  try { payload = await response.json(); } catch {}
  if (!response.ok) {
    const message = payload?.error?.message || payload?.message || `生图服务请求失败（${response.status}）`;
    throw new Error(message);
  }
  const value = payload?.data?.[0]?.b64_json || payload?.data?.[0]?.url || payload?.images?.[0];
  if (!value) throw new Error("生图服务没有返回图片。");
  if (value.startsWith("data:image/")) return value;
  if (value.startsWith("http")) {
    const imageResponse = await fetch(value);
    if (!imageResponse.ok) throw new Error(`生成图片下载失败（${imageResponse.status}）`);
    const type = imageResponse.headers.get("content-type") || "image/png";
    return `data:${type};base64,${Buffer.from(await imageResponse.arrayBuffer()).toString("base64")}`;
  }
  const mime = value.startsWith("iVBOR") ? "image/png" : "image/jpeg";
  return `data:${mime};base64,${value}`;
}

function status() {
  return {
    configured: Boolean(envValue("ARK_API_KEY") || envValue("CIKE_IMAGE_API_URL")),
    provider: envValue("CIKE_IMAGE_API_URL") ? "configured-proxy" : "volcengine-ark",
    model: envValue("ARK_IMAGE_MODEL", DEFAULT_MODEL)
  };
}

module.exports = { generate, status, imagePrompt };
