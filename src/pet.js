const api = window.cike,
  pet = document.querySelector("#pet"),
  bubble = document.querySelector("#bubble");
let state,
  timer,
  dragging = false,
  held = false,
  activeItem = null;
let currentMoment;
let idleStep = 0, fivePhase = "", fiveTimer, fiveRevision = 0;
const fiveButton = document.querySelector("#high-five");
const fiveStatus = document.querySelector("#five-status");
function resetFive() {
  fiveRevision++;
  clearTimeout(fiveTimer);
  fivePhase = "";
  fiveButton.hidden = true;
  fiveButton.dataset.phase = "";
  fiveButton.textContent = "✋";
  fiveButton.setAttribute("aria-label", "完成一件事，和此刻击掌");
  fiveStatus.textContent = "";
}
async function highFive() {
  if (fivePhase === "done") return;
  if (fivePhase !== "ready") {
    hideCard();
    fivePhase = "ready";
    fiveButton.hidden = false;
    fiveButton.dataset.phase = "ready";
    fiveButton.setAttribute("aria-label", "点手掌，击掌");
    fiveStatus.textContent = "手举好啦，碰一下？";
    renderArt();
    fiveTimer = setTimeout(() => { resetFive(); renderArt(); }, 15000);
  } else {
    clearTimeout(fiveTimer);
    fivePhase = "done";
    const revision = fiveRevision;
    const started = Date.now();
    fiveButton.hidden = true;
    fiveButton.dataset.phase = "done";
    fiveButton.textContent = "✦";
    fiveStatus.textContent = "啪！这件事完成啦。";
    renderArt();
    await CikeSound.clap();
    if(revision !== fiveRevision) return;
    await CikeSound.line("耶，击掌！这件事完成啦。");
    if(revision !== fiveRevision) return;
    fiveTimer = setTimeout(() => { resetFive(); renderArt(); }, Math.max(250, 2600-(Date.now()-started)));
  }
}
fiveButton.onclick = highFive;
document.querySelector("#complete").onclick = highFive;
function sleeping() { const h = new Date().getHours(); return h >= 22 || h < 6; }
function idleTick() {
  if (sleeping() || activeItem || fivePhase || dragging || document.hidden ||
      state?.settings.reducedMotion || motionPreference.matches) return;
  idleStep = (idleStep + 1) % 3;
  renderArt();
}
setInterval(idleTick, 24000);
function mood() {
  document.body.dataset.mood = !state?.settings.enabled
    ? "quiet"
    : sleeping() && !activeItem ? "night" : currentMoment?.mood || "afternoon";
  document.querySelector("#spark").textContent = {
    quiet: "·",
    night: "☾",
    morning: "✧",
    afternoon: "◌",
  }[document.body.dataset.mood];
  const caption = document.querySelector("#caption");
  if (!caption) return;
  caption.textContent = activeItem?.action
    ? "一起做件小小的事。"
    : sleeping() && !activeItem && !fivePhase
      ? "晚安，明天见。"
      : !state?.settings.enabled
      ? "安静待着，也很好。"
      : {
          wake: "慢慢来。",
          morning: "你忙你的。",
          lunch: "慢一点也好。",
          afternoon: "松一小口气。",
          evening: "轻轻待着。",
          winddown: "慢慢收尾。",
          late: "我在这里。",
        }[currentMoment?.scene] || "我在这里。";
}
async function refreshMoment() {
  const next = await api.call("moment");
  const changed = currentMoment?.scene !== next.scene || pet.dataset.sleeping !== String(sleeping());
  currentMoment = next;
  if (activeItem && !activeItem.preview && activeItem.moment?.scene !== next.scene) {
    hideCard();
    return;
  }
  if (!activeItem && changed) { idleStep = 0; renderArt(); }
  mood();
}

