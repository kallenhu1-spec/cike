// Only local clock and explicitly supplied preferences are used. No activity inference.
const SCENES = {
  wake: { label: "慢慢醒来", mood: "morning" },
  morning: { label: "上午的小空隙", mood: "morning" },
  lunch: { label: "午饭前后", mood: "afternoon" },
  afternoon: { label: "午后的松口气", mood: "afternoon" },
  evening: { label: "傍晚的日常", mood: "afternoon" },
  winddown: { label: "准备收尾", mood: "night" },
  late: { label: "夜里轻一点", mood: "night" },
};
const mod = (n) => ((n % 1440) + 1440) % 1440;
function parseRhythm(value) {
  const match = String(value)
    .trim()
    .match(/^(\d{1,2}):([0-5]\d)\s*[-–—~～至]\s*(\d{1,2}):([0-5]\d)$/);
  if (!match || +match[1] > 23 || +match[3] > 23) return null;
  const wake = +match[1] * 60 + +match[2],
    sleep = +match[3] * 60 + +match[4];
  const awakeMinutes = mod(sleep - wake);
  if (awakeMinutes < 240 || awakeMinutes > 1320) return null;
  return { wake, sleep, awakeMinutes };
}
function context(profile, date) {
  const minute = date.getHours() * 60 + date.getMinutes();
  let scene =
    minute < 360 || minute >= 1380
      ? "late"
      : minute < 540
        ? "wake"
        : minute < 690
          ? "morning"
          : minute < 840
            ? "lunch"
            : minute < 1050
              ? "afternoon"
              : minute < 1200
                ? "evening"
                : "winddown";
  let source = "clock";
  const rhythm = parseRhythm(profile.rhythm);
  if (rhythm) {
    if (mod(minute - rhythm.wake) < 90) {
      scene = "wake";
      source = "rhythm";
    } else if (
      mod(rhythm.sleep - minute) > 0 &&
      mod(rhythm.sleep - minute) <= 60
    ) {
      scene = "winddown";
      source = "rhythm";
    }
    // Outside configured awake hours, do not assume the user actually is sleeping.
  }
  return {
    scene,
    ...SCENES[scene],
    illustration: {
      wake: "water",
      morning: "note",
      lunch: "meal",
      afternoon: "window",
      evening: "desk",
      winddown: "lamp",
      late: "lamp",
    }[scene],
    time: `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`,
    weekday: date.getDay(),
    weekend: [0, 6].includes(date.getDay()),
    source,
    rhythmValid: !!rhythm,
  };
}
function localDay(date) {
  return `${date.getFullYear()}-${date.getMonth() + 1}-${date.getDate()}`;
}
// Reserve opportunities throughout the non-quiet interval, rather than spending
// the entire daily allowance in the first few hours. Missed windows are not queued.
function budgetWindow(state, date) {
  const s = state.settings,
    minute = date.getHours() * 60 + date.getMinutes();
  const start = s.quietStart === s.quietEnd ? 0 : s.quietEnd * 60;
  const duration =
    s.quietStart === s.quietEnd ? 1440 : mod(s.quietStart * 60 - start);
  const elapsed = mod(minute - start);
  if (elapsed >= duration) return null;
  const anchor = new Date(date);
  if (minute < start) anchor.setDate(anchor.getDate() - 1);
  const index = Math.floor((elapsed * s.dailyMax) / duration);
  return `${localDay(anchor)}:${start}:${duration}:${s.dailyMax}:${index}`;
}
function previewDate(value, now = new Date()) {
  if (value === "now") return new Date(now);
  if (typeof value !== "string" || !/^([01]\d|2[0-3]):[0-5]\d$/.test(value))
    throw Error("请选择有效的预览时间");
  const date = new Date(now);
  const [h, m] = value.split(":").map(Number);
  date.setHours(h, m, 0, 0);
  return date;
}
module.exports = { SCENES, parseRhythm, context, budgetWindow, previewDate };
