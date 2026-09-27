"use strict";

const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");
const { spawn } = require("node:child_process");

const IMAGE_URL = "https://ark.cn-beijing.volces.com/api/v3/images/generations";
const VIDEO_URL = "https://ark.cn-beijing.volces.com/api/v3/contents/generations/tasks";
const STYLES = {
  "彩绘风": "warm hand-painted gouache and colored-pencil illustration, organic rounded contours, gentle paper texture",
  "线条风": "minimal expressive hand-drawn ink illustration with restrained soft color",
  "3D风": "polished stylized 3D character, soft studio light and tactile materials",
  "插画风": "Japanese-inspired cute chibi digital illustration, clean contours and soft colors",
  "手办风": "premium matte resin collectible figurine, softbox studio light",
};

function dataImage(value) {
  const match = /^data:(image\/(?:png|jpeg|webp));base64,([A-Za-z0-9+/=]+)$/.exec(value || "");
  if (!match) throw Error("图片格式无效");
  const bytes = Buffer.from(match[2], "base64");
  if (!bytes.length || bytes.length > 10 * 1024 * 1024) throw Error("图片必须小于10 MB");
  return { mime: match[1], bytes, url: value };
}
function format(bytes) {
  if (bytes[0] === 0xff && bytes[1] === 0xd8) return { ext: "jpg", mime: "image/jpeg" };
  if (bytes.subarray(0, 8).equals(Buffer.from([0x89,0x50,0x4e,0x47,0x0d,0x0a,0x1a,0x0a]))) return { ext: "png", mime: "image/png" };
  if (bytes.subarray(8, 12).toString("ascii") === "WEBP") return { ext: "webp", mime: "image/webp" };
  throw Error("模型返回了无法识别的图片");
}
function envKey(filename) {
  if (!filename || !fs.existsSync(filename)) return "";
  const line = fs.readFileSync(filename, "utf8").split(/\r?\n/).find(row => /^\s*ARK_API_KEY\s*=/.test(row));
  if (!line) return "";
  return line.slice(line.indexOf("=") + 1).trim().replace(/^['"]|['"]$/g, "");
}
function sha(bytes) { return crypto.createHash("sha256").update(bytes).digest("hex"); }
function delay(ms) { return new Promise(resolve => setTimeout(resolve, ms)); }

class ArkCharacterAI {
  constructor(options = {}) {
    this.fetch = options.fetch || globalThis.fetch;
    this.key = options.key === undefined ? (process.env.ARK_API_KEY || envKey(process.env.CIKE_ARK_ENV)) : options.key;
    this.imageModel = options.imageModel || process.env.CIKE_SEEDREAM_MODEL || "doubao-seedream-5-0-pro-260628";
    this.videoModel = options.videoModel || process.env.CIKE_SEEDANCE_MODEL || "doubao-seedance-2-5-260628";
    this.fixture = options.fixture === undefined ? process.env.CIKE_CHARACTER_PIPELINE_FIXTURE === "1" : options.fixture;
    this.fixtureVideo = options.fixtureVideo || process.env.CIKE_CHARACTER_FIXTURE_VIDEO || "";
    this.userData = options.userData || "";
    this.python = options.python || process.env.CIKE_CHARACTER_PYTHON || "python3";
    this.transparentScript = options.transparentScript || "";
  }
  status() {
    return { ready: !!this.key || this.fixture, provider: this.fixture ? "本地流程替身" : "火山方舟", imageModel: this.imageModel, videoModel: this.videoModel, mode: this.fixture ? "fixture" : this.key ? "owner-api-key" : "missing-key" };
  }
  candidatePrompt(style, index) {
    if (!STYLES[style] || !Number.isInteger(index) || index < 0 || index > 5) throw Error("未知风格或候选编号");
    const variations = ["balanced natural", "portrait-feature preserving", "cute chibi", "refined clear", "lively", "minimal durable"];
    return `${STYLES[style]}. Create one original non-photoreal full-body desktop companion from the authorized reference. Preserve visible face relationships, hairstyle, hair color, signature accessories and outfit color family. Candidate interpretation: ${variations[index]}. Centered neutral standing pose, complete body and feet, plain warm off-white background, no prop, text, logo, watermark, extra person or sensitive-attribute inference.`;
  }
  firstFramePrompt(style, label) {
    if (!STYLES[style] || label !== "喝水") throw Error("当前试映只开放喝水动作");
    return `${STYLES[style]}. Edit the selected character reference into a production first frame for a desktop animation. Preserve exactly the same face, hairstyle, proportions, outfit, palette and accessories. Full body centered and fully visible. The character holds one small plain pink cup steadily with both hands at lower chest level, believable attached hands, preparing to drink. No table, no other prop, no text, no watermark. Use a perfectly flat vivid chroma green background #00FF00 with no texture, gradient, shadow, green reflection or scenery. Keep generous empty green margin around the complete silhouette.`;
  }
  videoPrompt(label) {
    if (label !== "喝水") throw Error("当前试映只开放喝水动作");
    return "Locked camera and fixed full-body framing. The same character gently raises the same cup with both hands to the mouth, takes one small sip, then lowers the cup back to the exact starting position. Preserve face, hair, accessories, outfit, anatomy, scale and cup. The vivid green background remains perfectly flat and unchanged. No camera motion, zoom, new object, table, text or scene. Smooth subtle motion, seamless calm ending.";
  }
  async image(reference, prompt) {
    const input = dataImage(reference);
    if (this.fixture) return { image: reference, usage: { fixture: true }, bytes: input.bytes, format: format(input.bytes) };
    if (!this.key) throw Error("后台尚未配置 ARK_API_KEY，不会产生付费请求");
    const response = await this.fetch(IMAGE_URL, { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${this.key}` }, body: JSON.stringify({ model: this.imageModel, prompt, image: input.url, size: "2K", stream: false, response_format: "b64_json", watermark: false }) });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) throw Error(body.error?.message || `Seedream返回${response.status}`);
    const encoded = body.data?.[0]?.b64_json;
    if (!encoded) throw Error("Seedream没有返回图片");
    const bytes = Buffer.from(encoded, "base64"), kind = format(bytes);
    return { image: `data:${kind.mime};base64,${encoded}`, usage: body.usage || null, bytes, format: kind };
  }
  async candidate(reference, style, index) { return this.image(reference, this.candidatePrompt(style, index)); }
  async ark(url, options = {}) {
    const response = await this.fetch(url, { ...options, headers: { "Content-Type": "application/json", Authorization: `Bearer ${this.key}`, ...(options.headers || {}) } });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) throw Error(body.error?.message || `Seedance返回${response.status}`);
    return body;
  }
  async download(url, destination) {
    const response = await this.fetch(url);
    if (!response.ok) throw Error(`视频下载失败：${response.status}`);
    const bytes = Buffer.from(await response.arrayBuffer());
    fs.writeFileSync(destination, bytes, { flag: "wx" });
    return { bytes: bytes.length, sha256: sha(bytes) };
  }
  runTransparent(source, output) {
    return new Promise((resolve, reject) => {
      const child = spawn(this.python, [this.transparentScript, "--input", source, "--output-dir", output], { stdio: ["ignore", "pipe", "pipe"] });
      let stdout = "", stderr = "";
      child.stdout.on("data", chunk => stdout += chunk);
      child.stderr.on("data", chunk => stderr += chunk);
      child.on("error", reject);
      child.on("close", code => code === 0 ? resolve(JSON.parse(stdout)) : reject(Error((stderr || stdout || `透明化失败：${code}`).slice(-3000))));
    });
  }
  async actionVideo({ character, style, label, authorizationConfirmed }, progress = () => {}) {
    if (authorizationConfirmed !== true) throw Error("请先确认图片授权");
    dataImage(character);
    if (!this.userData) throw Error("后台输出目录未初始化");
    const jobId = `character-${new Date().toISOString().replace(/[-:.TZ]/g, "").slice(0, 14)}-${crypto.randomBytes(3).toString("hex")}`;
    const dir = path.join(this.userData, "character-jobs", jobId);
    fs.mkdirSync(path.dirname(dir), { recursive: true });
    fs.mkdirSync(dir, { recursive: false });
    const manifest = { jobId, createdAt: new Date().toISOString(), provider: "volcengine-ark", imageModel: this.imageModel, videoModel: this.videoModel, label, status: "starting", steps: [] };
    const save = () => fs.writeFileSync(path.join(dir, "manifest.json"), JSON.stringify(manifest, null, 2));
    save();
    progress({ stage: "first-frame", text: "正在生成角色与杯子的动作首帧…" });
    const first = await this.image(character, this.firstFramePrompt(style, label));
    const firstPath = path.join(dir, `first-frame.${first.format.ext}`);
    fs.writeFileSync(firstPath, first.bytes, { flag: "wx" });
    manifest.steps.push({ id: "first-frame", usage: first.usage, sha256: sha(first.bytes), file: path.basename(firstPath) }); save();
    progress({ stage: "video", text: "首帧完成，正在生成4秒连续动作，通常需要几分钟…" });
    let sourcePath = path.join(dir, this.fixture && path.extname(this.fixtureVideo).toLowerCase() === ".webm" ? "source.webm" : "source.mp4"), videoMeta;
    if (this.fixture) {
      if (!this.fixtureVideo || !fs.existsSync(this.fixtureVideo)) throw Error("缺少本地动作视频替身");
      fs.copyFileSync(this.fixtureVideo, sourcePath); videoMeta = { fixture: true };
    } else {
      const firstUrl = `data:${first.format.mime};base64,${first.bytes.toString("base64")}`;
      const created = await this.ark(VIDEO_URL, { method: "POST", body: JSON.stringify({ model: this.videoModel, content: [{ type: "text", text: this.videoPrompt(label) }, { type: "image_url", image_url: { url: firstUrl }, role: "first_frame" }], duration: 4, resolution: "720p", ratio: "adaptive", generate_audio: false, watermark: false, return_last_frame: true }) });
      manifest.taskId = created.id; manifest.status = created.status || "queued"; save();
      const deadline = Date.now() + 20 * 60 * 1000;
      let result;
      while (Date.now() < deadline) {
        await delay(10000);
        result = await this.ark(`${VIDEO_URL}/${encodeURIComponent(created.id)}`);
        manifest.status = result.status; manifest.updatedAt = new Date().toISOString(); save();
        progress({ stage: "video", text: result.status === "running" ? "正在生成连续动作…" : `动作任务：${result.status}` });
        if (result.status === "succeeded") break;
        if (["failed", "cancelled", "expired"].includes(result.status)) throw Error(`动作生成${result.status}：${result.error?.message || "未知原因"}`);
      }
      if (result?.status !== "succeeded" || !result.content?.video_url) throw Error("动作生成超时或没有返回视频；没有自动重试扣费");
      videoMeta = await this.download(result.content.video_url, sourcePath);
      videoMeta.usage = result.usage || null; videoMeta.seed = result.seed || null;
    }
    manifest.steps.push({ id: "video", ...videoMeta, file: path.basename(sourcePath) }); save();
    progress({ stage: "matte", text: "动作完成，正在本机生成透明背景…" });
    const transparentDir = path.join(dir, "transparent");
    let matte, webm;
    if (this.fixture && path.extname(sourcePath).toLowerCase() === ".webm") {
      fs.mkdirSync(transparentDir);
      webm = path.join(transparentDir, "drink-water-transparent.webm");
      fs.copyFileSync(sourcePath, webm);
      matte = { alphaCoverage: { fixture: true } };
    } else {
      matte = await this.runTransparent(sourcePath, transparentDir);
      webm = path.join(transparentDir, "drink-water-transparent.webm");
    }
    manifest.status = "complete"; manifest.completedAt = new Date().toISOString(); manifest.steps.push({ id: "transparent", output: path.relative(dir, webm), alphaCoverage: matte.alphaCoverage }); save();
    progress({ stage: "complete", text: "透明动作已完成，正在送到桌面试映。" });
    return { jobId, webm, manifest: path.join(dir, "manifest.json"), firstFrame: first.image, usage: { image: first.usage, video: videoMeta.usage || null } };
  }
}

module.exports = { ArkCharacterAI, dataImage, STYLES };
