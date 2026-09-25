const design = window.CikeAppearance,
  api = window.cike;
const $ = (id) => document.getElementById(id);
let current = design.defaults(),
  baseline = design.defaults(),
  saved = design.defaults(),
  revision = 0;
const fields = ["shape", "face", "eyes", "expression", "skinColor", "leafColor", "pattern", "patternColor", "patternSize", "patternDensity", "outfitColor"];
const faceNames = { "-2": "上移两格", "-1": "上移一格", "0": "推荐位置", "1": "下移一点", "2": "再下移一点" };
const outfitNames = { none: "不穿衣服", overalls: "背带裤", sweater: "宽松毛衣", apron: "小围裙", pajamas: "睡衣" };
for (const [key, name] of Object.entries(outfitNames)) {
  const button = document.createElement("button");
  button.type = "button";
  button.dataset.outfit = key;
  button.setAttribute("aria-label", name);
  const img = document.createElement("img"); img.alt = "";
  const caption = document.createElement("span"); caption.textContent = name;
  button.append(img, caption);
  button.onclick = () => { current = { ...current, outfit: key }; $("status").textContent = "正在试穿，喜欢后再应用到桌面。"; render(); };
  $("outfits").append(button);
}
const names = { paper: "小纸团", round: "圆团子", bean: "软豆子" };
const data = (a) =>
  "data:image/svg+xml;charset=utf-8," + encodeURIComponent(design.svg(a));
for (const key of Object.keys(design.presets))
  $("preset-" + key).src = data(design.presets[key]);
function note(a) {
  return `${names[a.shape]} · ${faceNames[a.face]} · ${["点点眼", "圆一点", "再大一点"][a.eyes]}`;
}
async function render() {
  const version = ++revision;
  for (const k of fields)
    $(k).value = current[k];
  $("face-value").textContent = faceNames[current.face];
  $("eyes-value").textContent =
    current.expression === "smile"
      ? ["点点眼", "圆一点", "再大一点"][current.eyes]
      : "弯眼宽度";
  for (const button of document.querySelectorAll("[data-outfit]")) {
    button.querySelector("img").src = data({ ...current, outfit: button.dataset.outfit });
    button.setAttribute("aria-pressed", String(current.outfit === button.dataset.outfit));
  }
  $("outfitColor").disabled = current.outfit === "none";
  $("outfit-color-value").textContent = current.outfitColor.toUpperCase();
  for (const button of document.querySelectorAll("[data-clothing-color]")) {
    button.disabled = current.outfit === "none";
    button.setAttribute("aria-pressed", String(current.outfitColor === button.dataset.clothingColor));
  }
  for (const k of ["patternColor", "patternSize", "patternDensity"]) $(k).disabled = current.pattern === "none";
  $("before").src = data(baseline);
  $("after").src = data(current);
  $("before-note").textContent = note(baseline);
  $("after-note").textContent = note(current);
  document
    .querySelectorAll("[data-preset]")
    .forEach((el) =>
      el.setAttribute(
        "aria-pressed",
        JSON.stringify(current) ===
          JSON.stringify(design.presets[el.dataset.preset]),
      ),
    );
  try {
    const src = await api.call("art", {
      illustration: "water",
      night: $("night").checked,
      appearance: current,
    });
    if (version === revision) $("scene").src = src;
  } catch (e) {
    $("status").textContent = e.message;
  }
}
for (const k of fields)
  $(k).addEventListener("input", () => {
    current = {
      ...current,
      [k]: ["face", "eyes", "patternSize", "patternDensity"].includes(k) ? Number($(k).value) : $(k).value,
    };
    $("status").textContent = "这是预览，桌面还没有改变。";
    render();
  });
document.querySelectorAll("[data-clothing-color]").forEach(button => {
  button.onclick = () => {
    current = { ...current, outfitColor: button.dataset.clothingColor };
    $("status").textContent = "衣服颜色已换好，喜欢后应用到桌面。";
    render();
  };
});
$("night").onchange = render;
document.querySelectorAll("[data-preset]").forEach(
  (el) =>
    (el.onclick = () => {
      current = { ...current, ...Object.fromEntries(["shape", "face", "eyes", "expression"].map(k => [k, design.presets[el.dataset.preset][k]])) };
      $("status").textContent = "选好起点后，试着只改一个地方。";
      render();
    }),
);
$("baseline").onclick = () => {
  baseline = { ...current };
  $("status").textContent = "A 已固定。现在只动一个开关，观察 B 的变化。";
  render();
};
async function apply(a) {
  $("apply").disabled = true;
  $("restore").disabled = true;
  try {
    const s = await api.call("appearance", a);
    saved = { ...s.appearance };
    current = { ...saved };
    await render();
    $("status").textContent = "已经住到桌面上了。提醒里的角色也会一起变化。";
  } catch (e) {
    $("status").textContent = e.message;
  } finally {
    $("apply").disabled = false;
    $("restore").disabled = false;
  }
}
$("apply").onclick = () => apply(current);
$("restore").onclick = () => apply(design.defaults());
api
  .call("get")
  .then((s) => {
    saved = design.validate(s.appearance || design.defaults());
    current = { ...saved };
    baseline = { ...saved };
    render();
  })
  .catch((e) => {
    $("status").textContent = e.message;
  });