function render(s) {
  state = s;
  currentMoment = s.moment;
  if (activeItem && !activeItem.preview && activeItem.moment?.scene !== currentMoment?.scene) {
    hideCard();
  }
  renderTransparentPreview();
  renderArt();
  document.body.classList.toggle("reduced", s.settings.reducedMotion);
  mood();
}
function renderTransparentPreview() {
  const preview = state?.transparentPreview;
  const video = document.querySelector("#action-preview");
  const active = !!(preview?.available && preview.enabled && preview.url);
  pet.classList.toggle("transparent-preview", active);
  if (active) pet.classList.remove("scene");
  pet.dataset.previewSize = preview?.size || "medium";
  document.querySelector("#creature").hidden = active;
  const caption = document.querySelector("#caption");
  if (caption) caption.hidden = active;
  document.querySelector("#spark").hidden = active;
  video.hidden = !active;
  if (active) {
    document.querySelector("#generation-status").hidden = true;
    if (video.src !== preview.url) video.src = preview.url;
    video.play().catch(() => {});
  } else {
    video.pause();
    video.removeAttribute("src");
    video.load();
  }
}
api.on("character-progress", (progress) => {
  const status = document.querySelector("#generation-status");
  const step = document.querySelector("#generation-step");
  if (!progress?.text) return;
  if (progress.stage === "complete") {
    status.hidden = true;
    return;
  }
  step.textContent = progress.text;
  status.hidden = false;
  if (progress.stage === "error") {
    status.querySelector("b").textContent = "动作没有生成";
    window.setTimeout(() => {
      status.hidden = true;
      status.querySelector("b").textContent = "正在制作桌宠动作";
    }, 6000);
  }
});
api.call("get").then(render);
api.on("state", render);
let artRevision = 0,
  motionTimer,
  motionConsumed = false,
  lastGesture = "";
const motionPreference = matchMedia("(prefers-reduced-motion: reduce)");
motionPreference.addEventListener("change", () => renderArt());
async function renderArt() {
  if (state?.transparentPreview?.enabled) return;
  const revision = ++artRevision;
  const asleep = sleeping() && !activeItem && !fivePhase;
  pet.dataset.sleeping = String(sleeping());
  clearTimeout(motionTimer);
  pet.dataset.playing = "false";
  const illustration =
    (asleep ? "lamp" : null) || activeItem?.action?.illustration ||
    (idleStep === 1 ? (currentMoment?.mood === "night" ? "lamp" : "water") :
      idleStep === 2 ? (currentMoment?.mood === "night" ? "music" : "window") : null) ||
    currentMoment?.illustration || "window";
  const allowed = [
    "water",
    "window",
    "desk",
    "note",
    "meal",
    "stretch",
    "lamp",
    "music",
  ];
  const customImage = activeItem?.image || state?.image;
  const scene = !customImage && allowed.includes(illustration);
  pet.classList.toggle("scene", scene);
  const img = document.querySelector("#creature");
  img.src =
    customImage ||
    (scene
      ? `../assets/scenes/${illustration}${currentMoment?.mood === "night" ? "-night" : ""}.svg`
      : "../assets/creature.svg");
  document.querySelector("#creature").alt = scene
    ? "小纸团的生活场景：" +
      (activeItem?.action?.title || currentMoment?.label || "桌边")
    : "安静的小纸团";
  if (
    scene &&
    state?.appearance &&
    (asleep || fivePhase || idleStep || activeItem?.action?.motionId ||
      !window.CikeAppearance.isOriginal(state.appearance))
  ) {
    try {
      const motionId = activeItem?.action?.motionId;
      const animate =
        !!motionId &&
        !motionConsumed &&
        !state.settings.reducedMotion &&
        !motionPreference.matches;
      if (motionId) motionConsumed = true;
      const gestureAnimate = !!fivePhase && fivePhase !== lastGesture &&
        !state.settings.reducedMotion && !motionPreference.matches;
      lastGesture = fivePhase;
      const input = {
        illustration,
        night: asleep || currentMoment?.mood === "night",
        instance: revision,
        appearance: { ...state.appearance, ...(asleep ? { expression: "sleepy" } : !activeItem && idleStep ? { expression: idleStep === 1 ? "happy" : "sleepy" } : {}) },
        ...(fivePhase ? { gesture: fivePhase, animate: gestureAnimate } : {}),
        ...(motionId ? { motionId, animate } : {}),
      };
      const src = await api.call("art", input);
      if (revision !== artRevision) return;
      img.src = src;
      pet.dataset.motion = motionId || "";
      pet.dataset.playing = String(animate);
      if (animate) {
        const duration = window.CikeMotions?.definitions?.[motionId]?.durationMs ||
          (motionId === "sip" ? 5200 : 3200);
        motionTimer = setTimeout(() => {
          if (revision === artRevision) pet.dataset.playing = "false";
        }, duration + 120);
      }
    } catch {
      /* The bundled original scene is already displayed. */
    }
  }
}
function releaseHold() {
  held = false;
  document.querySelector("#hold").setAttribute("aria-pressed", "false");
  document.querySelector("#hold").textContent = "留在桌边";
  api.call("hold", false).catch(() => {});
}
function hideCard() {
  CikeSound.stop();
  resetFive();
  clearTimeout(timer);
  releaseHold();
  bubble.classList.remove("visible");
  activeItem = null;
  renderArt();
  refreshMoment();
  pass = !document.querySelector("#pet:hover, #high-five:hover");
  api.call("passthrough", pass).catch(() => {});
}
function autoHide() {
  clearTimeout(timer);
  timer = setTimeout(hideCard, 30000);
}
api.on("speak", (item) => {
  resetFive();
  activeItem = item;
  CikeSound.line(item.voiceText || item.text);
  motionConsumed = false;
  document.querySelector("#complete").hidden = false;
  document.querySelector("#complete").textContent = item.action ? "完成了，击掌" : "击个掌";
  releaseHold();
  if (item.moment) currentMoment = item.moment;
  document.querySelector("#bubble-label").textContent =
    (item.preview ? "时段预览 · " : "") + (item.moment?.label || "此刻");
  document.querySelector("#bubble-duration").textContent = item.action
    ? "约 " + item.action.duration
    : "";
  document.querySelector("#bubble-title").textContent =
    item.action?.title || "";
  document.querySelector("#bubble-title").hidden = !item.action;
  document.querySelector("#bubble-text").textContent = item.text;
  document.querySelector("#bubble-closing").textContent =
    item.action?.closing || "";
  document.querySelector("#bubble-closing").hidden = !item.action;
  renderArt();
  mood();
  bubble.classList.add("visible");
  autoHide();
});
api.on("hide-bubble", hideCard);
document.querySelector("#dismiss").onclick = hideCard;
document.querySelector("#hold").onclick = async () => {
  const next = !held;
  try {
    await api.call("hold", next);
    held = next;
    document.querySelector("#hold").setAttribute("aria-pressed", String(held));
    document.querySelector("#hold").textContent = held
      ? "恢复自动收起"
      : "留在桌边";
    if (held) clearTimeout(timer);
    else autoHide();
  } catch {
    hideCard();
  }
};
document.addEventListener("contextmenu", (e) => {
  e.preventDefault();
  api.call("menu");
});
pet.addEventListener("keydown", (e) => {
  if (e.key === "Enter" || e.key === " ") {
    e.preventDefault();
    requestCard();
  }
  if (e.key === "ContextMenu" || (e.shiftKey && e.key === "F10")) {
    e.preventDefault();
    api.call("menu");
  }
});
let startPointer,
  moved = false,
  requesting = false;
