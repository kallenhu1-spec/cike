const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { ArkCharacterAI } = require("../src/ark-character-ai.cjs");

const png = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Y9Z9FYAAAAASUVORK5CYII=", "base64");
const dataUrl = `data:image/png;base64,${png.toString("base64")}`;

test("喝水视频锁定同一首尾帧、固定镜头并保留透明输出", async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "cike-character-video-"));
  let request;
  try {
    const ai = new ArkCharacterAI({ key: "test-key", userData: dir, transparentScript: "unused.py", pollInterval: 0 });
    ai.image = async () => ({ image: dataUrl, bytes: png, format: { ext: "png", mime: "image/png" }, usage: { test: true } });
    ai.ark = async (_url, options) => {
      if (options) {
        request = JSON.parse(options.body);
        return { id: "task-1", status: "queued" };
      }
      return { status: "succeeded", content: { video_url: "https://example.invalid/video.mp4" }, seed: 7 };
    };
    ai.download = async (_url, destination) => {
      fs.writeFileSync(destination, Buffer.alloc(2048));
      return { bytes: 2048, sha256: "fixture" };
    };
    ai.runTransparent = async (_source, output) => {
      fs.mkdirSync(output);
      fs.writeFileSync(path.join(output, "drink-water-transparent.webm"), Buffer.alloc(2048));
      return { alphaCoverage: { test: true } };
    };
    const result = await ai.actionVideo({ character: dataUrl, style: "3D风", label: "喝水", authorizationConfirmed: true });
    assert.equal(request.duration, 5);
    assert.equal(request.camera_fixed, true);
    assert.equal(request.return_last_frame, true);
    const frames = request.content.filter((item) => item.type === "image_url");
    assert.deepEqual(frames.map((item) => item.role), ["first_frame", "last_frame"]);
    assert.equal(frames[0].image_url.url, frames[1].image_url.url);
    assert.equal(fs.existsSync(result.webm), true);
    assert.equal(JSON.parse(fs.readFileSync(result.manifest, "utf8")).status, "complete");
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
