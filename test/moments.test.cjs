const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs"),
  os = require("node:os"),
  path = require("node:path");
const c = require("../src/core.cjs");
const sceneRows = require("../assets/moments.json");
const all = [...require("../assets/suggestions.json"), ...sceneRows];
const at = (hour, minute = 0, day = 22) => new Date(2026, 8, day, hour, minute);
const row = (id, extra = {}) => ({
  id,
  text: "这一刻，轻轻待一会儿。",
  period: "any",
  tags: [],
  ...extra,
});

test("136 条内容合法，56 条新内容覆盖七场景且三种语气都有", () => {
  assert.equal(c.validateLibrary(all).length, 136);
  for (const scene of Object.keys(c.SCENES)) {
    const rows = sceneRows.filter((x) => x.scenes.includes(scene));
    assert.equal(rows.length, 8);
    for (const r of rows) {
      assert(r.variants["带一点俏皮"]);
      assert(r.variants["简短留白"]);
    }
  }
});
test("时段边界精确到分钟，作息为空时使用本地时钟", () => {
  const s = c.defaults();
  s.profile.rhythm = "";
  const cases = [
    [5, 59, "late"],
    [6, 0, "wake"],
    [8, 59, "wake"],
    [9, 0, "morning"],
    [11, 29, "morning"],
    [11, 30, "lunch"],
    [13, 59, "lunch"],
    [14, 0, "afternoon"],
    [17, 29, "afternoon"],
    [17, 30, "evening"],
    [20, 0, "winddown"],
    [23, 0, "late"],
  ];
  for (const [h, m, scene] of cases)
    assert.equal(c.context(s.profile, at(h, m)).scene, scene);
});
test("作息支持跨午夜；无效文本回退，不误识别24时与极短作息", () => {
  assert.deepEqual(c.parseRhythm("10:30–02:00"), {
    wake: 630,
    sleep: 120,
    awakeMinutes: 930,
  });
  assert(c.parseRhythm("9:00 至 23:00"));
  for (const value of [
    "24:00-02:00",
    "09:90-23:00",
    "晚上很晚睡",
    "09:00-09:00",
    "09:00-10:00",
  ])
    assert.equal(c.parseRhythm(value), null);
});
test("起床90分钟与休息前60分钟跟随个人作息", () => {
  const p = { rhythm: "11:00–02:00" };
  assert.equal(c.context(p, at(12, 29)).scene, "wake");
  assert.equal(c.context(p, at(12, 30)).scene, "lunch");
  assert.equal(c.context(p, at(1, 0)).scene, "winddown");
  assert.equal(c.context(p, at(1, 59)).source, "rhythm");
  assert.equal(c.context(p, at(2)).scene, "late");
});
test("全天机会均匀分散，同一时间段不连发，错过不补发", () => {
  const s = c.defaults();
  s.settings.interval = 45;
  assert(c.eligible(s, at(8)));
  c.record(s, row("a"), at(8));
  assert(!c.eligible(s, at(9)));
  assert(!c.eligible(s, at(11, 44)));
  assert(c.eligible(s, at(11, 45)));
  c.record(s, row("b"), at(11, 45));
  assert(c.eligible(s, at(15, 30)));
  c.record(s, row("c"), at(15, 30));
  assert(c.eligible(s, at(19, 15)));
  c.record(s, row("d"), at(19, 15));
  assert(!c.eligible(s, at(22)));
  assert(!c.eligible(s, at(23)));
  const lateStart = c.defaults();
  c.record(lateStart, row("e"), at(20));
  assert(!c.eligible(lateStart, at(22)));
});
test("跨午夜的活跃时段使用同一个时间段标识，安静时段仍优先", () => {
  const s = c.defaults();
  s.settings.quietStart = 8;
  s.settings.quietEnd = 20;
  s.settings.dailyMax = 2;
  assert.equal(c.budgetWindow(s, at(23)), c.budgetWindow(s, at(0, 30, 23)));
  c.record(s, row("a"), at(23));
  assert(!c.eligible(s, at(0, 30, 23)));
  assert(c.eligible(s, at(2, 0, 23)));
  assert(!c.eligible(s, at(9, 0, 23)));
});
test("每个场景只选对应内容；周末与周一专属句不会在周二出现", () => {
  const s = c.defaults();
  for (const h of [8, 10, 12, 15, 18, 22, 0])
    for (let i = 0; i < 20; i++) {
      const r = c.choose(s, all, at(h), () => i / 20);
      assert(r.scenes.includes(c.context(s.profile, at(h)).scene));
      assert(!r.weekdays || r.weekdays.includes(2));
    }
  const weekend = row("weekend", { scenes: ["lunch"], weekdays: [0, 6] });
  assert.equal(c.choose(s, [weekend], at(12)), null);
  assert.equal(c.choose(s, [weekend], at(12, 0, 26)).id, "weekend");
});
test("偏好提高相关句子概率，近期同主题会降权", () => {
  const s = c.defaults();
  s.profile.joys = "植物";
  const rows = [
    row("tea", {
      text: "让一杯茶陪着这一会儿。",
      tags: ["热茶"],
      scenes: ["afternoon"],
      topic: "饮品",
    }),
    row("plant", {
      text: "让一点绿色陪着这一会儿。",
      tags: ["植物"],
      scenes: ["afternoon"],
      topic: "植物",
    }),
  ];
  assert.equal(c.choose(s, rows, at(15), () => 0.3).id, "plant");
  s.memory.lastTopic = "植物";
  assert.equal(c.choose(s, rows, at(15), () => 0.3).id, "tea");
});
test("语气立即改变本地文本，禁忌过滤实际展示的版本", () => {
  const s = c.defaults(),
    r = row("tone", {
      variants: {
        简短留白: "热茶，轻轻陪着。",
        带一点俏皮: "小纸团今天也有点慢。",
      },
    });
  s.profile.tone = "简短留白";
  assert.equal(c.choose(s, [r], at(15)).text, "热茶，轻轻陪着。");
  s.profile.avoid = " 热茶 ";
  assert.equal(c.choose(s, [r], at(15)), null);
  s.profile.tone = "带一点俏皮";
  assert.equal(c.choose(s, [r], at(15)).text, "小纸团今天也有点慢。");
});
test("预览不改变记忆，可听近期句，但仍遵守屏蔽与禁忌", () => {
  const s = c.defaults(),
    r = row("seen");
  s.memory.recent = ["seen"];
  const before = JSON.stringify(s.memory);
  assert.equal(c.choose(s, [r], at(15)), null);
  assert(c.choose(s, [r], at(15), Math.random, { preview: true }));
  assert.equal(JSON.stringify(s.memory), before);
  s.memory.blocked = ["seen"];
  assert.equal(c.choose(s, [r], at(15), Math.random, { preview: true }), null);
  assert.throws(() => c.previewDate("25:01"));
  assert.throws(() => c.previewDate({ time: "12:00" }));
  assert.equal(c.previewDate("12:15", at(9)).getHours(), 12);
});
test("新场景字段导入并重启保留，旧档案无新增记忆字段也能恢复", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "cike-moments-")),
    file = path.join(dir, "memory.json");
  try {
    const s = c.defaults();
    delete s.memory.windows;
    delete s.memory.lastTopic;
    s.custom = [sceneRows[0]];
    c.save(file, s);
    const reopened = c.read(file);
    assert.deepEqual(reopened.memory.windows, []);
    assert.deepEqual(reopened.custom[0].scenes, ["wake"]);
    assert(reopened.custom[0].variants["简短留白"]);
    assert.throws(() =>
      c.validateLibrary([row("invalid", { scenes: ["unknown"] })]),
    );
    assert.throws(() => c.validateLibrary([row("invalid", { weekdays: [9] })]));
    assert.throws(() =>
      c.validateLibrary([row("invalid", { variants: { 简短留白: null } })]),
    );
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
test("旧版四时段专属库仍然优先，无匹配才回到本地场景库", () => {
  const s = c.defaults();
  s.custom = [
    row("personal", { period: "morning", text: "这是你专属的上午陪伴。" }),
  ];
  assert.equal(c.choose(s, all, at(10)).id, "personal");
  assert.equal(c.choose(s, all, at(15)).source, "builtin");
});
