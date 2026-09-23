const { test } = require("node:test"),
  assert = require("node:assert/strict"),
  fs = require("node:fs"),
  os = require("node:os"),
  path = require("node:path"),
  c = require("../src/core.cjs");
const lib = require("../assets/suggestions.json");
test("80 条完整且唯一", () => assert.equal(c.validateLibrary(lib).length, 80));
test("跨午夜安静时段与同小时关闭", () => {
  assert.equal(c.quiet(23, 23, 8), true);
  assert.equal(c.quiet(7, 23, 8), true);
  assert.equal(c.quiet(8, 23, 8), false);
  assert.equal(c.quiet(12, 8, 8), false);
});
test("时段、每日上限、间隔、闲置和停用", () => {
  const s = c.defaults(),
    d = new Date(2026, 8, 21, 14);
  assert(c.eligible(s, d));
  c.record(s, lib[20], d);
  assert(!c.eligible(s, new Date(d.getTime() + 60000)));
  s.memory.dailyCount = 4;
  assert(!c.eligible(s, new Date(d.getTime() + 7200000)));
  assert(c.eligible(s, new Date(2026, 8, 22, 14)));
  assert(!c.eligible(s, new Date(2026, 8, 22, 14), 301));
  s.settings.enabled = false;
  assert(!c.eligible(s, new Date(2026, 8, 22, 14)));
});
test("不重复、不说屏蔽项、不越时段", () => {
  const s = c.defaults(),
    d = new Date(2026, 8, 21, 10);
  s.memory.recent = lib.slice(0, 10).map((x) => x.id);
  s.memory.blocked = lib.slice(10, 20).map((x) => x.id);
  for (let i = 0; i < 40; i++) {
    const r = c.choose(s, lib, d);
    assert.equal(r.period, "any");
    assert(!s.memory.recent.includes(r.id));
  }
});
test("词库耗尽保持安静", () => {
  const s = c.defaults();
  s.memory.blocked = lib.map((x) => x.id);
  assert.equal(c.choose(s, lib, new Date()), null);
});
test("专属导入必须100条、拒绝重复和非法时段", () => {
  assert.throws(() => c.validateLibrary(lib, true));
  assert.throws(() => c.validateLibrary([lib[0], lib[0]]));
  assert.throws(() => c.validateLibrary([{ ...lib[0], period: "bad" }]));
});
test("拒绝不合法设置", () => {
  const s = c.defaults();
  s.settings.dailyMax = 99;
  assert.throws(() => c.validateSettings(s));
});
test("原子持久化重启恢复，损坏备份恢复默认", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "cike-test-")),
    file = path.join(dir, "state.json");
  try {
    const s = c.defaults();
    s.profile.nickname = "小夏";
    c.save(file, s);
    assert.equal(c.read(file).profile.nickname, "小夏");
    fs.writeFileSync(file, "broken");
    assert.equal(c.read(file).profile.nickname, "");
    assert(fs.readdirSync(dir).some((x) => x.includes(".corrupt-")));
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
test("用户禁忌筛除", () => {
  const s = c.defaults();
  s.profile.avoid = "热茶";
  for (let i = 0; i < 50; i++)
    assert(!c.choose(s, lib, new Date(2026, 8, 21, 10)).text.includes("热茶"));
});
