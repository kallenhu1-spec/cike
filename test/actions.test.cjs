const { test } = require("node:test"),
  assert = require("node:assert/strict"),
  fs = require("node:fs"),
  os = require("node:os"),
  path = require("node:path");
const core = require("../src/core.cjs");
const rows = [
  ...require("../assets/suggestions.json"),
  ...require("../assets/moments.json"),
];
test("主要内容是有明确动作、用时和边界的卡片，而非纯安慰句", () => {
  const all = core.validateLibrary(rows);
  assert.equal(all.filter((row) => row.action).length, 120);
  assert.equal(all.filter((row) => !row.action).length, 16);
  for (const r of all.filter((row) => row.action)) {
    assert(r.action.title.length <= 18);
    assert(r.action.closing.length <= 32);
    assert(/秒|分钟/.test(r.action.duration));
    assert(
      fs.existsSync(
        path.join(
          __dirname,
          "../assets/scenes",
          r.action.illustration + ".svg",
        ),
      ),
    );
  }
});
test("行动对象严格校验，拒绝不可信图片路径与非法文案", () => {
  const r = rows[0];
  assert.throws(() =>
    core.validateLibrary([
      { ...r, action: { ...r.action, illustration: "../../secret" } },
    ]),
  );
  assert.throws(() =>
    core.validateLibrary([
      { ...r, action: { ...r.action, title: "过".repeat(19) } },
    ]),
  );
  assert.throws(() =>
    core.validateLibrary([
      { ...r, action: { ...r.action, closing: { text: "bad" } } },
    ]),
  );
});
test("禁忌也覆盖行动标题和边界提示，不只检查正文", () => {
  const s = core.defaults();
  s.profile.avoid = "杯子";
  const r = {
    id: "test",
    text: "拿起来，放到顺手的位置。",
    period: "any",
    tags: [],
    action: {
      title: "把杯子放近点",
      duration: "20 秒",
      illustration: "water",
      closing: "只放好这个就行。",
    },
  };
  assert.equal(core.choose(s, [r], new Date(2026, 8, 22, 15)), null);
  r.action.title = "把它放近点";
  r.action.closing = "杯子放好就行。";
  assert.equal(core.choose(s, [r], new Date(2026, 8, 22, 15)), null);
});
test("行动卡导入后的全部字段可持久化，旧文本仍可导入", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "cike-action-")),
    file = path.join(dir, "state.json");
  try {
    const state = core.defaults();
    state.custom = core.validateLibrary([rows[0]]);
    core.save(file, state);
    assert.deepEqual(core.read(file).custom[0].action, rows[0].action);
    assert.equal(
      core.validateLibrary([
        { id: "old", text: "我在，你忙你的。", period: "any", tags: ["陪伴"] },
      ])[0].action,
      undefined,
    );
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
