const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const html = fs.readFileSync(path.join(root, "src/pet.html"), "utf8");
const css = fs.readFileSync(path.join(root, "src/pet.css"), "utf8");
const parts = ["iris-v1.png", "arm-v1.png", "hand-v1.png", "cup-v1.png"];

test("眼睛、手臂、手掌和杯子使用同材质透明分层素材", () => {
  for (const name of parts) {
    const relative = `assets/paper-dango/parts/${name}`;
    const file = path.join(root, relative);
    const png = fs.readFileSync(file);
    assert.equal(png.subarray(1, 4).toString(), "PNG");
    assert.equal(png[25], 6, `${name} 必须保留 RGBA 透明通道`);
    assert.ok(png.length > 20_000, `${name} 不能退化为空白占位图`);
    assert.match(html, new RegExp(relative.replaceAll("/", "\\/")));
  }
  assert.doesNotMatch(css, /\.paper-pupil\s*\{[^}]*radial-gradient/s);
  assert.doesNotMatch(css, /\.paper-arm\s*\{[^}]*linear-gradient/s);
  assert.match(css, /\.paper-grip/);
  assert.match(css, /paper-sip-cup var\(--sip-duration\)/);
});
