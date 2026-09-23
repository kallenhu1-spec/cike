const fs = require("node:fs");
const moments = require("./moments.cjs");
const ILLUSTRATIONS = [
  "water",
  "window",
  "desk",
  "note",
  "meal",
  "stretch",
  "lamp",
  "music",
];
const PERIODS = ["morning", "afternoon", "night", "any"];
function defaults() {
  return {
    version: 1,
    profile: {
      nickname: "",
      joys: "热茶、窗边、植物",
      rhythm: "09:00–23:00",
      tone: "轻轻陪着",
      avoid: "身材、效率评价",
    },
    settings: {
      enabled: true,
      interval: 90,
      dailyMax: 4,
      quietStart: 23,
      quietEnd: 8,
      reducedMotion: false,
    },
    memory: {
      firstSeen: new Date().toISOString(),
      lastDay: "",
      dailyCount: 0,
      lastAt: 0,
      recent: [],
      blocked: [],
      visits: 0,
      windows: [],
      lastTopic: "",
    },
    custom: [],
    overrides: {},
    image: null,
    appearance: require("./appearance.js").defaults(),
    position: null,
  };
}
function dayKey(date) {
  return `${date.getFullYear()}-${date.getMonth() + 1}-${date.getDate()}`;
}
function period(date) {
  const h = date.getHours();
  return h < 6 || h >= 22 ? "night" : h < 12 ? "morning" : "afternoon";
}
function quiet(hour, start, end) {
  return start === end
    ? false
    : start < end
      ? hour >= start && hour < end
      : hour >= start || hour < end;
}
function validateLibrary(data, exact = false) {
  if (
    !Array.isArray(data) ||
    (exact ? data.length !== 100 : data.length < 1 || data.length > 200)
  )
    throw Error(exact ? "专属库必须恰好 100 条" : "建议库需要 1–200 条");
  const ids = new Set(),
    texts = new Set();
  return data.map((r, i) => {
    if (
      !r ||
      typeof r.id !== "string" ||
      !/^[-a-zA-Z0-9_]{1,64}$/.test(r.id) ||
      ids.has(r.id) ||
      ["__proto__", "constructor", "prototype"].includes(r.id) ||
      typeof r.text !== "string" ||
      r.text.trim().length < 4 ||
      r.text.length > 64 ||
      texts.has(r.text.trim()) ||
      !PERIODS.includes(r.period) ||
      !Array.isArray(r.tags) ||
      r.tags.length > 5 ||
      r.tags.some((t) => typeof t !== "string" || t.length > 16)
    )
      throw Error(`第 ${i + 1} 条格式、长度或重复校验未通过`);
    if (r.image !== undefined && r.image !== null && (typeof r.image !== "string" || !/^data:image\/png;base64,[A-Za-z0-9+/=]+$/.test(r.image) || r.image.length > 4000000)) throw Error("配图格式或大小无效");
    const row = {
      ...(r.image ? {image:r.image} : {}),
      id: r.id,
      text: r.text.trim(),
      period: r.period,
      tags: r.tags,
    };
    if (r.scenes !== undefined) {
      if (
        !Array.isArray(r.scenes) ||
        !r.scenes.length ||
        r.scenes.length > 7 ||
        r.scenes.some((x) => !Object.hasOwn(moments.SCENES, x))
      )
        throw Error(`第 ${i + 1} 条场景无效`);
      row.scenes = [...new Set(r.scenes)];
    }
    if (r.weekdays !== undefined) {
      if (
        !Array.isArray(r.weekdays) ||
        !r.weekdays.length ||
        r.weekdays.length > 7 ||
        r.weekdays.some((x) => !Number.isInteger(x) || x < 0 || x > 6)
      )
        throw Error(`第 ${i + 1} 条星期无效`);
      row.weekdays = [...new Set(r.weekdays)];
    }
    if (r.topic !== undefined) {
      if (typeof r.topic !== "string" || r.topic.length > 16)
        throw Error(`第 ${i + 1} 条主题无效`);
      row.topic = r.topic;
    }
    if (r.action !== undefined) {
      const a = r.action;
      if (
        !a ||
        typeof a !== "object" ||
        Array.isArray(a) ||
        !ILLUSTRATIONS.includes(a.illustration)
      )
        throw Error(`第 ${i + 1} 条行动场景无效`);
      const limits = { title: 18, duration: 12, closing: 32 };
      for (const [key, max] of Object.entries(limits))
        if (typeof a[key] !== "string" || !a[key].trim() || a[key].length > max)
          throw Error(`第 ${i + 1} 条行动文案无效`);
      if (
        a.motionId !== undefined &&
        (!Object.hasOwn(require("./motions.js").definitions, a.motionId) ||
          require("./motions.js").definitions[a.motionId].illustration !==
            a.illustration)
      )
        throw Error(`第 ${i + 1} 条动作与场景不匹配`);
      row.action = {
        ...(a.motionId ? { motionId: a.motionId } : {}),
        title: a.title.trim(),
        duration: a.duration.trim(),
        illustration: a.illustration,
        closing: a.closing.trim(),
      };
    }
    if (r.variants !== undefined) {
      if (
        !r.variants ||
        typeof r.variants !== "object" ||
        Array.isArray(r.variants)
      )
        throw Error(`第 ${i + 1} 条语气无效`);
      row.variants = {};
      for (const [tone, text] of Object.entries(r.variants)) {
        if (
          !["带一点俏皮", "简短留白"].includes(tone) ||
          typeof text !== "string" ||
          text.trim().length < 4 ||
          text.length > 64
        )
          throw Error(`第 ${i + 1} 条语气无效`);
        row.variants[tone] = text.trim();
      }
    }
    ids.add(r.id);
    texts.add(r.text.trim());
    return row;
  });
}
function validateSettings(input) {
  const s = input.settings,
    p = input.profile;
  if (!s || !p) throw Error("设置不完整");
  for (const [key, min, max] of [
    ["interval", 45, 240],
    ["dailyMax", 1, 8],
    ["quietStart", 0, 23],
    ["quietEnd", 0, 23],
  ])
    if (!Number.isInteger(s[key]) || s[key] < min || s[key] > max)
      throw Error("设置数值超出范围");
  if (typeof s.enabled !== "boolean" || typeof s.reducedMotion !== "boolean")
    throw Error("设置格式错误");
  const profile = {};
  for (const key of ["nickname", "joys", "rhythm", "tone", "avoid"]) {
    if (typeof p[key] !== "string" || p[key].length > 160)
      throw Error("档案每项最多 160 字");
    if (key === "nickname" && p[key].trim().length > 24)
      throw Error("称呼最多 24 字");
    profile[key] = p[key].trim();
  }
  return {
    profile,
    settings: {
      enabled: s.enabled,
      interval: s.interval,
      dailyMax: s.dailyMax,
      quietStart: s.quietStart,
      quietEnd: s.quietEnd,
      reducedMotion: s.reducedMotion,
    },
  };
}
function eligible(state, date, idle = 0) {
  const m = state.memory,
    s = state.settings;
  return (
    s.enabled &&
    !quiet(date.getHours(), s.quietStart, s.quietEnd) &&
    idle < 300 &&
    (m.lastDay === dayKey(date) ? m.dailyCount : 0) < s.dailyMax &&
    date.getTime() - m.lastAt >= s.interval * 60000 &&
    !(m.windows || []).includes(moments.budgetWindow(state, date))
  );
}
function choose(state, builtin, date, random = Math.random, options = {}) {
  const m = state.memory,
    moment = moments.context(state.profile, date);
  const avoided = state.profile.avoid
    .split(/[、,，;；\n]/)
    .map((x) => x.trim())
    .filter(Boolean);
  function candidates(library) {
    return library
      .map(row => state.overrides?.[row.id] || row)
      .map((row) => ({
        ...row,
        text: row.variants?.[state.profile.tone] || row.text,
      }))
      .filter(
        (row) =>
          (row.scenes
            ? row.scenes.includes(moment.scene)
            : row.period === "any" || row.period === period(date)) &&
          (!/早餐|早饭/.test([row.text, row.action?.title].join(" ")) || ["wake", "morning"].includes(moment.scene)) &&
          (!/午餐|午饭/.test([row.text, row.action?.title].join(" ")) || moment.scene === "lunch") &&
          (!/晚餐|晚饭/.test([row.text, row.action?.title].join(" ")) || moment.scene === "evening") &&
          (!row.weekdays || row.weekdays.includes(moment.weekday)) &&
          !m.blocked.includes(row.id) &&
          !(options.excludeIds || []).includes(row.id) &&
          (options.preview || !m.recent.includes(row.id)) &&
          !avoided.some((word) =>
            [row.text, row.action?.title, row.action?.closing]
              .filter(Boolean)
              .some((text) => text.includes(word)),
          ),
      );
  }
  let pool = state.custom.length ? candidates(state.custom) : [];
  let source = pool.length ? "personal" : "builtin";
  if (!pool.length) pool = candidates(builtin);
  if (!pool.length) return null;
  // Scene-specific material comes first; legacy four-period libraries still work.
  const specific = pool.filter((row) => row.scenes?.includes(moment.scene));
  if (specific.length) pool = specific;
  const weighted = pool.map((row) => {
    const preferences = row.tags.filter((tag) =>
      state.profile.joys.includes(tag),
    );
    let weight = 1 + preferences.length * 4;
    if (row.weekdays) weight *= 1.5;
    if (row.topic && row.topic === m.lastTopic) weight *= 0.25;
    return { row, weight, preferences };
  });
  let target =
    Math.max(0, Math.min(0.999999, random())) *
    weighted.reduce((sum, x) => sum + x.weight, 0);
  let selected = weighted[weighted.length - 1];
  for (const entry of weighted) {
    target -= entry.weight;
    if (target < 0) {
      selected = entry;
      break;
    }
  }
  const reasons = [moment.label];
  if (moment.source === "rhythm") reasons.push("跟随你的作息");
  if (selected.row.weekdays)
    reasons.push(moment.weekend ? "周末慢一点" : "按今天的星期");
  if (selected.preferences.length)
    reasons.push("记得你喜欢" + selected.preferences.join("、"));
  if (selected.row.variants?.[state.profile.tone])
    reasons.push(state.profile.tone);
  return { ...selected.row, moment, reason: reasons.join(" · "), source };
}
function record(state, item, date) {
  const m = state.memory,
    key = dayKey(date);
  m.dailyCount = (m.lastDay === key ? m.dailyCount : 0) + 1;
  m.lastDay = key;
  m.lastAt = date.getTime();
  m.recent = [...m.recent, item.id].slice(-20);
  const window = moments.budgetWindow(state, date);
  if (window) m.windows = [...(m.windows || []), window].slice(-24);
  m.lastTopic = item.topic || "";
}
function save(file, state) {
  fs.mkdirSync(require("node:path").dirname(file), { recursive: true });
  fs.writeFileSync(file + ".tmp", JSON.stringify(state, null, 2), {
    mode: 0o600,
  });
  fs.renameSync(file + ".tmp", file);
}
function read(file) {
  try {
    const s = JSON.parse(fs.readFileSync(file, "utf8"));
    const d = defaults();
    if (s.version !== 1) throw Error("版本不支持");
    Object.assign(d, validateSettings(s));
    d.custom = s.custom?.length ? validateLibrary(s.custom) : [];
    if (s.overrides && typeof s.overrides === "object") {
      for (const [id,row] of Object.entries(s.overrides)) {
        if (id !== row?.id) throw Error("覆盖内容无效");
        d.overrides[id] = validateLibrary([row])[0];
      }
    }
    if (
      !s.memory ||
      !Array.isArray(s.memory.recent) ||
      !Array.isArray(s.memory.blocked) ||
      !Number.isFinite(s.memory.lastAt) ||
      !Number.isFinite(s.memory.dailyCount)
    )
      throw Error("记忆损坏");
    d.memory = { ...d.memory, ...s.memory };
    if (
      !Array.isArray(d.memory.windows) ||
      d.memory.windows.some((x) => typeof x !== "string")
    )
      d.memory.windows = [];
    if (typeof d.memory.lastTopic !== "string") d.memory.lastTopic = "";
    d.image =
      typeof s.image === "string" &&
      s.image.startsWith("data:image/png;base64,")
        ? s.image
        : null;
    if (s.appearance) {
      try {
        d.appearance = require("./appearance.js").validate(s.appearance);
      } catch {}
    }
    d.position =
      s.position &&
      Number.isInteger(s.position.x) &&
      Number.isInteger(s.position.y)
        ? s.position
        : null;
    return d;
  } catch (e) {
    if (fs.existsSync(file))
      fs.copyFileSync(file, file + ".corrupt-" + Date.now());
    return defaults();
  }
}
function validateBackup(s) {
  if(!s || s.version!==1)throw Error('不是支持的此刻配置备份');
  if(!Array.isArray(s.custom))throw Error('备份内容列表无效');
  const d=defaults();Object.assign(d,validateSettings(s));
  d.custom=s.custom?.length?validateLibrary(s.custom):[];
  for(const [id,row]of Object.entries(s.overrides||{})){if(id!==row?.id)throw Error('覆盖内容无效');d.overrides[id]=validateLibrary([row])[0];}
  if(s.image){validateLibrary([{id:'backup-image',text:'配置图片校验',period:'any',tags:[],image:s.image}]);d.image=s.image;}
  if(s.appearance)d.appearance=require('./appearance.js').validate(s.appearance);
  if(s.memory){
    for(const key of ['recent','blocked','windows'])if(!Array.isArray(s.memory[key])||s.memory[key].some(v=>typeof v!=='string'))throw Error('备份记忆格式无效');
    for(const key of ['lastAt','dailyCount'])if(!Number.isFinite(s.memory[key]))throw Error('备份记忆数值无效');
    d.memory={...d.memory,...s.memory};
  }
  return d;
}
module.exports = {
  validateBackup,
  ...moments,
  ILLUSTRATIONS,
  defaults,
  dayKey,
  period,
  quiet,
  validateLibrary,
  validateSettings,
  eligible,
  choose,
  record,
  save,
  read,
};
