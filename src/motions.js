(function (root) {
  const rows = [
    ["pour-water", "添一点水", "water"],
    ["sip", "捧杯喝一口", "water"],
    ["rinse-cup", "冲洗杯子", "water"],
    ["place-cup", "摆好杯子", "water"],
    ["open-curtain", "拉开窗帘", "window"],
    ["look-outside", "望向窗外", "window"],
    ["inspect-leaf", "看看叶片", "window"],
    ["wipe-leaf", "擦一片叶子", "window"],
    ["clear-item", "挪好一件小物", "desk"],
    ["store-pen", "收好一支笔", "desk"],
    ["move-phone", "放下手机", "desk"],
    ["tidy-cable", "理好一条线", "desk"],
    ["stack-paper", "叠好散纸", "desk"],
    ["throw-away", "丢掉空包装", "desk"],
    ["wipe-desk", "擦一下桌角", "desk"],
    ["write-note", "写一行字", "note"],
    ["type-text", "在文档里写字", "desk"],
    ["save-file", "保存文档", "desk"],
    ["close-tab", "关掉一个页面", "desk"],
    ["close-book", "合上本子", "note"],
    ["read-book", "翻开读一段", "note"],
    ["mark-page", "标记喜欢的一句", "note"],
    ["prepare-meal", "摆好碗筷", "meal"],
    ["taste-food", "尝一小口", "meal"],
    ["rinse-dish", "冲洗餐具", "meal"],
    ["play-song", "播放一首歌", "music"],
    ["lower-volume", "调低音量", "music"],
    ["stop-music", "关掉连播", "music"],
    ["put-headphones", "放好耳机", "music"],
    ["relax-hands", "张开手再放松", "stretch"],
    ["shrug", "轻抬肩再放下", "stretch"],
    ["sit-back", "靠稳椅背", "stretch"],
    ["dim-lamp", "调柔灯光", "lamp"],
    ["screen-dim", "调低屏幕亮度", "desk"],
    ["switch-light", "关掉一盏灯", "lamp"],
  ];
  const definitions = Object.fromEntries(
    rows.map(([id, label, illustration]) => [
      id,
      { id, label, illustration, durationMs: 3200 },
    ]),
  );
  const api = { definitions, ids: Object.keys(definitions) };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.CikeMotions = api;
})(typeof window !== "undefined" ? window : globalThis);
