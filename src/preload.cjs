const { contextBridge, ipcRenderer } = require("electron");
const allowed = [
  "get", "customizer", "preferences", "image-pick", "image-apply", "character-status", "character-candidate", "character-video", "content-list", "content-save", "content-toggle", "content-remove", "content-preview", "block-current", "data-location", "restore-data", "voice-selection",
  "voice-silent", "voice-reference-text", "voice-room", "voice-summary", "voice-engine", "voice-lines", "voice-settings", "voice-preview", "voice-play", "voice-save", "voice-approve", "voice-delete", "voice-generate", "voice-cancel", "voice-microphone", "voice-clear",
  "request",
  "art",
  "appearance",
  "laboratory",
  "studio",
  "motion-library",
  "moment",
  "preview",
  "hold",
  "menu",
  "save",
  "prompt",
  "import",
  "clear-custom",
  "export",
  "reset",
  "drag-start",
  "drag",
  "drag-end",
  "passthrough",
  "transparent-preview-pick",
  "transparent-preview-enable",
  "transparent-preview-size",
];
contextBridge.exposeInMainWorld("cike", {
  call: async (name, value) => {
    if (!allowed.includes(name)) throw Error("未知操作");
    const r = await ipcRenderer.invoke(name, value);
    if (!r.ok) throw Error(r.error);
    return r.value;
  },
  on: (name, fn) => {
    if (!["state", "speak", "hide-bubble", "voice-changed", "voice-select", "character-progress"].includes(name)) return;
    const listener = (_event, value) => fn(value);
    ipcRenderer.on(name, listener);
    return () => ipcRenderer.removeListener(name, listener);
  },
});
