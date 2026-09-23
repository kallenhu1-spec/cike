const test = require("node:test"), assert = require("node:assert/strict");
const core = require("../src/core.cjs"), art = require("../src/art.cjs");
test("旧库午饭文案在下午候选耗尽时仍不会漏出，预览也遵守时段", () => {
 const s = core.defaults();
 const row = require("../assets/suggestions.json").find(x => x.action?.title.includes("午饭"));
 for (const hour of [14, 16, 18, 22]) {
   assert.equal(core.choose(s, [row], new Date(2026,8,22,hour), Math.random, {preview:true}), null);
 }
 assert(core.choose(s, [row], new Date(2026,8,22,12), Math.random, {preview:true}));
});
test("击掌沿用用户形象、两阶段可区分且没有循环动画", () => {
 const input={illustration:"window",night:false,appearance:core.defaults().appearance};
 const a=art({...input,gesture:"ready"}), b=art({...input,gesture:"done"});
 assert.notEqual(a,b);
 assert(!Buffer.from(b.split(",")[1],"base64").toString().includes("<animate"));
 assert.throws(()=>art({...input,gesture:"unknown"}));
});
