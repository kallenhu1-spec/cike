const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const html = fs.readFileSync(path.join(root, "src/pet.html"), "utf8");
const css = fs.readFileSync(path.join(root, "src/pet.css"), "utf8");
const js = fs.readFileSync(path.join(root, "src/pet.js"), "utf8");
const parts = ["iris-v2.png", "arm-v1.png", "hand-v1.png", "cup-v1.png"];

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

test("母版比例眼睛放大、裁在眼白内并能移动到边缘", () => {
  const base = path.join(root, "assets/paper-dango/base-v2.png");
  const png = fs.readFileSync(base);
  assert.equal(png.subarray(1, 4).toString(), "PNG");
  assert.equal(png[25], 6, "base-v2.png 必须保留 RGBA 透明通道");
  assert.ok(png.length > 100_000, "母版底图不能退化为空白占位图");
  assert.match(html, /assets\/paper-dango\/base-v2\.png/);
  assert.match(css, /\.paper-eye\s*\{[^}]*overflow:\s*hidden/s);
  assert.match(css, /\.paper-pupil\s*\{[^}]*width:\s*38px;[^}]*height:\s*42px/s);
  assert.match(css, /--gaze-x:\s*3px;[\s\S]*--gaze-y:\s*-4px;/);
  assert.match(css, /#living-character\s*\{[^}]*scale:\s*\.88;/s);
  assert.match(js, /dx \* 8\.5/);
  assert.match(js, /dy \* 6\.5/);
});
