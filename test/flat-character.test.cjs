const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const design = require("../src/appearance.js");

const root = path.resolve(__dirname, "..");
const html = fs.readFileSync(path.join(root, "src/pet.html"), "utf8");
const css = fs.readFileSync(path.join(root, "src/pet.css"), "utf8");
const js = fs.readFileSync(path.join(root, "src/pet.js"), "utf8");

test("0.12.5 默认桌面使用平面小团子分层资产", () => {
  for (const name of ["body-v1.svg", "arm-v1.svg", "cup-v1.svg"]) {
    const relative = `assets/flat-dango/${name}`;
    const source = fs.readFileSync(path.join(root, relative), "utf8");
    assert.match(source, /^<svg/);
    assert.match(html, new RegExp(relative.replaceAll("/", "\\/")));
  }
  assert.doesNotMatch(html, /paper-dango\/base-v2\.png/);
  assert.match(html, /class="flat-eye flat-eye-left"/);
  assert.match(html, /class="flat-arm flat-arm-right"/);
});

test("平面眼睛保持克制比例并能在眼白内注视和眨眼", () => {
  assert.match(css, /\.flat-eye\s*\{[^}]*width:\s*24px;[^}]*height:\s*27px;/s);
  assert.match(css, /\.flat-pupil\s*\{[^}]*width:\s*10px;[^}]*height:\s*13px;/s);
  assert.match(css, /--gaze-x:\s*2px;[\s\S]*--gaze-y:\s*-1px;/);
  assert.match(css, /#living-character\.blinking \.flat-pupil/);
  assert.match(js, /dx \* 6/);
  assert.match(js, /dy \* 4\.5/);
  const master = design.inner(design.defaults());
  assert.match(master, /data-eyes="flat"/);
  assert.match(master, /rx="9\.8" ry="11\.6"/);
});

test("固定肩点手臂完成击掌与5.2秒喝水，不使用漂浮手掌", () => {
  assert.match(css, /\.flat-arm-left\s*\{[^}]*transform-origin:\s*calc\(100% - 5px\) 50%/s);
  assert.match(css, /\.flat-arm-right\s*\{[^}]*transform-origin:\s*5px 50%/s);
  assert.match(css, /flat-sip-cup var\(--sip-duration\)/);
  assert.match(css, /flat-sip-arms var\(--sip-duration\)/);
  assert.doesNotMatch(html, /paper-grip|flat-grip/);
});

test("平面小团子回到低存在感尺寸并保留极轻呼吸", () => {
  assert.match(css, /#living-character\s*\{[^}]*width:\s*200px;[^}]*height:\s*200px;[^}]*scale:\s*\.82;/s);
  assert.match(css, /#pet\[data-life-mode="idle"\] #living-character\s*\{\s*animation:\s*flat-breathe 7\.6s/);
  assert.match(css, /@keyframes flat-breathe/);
});