document.addEventListener("keydown", (e) => {
  if (e.key === "Tab") document.body.classList.add("keyboard-nav");
});
document.addEventListener("pointerdown", () => {
  document.body.classList.remove("keyboard-nav");
}, true);
async function requestCard() {
  if (requesting) return;
  requesting = true;
  try {
    await api.call("request");
  } finally {
    requesting = false;
  }
}
pet.addEventListener("pointerdown", (e) => {
  if (e.button !== 0) return;
  dragging = true;
  moved = false;
  startPointer = { x: e.clientX, y: e.clientY };
  pet.setPointerCapture(e.pointerId);
  api.call("drag-start");
  document.body.dataset.mood = "happy";
});
pet.addEventListener("pointermove", (e) => {
  if (
    dragging &&
    Math.hypot(e.clientX - startPointer.x, e.clientY - startPointer.y) >= 6
  )
    moved = true;
  if (dragging && moved) api.call("drag");
});
async function end(e) {
  if (dragging) {
    dragging = false;
    await api.call("drag-end", moved);
    if (!moved && e.type === "pointerup") await requestCard();
    setTimeout(mood, 2000);
  }
}
pet.addEventListener("pointerup", end);
pet.addEventListener("pointercancel", end);
let pass;
document.addEventListener("mousemove", (e) => {
  const next = !(
    e.target.closest("#pet") || e.target.closest("#high-five") || e.target.closest("#bubble.visible")
  );
  if (next !== pass && !dragging) {
    pass = next;
    api.call("passthrough", next);
  }
});
setInterval(refreshMoment, 15000);
window.addEventListener("focus", refreshMoment);
document.addEventListener("visibilitychange", () => { if (!document.hidden) refreshMoment(); });

document.querySelector("#creature").addEventListener("error", () => {
  clearTimeout(motionTimer);
  artRevision++;
  pet.dataset.playing = "false";
  const img = document.querySelector("#creature");
  if (!img.src.endsWith("/creature.svg")) {
    pet.classList.remove("scene");
    img.src = "../assets/creature.svg";
    img.alt = "安静的小纸团";
  }
});

api.on("voice-changed", () => CikeSound.stop());

document.querySelector("#block-current").onclick=()=>api.call("block-current");
