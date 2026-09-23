const api = window.cike,
  form = document.querySelector("#form"),
  status = document.querySelector("#status");
let savedAppearance;
function render(s) {
  savedAppearance = s.appearance;
  if (s.moment) {
    showMoment(s.moment);
    document.querySelector("#rhythm-info").textContent = s.moment.rhythmValid
      ? "已识别你的作息，起床和收尾的句子会跟着你。"
      : "作息暂未识别，当前按本地时间陪伴；仍可保留你的文字供 AI 生成使用。";
  }
  for (const [k, v] of Object.entries({ ...s.profile, ...s.settings })) {
    const el = form.elements[k];
    if (el) el.type === "checkbox" ? (el.checked = v) : (el.value = v);
  }
  document.querySelector("#library").textContent =
    `当前：${s.custom.length ? s.custom.length + " 条专属建议" : (s.libraryInfo?.builtin || 136) + " 条内置建议"} · 已屏蔽 ${s.memory.blocked.length} 条 · 初次见面 ${new Date(s.memory.firstSeen).toLocaleDateString()}`;
}
function values() {
  const profile = {},
    settings = {};
  for (const k of ["nickname", "joys", "rhythm", "tone", "avoid"])
    profile[k] = form.elements[k].value;
  for (const k of ["interval", "dailyMax", "quietStart", "quietEnd"])
    settings[k] = Number(form.elements[k].value);
  for (const k of ["enabled", "reducedMotion"])
    settings[k] = form.elements[k].checked;
  return { profile, settings };
}
async function run(fn) {
  try {
    const result = await fn();
    status.textContent = typeof result === "string" ? result : "已经记住了。";
  } catch (e) {
    status.textContent = e.message;
  }
}
api.call("get").then(render);
api.on("state", render);
form.addEventListener("submit", (e) => {
  e.preventDefault();
  run(() => api.call("save", values()));
});
for (const id of ["import", "clear-custom", "export", "reset"])
  document.getElementById(id).onclick = () => run(() => api.call(id));
document.querySelector("#prompt").onclick = () =>
  run(async () => {
    await api.call("save", values());
    const text = await api.call("prompt");
    const el = document.querySelector("#prompt-text");
    el.hidden = false;
    el.value = text;
    el.focus();
    el.select();
    return "提示词已选中，按 ⌘C / Ctrl+C 复制。发送给外部 AI 前，请确认愿意分享这五项偏好。";
  });

function showMoment(moment) {
  document.querySelector("#moment-now").textContent =
    `此刻 ${moment.time} · ${moment.label}`;
}
document.querySelector("#preview").onclick = async () => {
  const button = document.querySelector("#preview");
  button.disabled = true;
  try {
    const result = await api.call(
      "preview",
      document.querySelector("#preview-time").value,
    );
    const action = result.item?.action;
    document.querySelector("#preview-title").textContent =
      action?.title || "这一刻，陪你待着";
    document.querySelector("#preview-duration").textContent = action
      ? "约 " + action.duration
      : "";
    document.querySelector("#preview-closing").textContent =
      action?.closing || "";
    document.querySelector("#preview-illustration").src = action
      ? `../assets/scenes/${action.illustration}${result.moment.mood === "night" ? "-night" : ""}.svg`
      : "../assets/creature.svg";
    if (result.item?.image) document.querySelector("#preview-illustration").src=result.item.image;
    if (action && savedAppearance && !result.item?.image) {
      document.querySelector("#preview-illustration").src = await api.call(
        "art",
        {
          illustration: action.illustration,
          ...(action.motionId
            ? { motionId: action.motionId, animate: false }
            : {}),
          night: result.moment.mood === "night",
          appearance: savedAppearance,
        },
      );
    }
    document.querySelector("#preview-illustration").alt = action
      ? "小纸团的生活场景：" + action.title
      : "安静的小纸团";
    document.querySelector("#preview-text").textContent =
      result.item?.text || "这一刻，我们就安静待着。";
    document.querySelector("#preview-reason").textContent =
      `${result.moment.time} · ${result.reason}`;
  } catch (e) {
    document.querySelector("#preview-reason").textContent = e.message;
  } finally {
    button.disabled = false;
  }
};
setInterval(
  () =>
    api
      .call("moment")
      .then(showMoment)
      .catch(() => {}),
  60000,
);

document
  .querySelector("#preview-illustration")
  .addEventListener("error", () => {
    const img = document.querySelector("#preview-illustration");
    if (!img.src.endsWith("/creature.svg")) {
      img.src = "../assets/creature.svg";
      img.alt = "安静的小纸团";
    }
  });

document.querySelector("#laboratory").onclick = () =>
  run(() => api.call("laboratory"));

document.querySelector("#studio").onclick = () => run(() => api.call("studio"));

document.querySelector("#voice-room").onclick = () => window.cike.call("voice-room");
