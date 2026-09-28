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
const livingCharacter = document.querySelector("#living-character");
const actionPreview = document.querySelector("#action-preview");
let lifeDemo = "", lifeDemoTimer, blinkTimer;
function clearLifeDemo() {
  clearTimeout(lifeDemoTimer);
  lifeDemo = "";
}
function triggerBlink() {
  if (document.hidden || sleeping() || state?.settings.reducedMotion || motionPreference.matches) return;
  livingCharacter.classList.add("blinking");
  window.setTimeout(() => livingCharacter.classList.remove("blinking"), 135);
}
function scheduleBlink() {
  clearTimeout(blinkTimer);
  blinkTimer = setTimeout(() => {
    triggerBlink();
    scheduleBlink();
  }, 3200 + Math.random() * 3800);
}
scheduleBlink();
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
  const video = actionPreview;
  const active = !!(preview?.available && preview.enabled && preview.url);
  pet.classList.toggle("transparent-preview", active);
  if (active) pet.classList.remove("scene");
  pet.dataset.previewSize = preview?.size || "medium";
  document.querySelector("#creature").hidden = active;
  livingCharacter.hidden = active;
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
actionPreview.addEventListener("ended", () => {
  api.call("transparent-preview-enable", false).catch(() => {});
});
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
  pet.dataset.lifeAsleep = String(asleep);
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
  const motionId = activeItem?.action?.motionId;
  const lifeMode = fivePhase ? `five-${fivePhase}` : (lifeDemo === "sip" || motionId === "sip") ? "sip" : "idle";
  const useLivingCharacter = !customImage &&
    window.CikeAppearance.isOriginal(state?.appearance || window.CikeAppearance.defaults()) &&
    (fivePhase || lifeDemo || !activeItem || motionId === "sip");
  if (useLivingCharacter) {
    pet.classList.remove("scene", "transparent-preview");
    pet.classList.add("life");
    pet.dataset.lifeMode = lifeMode;
    const img = document.querySelector("#creature");
    img.hidden = true;
    livingCharacter.hidden = false;
    document.querySelector("#spark").hidden = false;
    const animateSip = lifeMode === "sip" && !motionConsumed &&
      !state?.settings.reducedMotion && !motionPreference.matches;
    if (lifeMode === "sip") motionConsumed = true;
    pet.dataset.motion = lifeMode === "sip" ? "sip" : "";
    pet.dataset.playing = String(animateSip);
    if (animateSip) {
      const duration = window.CikeMotions?.definitions?.sip?.durationMs || 5200;
      motionTimer = setTimeout(() => {
        if (revision !== artRevision) return;
        pet.dataset.playing = "false";
        if (lifeDemo === "sip") {
          clearLifeDemo();
          fiveStatus.textContent = "";
          renderArt();
        }
      }, duration + 20);
    }
    return;
  }
  pet.classList.remove("life");
  pet.dataset.lifeMode = "";
  livingCharacter.hidden = true;
  const scene = !customImage && allowed.includes(illustration);
  pet.classList.toggle("scene", scene);
  const img = document.querySelector("#creature");
  img.hidden = false;
  img.src =
    customImage ||
    (scene
      ? `../assets/scenes/${illustration}${currentMoment?.mood === "night" ? "-night" : ""}.svg`
      : "../assets/creature.svg");
  document.querySelector("#creature").alt = scene
    ? "小纸团的生活场景：" +
      (activeItem?.action?.title || currentMoment?.label || "桌边")
    : "安静的小纸团";
  if (scene && state?.appearance) {
    try {
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
api.on("life-demo", (kind) => {
  clearLifeDemo();
  if (kind === "high-five") {
    highFive();
    return;
  }
  hideCard();
  if (kind === "sip") {
    lifeDemo = "sip";
    motionConsumed = false;
    fiveStatus.textContent = "捧好杯子，喝一小口。";
    renderArt();
    return;
  }
  lifeDemo = "gaze";
  fiveStatus.textContent = "移动鼠标，我会看向你。";
  renderArt();
  lifeDemoTimer = setTimeout(() => {
    clearLifeDemo();
    fiveStatus.textContent = "";
    renderArt();
  }, 9000);
});
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
  const box = livingCharacter.getBoundingClientRect();
  const dx = Math.max(-1, Math.min(1, (e.clientX - (box.left + box.width / 2)) / 125));
  const dy = Math.max(-1, Math.min(1, (e.clientY - (box.top + box.height / 2)) / 125));
  livingCharacter.style.setProperty("--gaze-x", `${(dx * 3).toFixed(2)}px`);
  livingCharacter.style.setProperty("--gaze-y", `${(dy * 2).toFixed(2)}px`);
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
