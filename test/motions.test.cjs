const test = require("node:test"),
  assert = require("node:assert/strict"),
  fs = require("node:fs"),
  path = require("node:path"),
  os = require("node:os");
const core = require("../src/core.cjs"),
  motionArt = require("../src/motion-art.cjs"),
  design = require("../src/appearance.js"),
  { definitions, ids } = require("../src/motions.js");
const rows = [
  ...require("../assets/suggestions.json"),
  ...require("../assets/moments.json"),
];
test("120 条行动均有明确动作，35 种动作都有真实文案覆盖", () => {
  const actions = core.validateLibrary(rows).filter((r) => r.action);
  assert.equal(actions.length, 120);
  assert.equal(new Set(actions.map((r) => r.action.motionId)).size, 35);
  for (const row of actions)
    assert.equal(
      row.action.illustration,
      definitions[row.action.motionId].illustration,
    );
  const pick = (id) => actions.find((r) => r.id === id).action.motionId;
  assert.equal(pick("moment-wake-01"), "sip");
  assert.equal(pick("moment-lunch-04"), "rinse-cup");
  assert.equal(pick("moment-winddown-07"), "place-cup");
  assert.equal(pick("moment-late-02"), "screen-dim");
  assert.equal(pick("moment-late-04"), "save-file");
  assert.equal(pick("moment-morning-06"), "wipe-leaf");
});
test("动效导入拒绝未知动作、动作场景错配，旧库无动作仍可使用", () => {
  const r = rows[0];
  assert.throws(() =>
    core.validateLibrary([
      { ...r, action: { ...r.action, motionId: "unknown" } },
    ]),
  );
  assert.throws(() =>
    core.validateLibrary([
      { ...r, action: { ...r.action, motionId: "close-book" } },
    ]),
  );
  const legacy = { ...r, action: { ...r.action } };
  delete legacy.action.motionId;
  assert.equal(core.validateLibrary([legacy])[0].action.motionId, undefined);
});
test("每个动作只有一次 3.2 秒时间线，静态输出无动画且与动图不同", () => {
  const stills = new Set();
  for (const motionId of ids)
    for (const night of [true, false])
      for (const appearance of Object.values(design.presets)) {
        const args = { motionId, night, appearance };
        const still = motionArt({ ...args, animate: false }),
          animated = motionArt({ ...args, animate: true });
        assert(!still.includes("<animate"));
        assert(animated.includes('repeatCount="1"'));
        assert(!animated.includes("indefinite"));
        assert(!animated.includes("<script"));
        assert(!animated.includes("http:", 50));
        assert.notEqual(still, animated);
        assert(animated.includes('dur="3.2s"'));
        stills.add(still);
      }
  assert.equal(stills.size, 35 * 2 * 3);
});
test("动作字段保存重启不丢失，不接受用户 SVG 或资源路径", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "cike-motion-"));
  try {
    const s = core.defaults();
    s.custom = core.validateLibrary([rows[0]]);
    const f = path.join(dir, "state.json");
    core.save(f, s);
    assert.equal(core.read(f).custom[0].action.motionId, "pour-water");
    assert.throws(() =>
      motionArt({
        motionId: "../../file",
        appearance: design.defaults(),
        night: false,
        animate: true,
      }),
    );
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
