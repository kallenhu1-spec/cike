const test = require("node:test"),
  assert = require("node:assert/strict");
const fs = require("node:fs"),
  os = require("node:os"),
  path = require("node:path");
const design = require("../src/appearance.js"),
  art = require("../src/art.cjs"),
  core = require("../src/core.cjs");
test("七个时段都有常驻场景，夜晚保留夜色", () => {
  const result = [7, 10, 12, 15, 18, 21, 1].map((h) =>
    core.context({ rhythm: "" }, new Date(2026, 8, 22, h)),
  );
  assert.deepEqual(
    result.map((m) => m.illustration),
    ["water", "note", "meal", "window", "desk", "lamp", "lamp"],
  );
  assert.equal(result[6].mood, "night");
});
test("形象参数拒绝越界、未知轮廓与注入；默认形象不改变旧图", () => {
  assert(design.isOriginal(design.defaults()));
  for (const a of [
    { ...design.defaults(), face: 3 },
    { ...design.defaults(), eyes: NaN },
    { ...design.defaults(), shape: "<script>" },
    { ...design.defaults(), expression: "unknown" },
  ])
    assert.throws(() => design.validate(a));
  assert.throws(() =>
    art({
      illustration: "../../src/main",
      night: false,
      appearance: design.defaults(),
    }),
  );
  const uri = art({
    illustration: "water",
    night: false,
    appearance: design.defaults(),
  });
  assert.equal(
    Buffer.from(uri.split(",")[1], "base64").toString(),
    fs.readFileSync("assets/scenes/water.svg", "utf8"),
  );
});
test("三个形象能进入全部八种昼夜场景，场景内容不丢失", () => {
  for (const appearance of Object.values(design.presets))
    for (const illustration of core.ILLUSTRATIONS)
      for (const night of [false, true]) {
        const svg = Buffer.from(
          art({ illustration, night, appearance }).split(",")[1],
          "base64",
        ).toString();
        assert(svg.includes('viewBox="0 0 600 320"'));
        if (!design.isOriginal(appearance))
          assert(svg.includes(design.inner(appearance)));
        assert(!svg.includes("<script"));
      }
});
test("旧档案保留记忆，新形象重启保留；损坏外观单独回退", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "cike-shape-")),
    file = path.join(dir, "state.json");
  try {
    const s = core.defaults();
    s.profile.nickname = "小夏";
    s.memory.visits = 9;
    delete s.appearance;
    core.save(file, s);
    let r = core.read(file);
    assert.deepEqual(r.appearance, design.defaults());
    assert.equal(r.memory.visits, 9);
    r.appearance = design.presets.round;
    core.save(file, r);
    assert.deepEqual(core.read(file).appearance, design.presets.round);
    r.appearance = { shape: "invalid" };
    core.save(file, r);
    assert.equal(core.read(file).profile.nickname, "小夏");
    assert.deepEqual(core.read(file).appearance, design.defaults());
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
test("主动选择可以排除看过的卡，不改变自动次数，仍遵守屏蔽和禁忌", () => {
  const s = core.defaults(),
    date = new Date(2026, 8, 22, 15),
    library = core.validateLibrary(require("../assets/moments.json"));
  const first = core.choose(s, library, date, () => 0, { preview: true }),
    before = JSON.stringify(s.memory);
  s.memory.blocked.push(first.id);
  const second = core.choose(s, library, date, () => 0, {
    preview: true,
    excludeIds: [first.id],
  });
  assert(second);
  assert.notEqual(first.id, second.id);
  assert.equal(s.memory.dailyCount, JSON.parse(before).dailyCount);
  assert.equal(
    core.choose(s, library, date, () => 0, {
      preview: true,
      excludeIds: library.map((r) => r.id),
    }),
    null,
  );
});
