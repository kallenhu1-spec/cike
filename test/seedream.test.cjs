const test = require("node:test");
const assert = require("node:assert/strict");
const { imagePrompt } = require("../src/seedream.cjs");

test("builds a consistent IP character prompt", () => {
  const prompt = imagePrompt({ purpose: "character", style: "彩绘风" });
  assert.match(prompt, /same character identity/);
  assert.match(prompt, /桌面陪伴/);
  assert.match(prompt, /No text/);
});

test("builds an action prompt from the character reference", () => {
  const prompt = imagePrompt({ purpose: "action", action: "小口喝水", style: "线条风" });
  assert.match(prompt, /same character identity/);
  assert.match(prompt, /小口喝水/);
  assert.match(prompt, /clean line illustration/);
});
