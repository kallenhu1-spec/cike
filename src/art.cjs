const fs = require("node:fs"),
  path = require("node:path");
const appearance = require("./appearance.js");
const { ILLUSTRATIONS } = require("./core.cjs");
const original = fs
  .readFileSync(path.join(__dirname, "../assets/creature.svg"), "utf8")
  .replace(/^<svg[^>]*>/, "")
  .replace(/<\/svg>\s*$/, "");
const cache = new Map();
module.exports = function art(input) {
  if (
    !input ||
    !ILLUSTRATIONS.includes(input.illustration) ||
    typeof input.night !== "boolean"
  )
    throw Error("场景无效");
  const a = appearance.validate(input.appearance);
  if (input.gesture !== undefined) {
    if (!["ready", "done"].includes(input.gesture)) throw Error("手势无效");
    const done = input.gesture === "done";
    const actor = appearance.inner({ ...a, expression: done ? "happy" : "smile" })
      .replace('<path d="M51 126Q36 116 34 129M180 128Q195 117 195 130" fill="none"/>', "");
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="600" height="320" viewBox="0 0 600 320">
      <ellipse cx="302" cy="279" rx="185" ry="14" fill="#d9dfc8" opacity=".5"/>
      <g transform="translate(170 24) scale(1.2)">${actor}
      <g fill="${a.skinColor}" stroke="#756a55" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round">
      <path d="M179 131Q210 128 210 96L208 75Q208 69 212 70L216 83L216 61Q218 56 221 61L223 80L225 58Q228 54 231 60L231 80L235 64Q239 61 240 67L238 88Q246 76 250 82L239 108Q230 120 217 115" />
      <path d="M52 129Q38 115 33 128" fill="none"/></g>
      ${done ? '<g stroke="#c9a254" stroke-width="3" stroke-linecap="round"><path d="M250 49L258 39M260 67L275 64M247 101L260 109"/></g>' : ""}
      </g></svg>`;
    return "data:image/svg+xml;base64," + Buffer.from(svg).toString("base64");
  }
  if (input.motionId !== undefined) {
    const def = require("./motions.js").definitions[input.motionId];
    if (!def || def.illustration !== input.illustration)
      throw Error("动作与场景不匹配");
    const svg = require("./motion-art.cjs")({
      ...input,
      appearance: a,
      animate: input.animate === true,
    });
    return "data:image/svg+xml;base64," + Buffer.from(svg).toString("base64");
  }
  const name = input.illustration + (input.night ? "-night" : "");
  if (!cache.has(name))
    cache.set(
      name,
      fs.readFileSync(
        path.join(__dirname, "../assets/scenes", name + ".svg"),
        "utf8",
      ),
    );
  const svg = cache
    .get(name)
    .replace(
      original,
      appearance.isOriginal(a) ? original : appearance.inner(a),
    );
  return "data:image/svg+xml;base64," + Buffer.from(svg).toString("base64");
};
