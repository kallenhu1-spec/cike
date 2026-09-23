const api = window.cike,
  defs = window.CikeMotions.definitions;
let state,
  rows = [],
  epoch = 0;
const timers = new Map();
const reduced = matchMedia("(prefers-reduced-motion: reduce)");
const $ = (id) => document.getElementById(id);
function options(id, animate = false) {
  return {
    motionId: id,
    illustration: defs[id].illustration,
    appearance: state.appearance || window.CikeAppearance.defaults(),
    night: $("night").checked,
    animate,
  };
}
async function render() {
  const run = ++epoch;
  for (const t of timers.values()) clearTimeout(t);
  timers.clear();
  $("actions").replaceChildren();
  const list = Object.values(defs).filter(
    (x) => $("filter").value === "all" || x.illustration === $("filter").value,
  );
  for (const d of list) {
    const article = document.createElement("article");
    article.className = "action";
    article.dataset.id = d.id;
    const img = document.createElement("img");
    img.alt = d.label;
    const h = document.createElement("h3");
    h.textContent = d.label;
    const p = document.createElement("p");
    p.textContent =
      rows.find((r) => r.action.motionId === d.id)?.text || "动作演示";
    const footer = document.createElement("footer"),
      button = document.createElement("button"),
      small = document.createElement("small");
    button.textContent = "播放一次";
    small.textContent = "3.2 秒 · 不循环";
    footer.append(button, small);
    article.append(img, h, p, footer);
    $("actions").append(article);
    try {
      img.src = await api.call("art", options(d.id));
    } catch (e) {
      $("status").textContent = e.message;
    }
    if (run !== epoch) return;
    button.onclick = async () => {
      clearTimeout(timers.get(d.id));
      const animate = !state.settings.reducedMotion && !reduced.matches;
      button.disabled = true;
      try {
        const src = await api.call("art", options(d.id, animate));
        if (run !== epoch) return;
        img.src = src;
        article.dataset.playing = String(animate);
        $("status").textContent = animate
          ? "只做这一次，完成后就停住。"
          : "减少动画已开启，显示完成后的静态画面。";
        if (animate)
          timers.set(
            d.id,
            setTimeout(async () => {
              try {
                const still = await api.call("art", options(d.id));
                if (run === epoch) {
                  img.src = still;
                  article.dataset.playing = "false";
                }
              } catch (e) {
                $("status").textContent = e.message;
              } finally {
                button.disabled = false;
              }
            }, 3400),
          );
        else button.disabled = false;
      } catch (e) {
        $("status").textContent = e.message;
        button.disabled = false;
      }
    };
  }
}
$("filter").onchange = render;
$("night").onchange = render;
reduced.addEventListener("change", () => {
  if (state) render();
});
Promise.all([api.call("get"), api.call("motion-library")])
  .then(([s, r]) => {
    state = s;
    rows = r;
    render();
  })
  .catch((e) => {
    $("status").textContent = e.message;
  });
api.on("state", (s) => {
  state = s;
  render();
});
