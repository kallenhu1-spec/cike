const {
  app,
  BrowserWindow,
  ipcMain,
  Menu,
  Tray,
  nativeImage,
  dialog,
  screen,
  powerMonitor,
  session,
  systemPreferences,
} = require("electron");
const path = require("node:path"),
  fs = require("node:fs"),
  { pathToFileURL } = require("node:url"),
  core = require("./core.cjs");
if (process.env.CIKE_TEST_DIR)
  app.setPath("userData", process.env.CIKE_TEST_DIR);
let pet,
  settings,
  customizer,
  laboratory,
  studio,
  voiceRoom,
  voices,
  voiceAI,
  characterAI,
  tray,
  state,
  file,
  lastItem = null,
  locked = false,
  resumeAfter = 0,
  drag = null,
  cardPinned = false,
  transparentPreviewFile = "";
const transparentPreview = { available: false, enabled: false, size: "medium", url: "" };
const builtin = core.validateLibrary([
  ...require("../assets/suggestions.json"),
  ...require("../assets/moments.json"),
]);
const prefs = {
  preload: path.join(__dirname, "preload.cjs"),
  contextIsolation: true,
  nodeIntegration: false,
  sandbox: true,
};
function persist() {
  core.save(file, state);
}
function snapshot() {
  return {
    ...state,
    appVersion: app.getVersion(),
    libraryInfo: { builtin: builtin.length },
    moment: core.context(state.profile, new Date()),
    transparentPreview: { ...transparentPreview },
  };
}
function send() {
  for (const w of [pet, settings, laboratory, studio, voiceRoom, customizer])
    if (w && !w.isDestroyed()) w.webContents.send("state", snapshot());
}
function secure(win) {
  win.webContents.setWindowOpenHandler(() => ({ action: "deny" }));
  win.webContents.on("will-navigate", (e) => e.preventDefault());
}
function showCustomizer() {
  if (customizer && !customizer.isDestroyed()) {customizer.show();return;}
  customizer = new BrowserWindow({width:1080,height:820,minWidth:720,minHeight:620,title:'此刻 · 设置与定制',backgroundColor:'#f7f3e9',webPreferences:prefs});
  secure(customizer);customizer.loadFile(path.join(__dirname,'customize.html'));
}
function showSettings() {
  if (settings && !settings.isDestroyed()) {
    settings.show();
    return;
  }
  settings = new BrowserWindow({
    width: 690,
    height: 820,
    minWidth: 540,
    minHeight: 650,
    title: "此刻 · 小小的偏好",
    backgroundColor: "#f7f3e9",
    webPreferences: prefs,
  });
  secure(settings);
  settings.loadFile(path.join(__dirname, "settings.html"));
}
function showLaboratory() {
  if (laboratory && !laboratory.isDestroyed()) {
    laboratory.show();
    return;
  }
  laboratory = new BrowserWindow({
    width: 1050,
    height: 820,
    minWidth: 760,
    minHeight: 650,
    title: "此刻 · 可爱实验室",
    backgroundColor: "#faf7ef",
    webPreferences: prefs,
  });
  secure(laboratory);
  laboratory.loadFile(path.join(__dirname, "laboratory.html"));
}
let voiceSelection = "";
const manualRecent = [];
function requestReminder() {
  let result = speak(true, new Date(), [
    ...manualRecent,
    ...(lastItem ? [lastItem.id] : []),
  ]);
  // A complete cycle may start again, but never immediately repeat the last card
  // while another safe, context-appropriate card exists.
  if (!result?.item) {
    const last = manualRecent.at(-1);
    manualRecent.length = 0;
    result = speak(true, new Date(), last ? [last] : []);
    if (!result?.item) result = speak(true);
  }
  if (result?.item) manualRecent.push(result.item.id);
  return result;
}
function showStudio() {
  if (studio && !studio.isDestroyed()) {
    studio.show();
    return;
  }
  studio = new BrowserWindow({
    width: 1100,
    height: 840,
    minWidth: 760,
    minHeight: 650,
    title: "此刻 · 灵感与动作工作台",
    backgroundColor: "#faf7ef",
    webPreferences: prefs,
  });
  secure(studio);
  studio.loadFile(path.join(__dirname, "studio.html"));
}
function showVoiceRoom(text) {
  if (typeof text === "string") voiceSelection = text;
  if (voiceRoom && !voiceRoom.isDestroyed()) { voiceRoom.show(); voiceRoom.webContents.send("voice-select", voiceSelection); return; }
  voiceRoom = new BrowserWindow({width: 1020, height: 920, minWidth: 600, minHeight: 650,
    title: "此刻 · 小小配音室", backgroundColor: "#f7f3e9", webPreferences: prefs});
  secure(voiceRoom);
  voiceRoom.loadFile(path.join(__dirname, "voice.html"));
  voiceRoom.on("closed", () => voiceAI?.cancel());
}
function voiceChanged() {
  for (const w of [pet, voiceRoom, customizer]) if (w && !w.isDestroyed()) w.webContents.send("voice-changed");
}
function clamp(pos) {
  const area = screen.getDisplayNearestPoint(pos).workArea;
  return {
    x: Math.round(Math.max(area.x, Math.min(pos.x, area.x + area.width - 340))),
    y: Math.round(
      Math.max(area.y, Math.min(pos.y, area.y + area.height - 560)),
    ),
  };
}
function resetPosition() {
  const a = screen.getPrimaryDisplay().workArea;
  pet.setPosition(a.x + a.width - 370, a.y + a.height - 580);
}
function speak(force = false, now = new Date(), excludeIds = [], preview = false) {
  if (
    !force &&
    (cardPinned ||
      locked ||
      Date.now() < resumeAfter ||
      !core.eligible(state, now, powerMonitor.getSystemIdleTime()))
  )
    return;
  const item = core.choose(state, builtin, now, Math.random, {
    preview: force,
    excludeIds,
  });
  if (!item) {
    cardPinned = false;
    pet.webContents.send("hide-bubble");
    return {
      moment: core.context(state.profile, now),
      item: null,
      reason: "这会儿没有适合且未被屏蔽的句子，我就安静待着。",
    };
  }
  cardPinned = false;
  lastItem = item;
  if (!force) {
    core.record(state, item, now);
    persist();
  }
  pet.webContents.send("speak", {
    ...item,
    preview,
    voiceText: item.text,
    text: state.profile.nickname
      ? `${state.profile.nickname}，${item.text}`
      : item.text,
  });
  return { moment: item.moment, item, reason: item.reason };
}
async function changeImage() {
  const r = await dialog.showOpenDialog({
    title: "选择你拥有使用权的形象",
    filters: [{ name: "图片", extensions: ["png", "jpg", "jpeg", "webp"] }],
    properties: ["openFile"],
  });
  if (r.canceled) return;
  const p = r.filePaths[0];
  if (fs.statSync(p).size > 5 * 1024 * 1024) throw Error("图片不能超过 5 MB");
  const img = nativeImage.createFromPath(p);
  if (img.isEmpty()) throw Error("图片无法读取");
  state.image = img
    .resize({ width: 360, height: 360, quality: "best" })
    .toDataURL();
  persist();
  send();
}
function refreshTrayMenu() {
  if (tray && !tray.isDestroyed()) tray.setContextMenu(menu());
}
function setTransparentPreviewEnabled(value) {
  if (typeof value !== "boolean") throw Error("无效的试映设置");
  if (value && !transparentPreview.available) throw Error("请先选择透明 WebM 动作");
  transparentPreview.enabled = value;
  refreshTrayMenu();
  send();
  return { ...transparentPreview };
}
function setTransparentPreviewSize(value) {
  if (!["small", "medium", "large"].includes(value)) throw Error("无效的试映尺寸");
  transparentPreview.size = value;
  refreshTrayMenu();
  send();
  return { ...transparentPreview };
}
function installTransparentPreview(source) {
  if (typeof source !== "string" || path.extname(source).toLowerCase() !== ".webm")
    throw Error("请选择 WebM 文件");
  const info = fs.statSync(source);
  if (!info.isFile() || info.size < 1024) throw Error("WebM 文件无法读取");
  if (info.size > 80 * 1024 * 1024) throw Error("WebM 不能超过 80 MB");
  fs.mkdirSync(path.dirname(transparentPreviewFile), { recursive: true });
  if (path.resolve(source) !== path.resolve(transparentPreviewFile)) {
    const temporary = transparentPreviewFile + ".copying";
    fs.copyFileSync(source, temporary);
    fs.renameSync(temporary, transparentPreviewFile);
  }
  transparentPreview.available = true;
  transparentPreview.enabled = true;
  transparentPreview.url = pathToFileURL(transparentPreviewFile).href;
  refreshTrayMenu();
  send();
  return { ...transparentPreview };
}
async function pickTransparentPreview() {
  const result = await dialog.showOpenDialog(pet, {
    title: "选择透明背景的 WebM 动作",
    filters: [{ name: "透明 WebM 动作", extensions: ["webm"] }],
    properties: ["openFile"],
  });
  if (result.canceled) return null;
  return installTransparentPreview(result.filePaths[0]);
}
function menu() {
  return Menu.buildFromTemplate([
    {label:'换一个治愈小事',click:requestReminder},
    {label:'播放声音',type:'checkbox',checked:voices.data.enabled,click:item=>{voices.settings({...voices.data,enabled:item.checked});voiceChanged();}},
    {type:'separator'},
    {label:'设置与定制…',click:showCustomizer},
    {label:'回到角落',click:resetPosition},
    {label:'退出此刻',click:()=>app.quit()}
  ]);
}
function handle(name, fn) {
  ipcMain.handle(name, async (e, ...args) => {
    if (
      ![pet, settings, laboratory, studio, voiceRoom, customizer].some(
        (w) =>
          w &&
          !w.isDestroyed() &&
          e.sender === w.webContents &&
          e.senderFrame === w.webContents.mainFrame,
      )
    )
      throw Error("不允许的窗口");
    try {
      if (name.startsWith("voice-") && !["voice-room", "voice-summary", "voice-play", "voice-selection"].includes(name) && e.sender !== voiceRoom?.webContents)
        throw Error("请在小小配音室进行这项操作");
      return { ok: true, value: await fn(...args) };
    } catch (err) {
      return { ok: false, error: err.message };
    }
  });
}
if (!app.requestSingleInstanceLock()) app.quit();
else {
  app.on("second-instance", () => {
    pet?.showInactive();
    showCustomizer();
  });
  app.whenReady().then(() => {
    file = path.join(app.getPath("userData"), "companion.json");
    transparentPreviewFile = path.join(app.getPath("userData"), "preview-assets", "transparent-action.webm");
    if (fs.existsSync(transparentPreviewFile)) {
      transparentPreview.available = true;
      transparentPreview.url = pathToFileURL(transparentPreviewFile).href;
    }
    if (process.env.CIKE_TRANSPARENT_PREVIEW_SOURCE)
      installTransparentPreview(process.env.CIKE_TRANSPARENT_PREVIEW_SOURCE);
    state = core.read(file);
    state.memory.visits++;
    persist();
    voices = new (require("./voice-store.cjs").VoiceStore)(path.join(app.getPath("userData"), "voices"));
    const transparentScript = app.isPackaged
      ? path.join(process.resourcesPath, "app.asar.unpacked", "skills/cike-character-studio/scripts/transparent_video.py")
      : path.join(__dirname, "../skills/cike-character-studio/scripts/transparent_video.py");
    characterAI = new (require("./ark-character-ai.cjs").ArkCharacterAI)({ userData: app.getPath("userData"), transparentScript });
    const runtime = process.env.CIKE_VOICE_RUNTIME || (app.isPackaged
      ? ([path.join(app.getPath("userData"), "voice-runtime"), path.resolve(process.resourcesPath, "../../../../voice-runtime")].find(p => fs.existsSync(path.join(p, "ready.json"))) || path.join(app.getPath("userData"), "voice-runtime"))
      : path.join(__dirname, "../.private/voice-runtime"));
    voiceAI = new (require("./voice-ai.cjs").VoiceAI)(runtime, voices);
    const voiceOrigin = require("node:url").pathToFileURL(path.join(__dirname, "voice.html")).href;
    session.defaultSession.setPermissionRequestHandler((wc, permission, cb, details) => {
      cb(wc === voiceRoom?.webContents && wc.getURL() === voiceOrigin && permission === "media" &&
        details.isMainFrame === true && details.mediaTypes?.length === 1 && details.mediaTypes[0] === "audio");
    });
    session.defaultSession.setPermissionCheckHandler((wc, permission, origin, details) =>
      wc === voiceRoom?.webContents && wc?.getURL() === voiceOrigin && permission === "media" && details.mediaType === "audio");
    pet = new BrowserWindow({
      width: 340,
      height: 560,
      transparent: true,
      frame: false,
      resizable: false,
      hasShadow: false,
      alwaysOnTop: true,
      skipTaskbar: true,
      show: false,
      webPreferences: prefs,
    });
    secure(pet);
    pet.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: false });
    if (state.position) {
      const p = clamp(state.position);
      pet.setPosition(p.x, p.y);
    } else resetPosition();
    pet.loadFile(path.join(__dirname, "pet.html"));
    pet.once("ready-to-show", () => pet.showInactive());
    const icon = nativeImage
      .createFromPath(path.join(__dirname, "../assets/tray.png"))
      .resize({ width: 20, height: 20 });
    tray = new Tray(icon);
    tray.setTitle("此刻");
    tray.setToolTip("此刻 · 桌搭团子");
    tray.setContextMenu(menu());
    tray.on("right-click", () => tray.setContextMenu(menu()));
    tray.on("click", showCustomizer);
    handle("get", () => snapshot());
    handle("customizer", showCustomizer);
    handle("preferences", showSettings);
    handle("voice-selection", () => voiceSelection);
    handle("image-pick", async () => {
      const r=await dialog.showOpenDialog(customizer,{title:'选择自己的图片',filters:[{name:'图片',extensions:['png','jpg','jpeg','webp']}],properties:['openFile']});
      if(r.canceled)return null;
      if(fs.statSync(r.filePaths[0]).size>5*1024*1024)throw Error('图片不能超过5 MB');
      const img=nativeImage.createFromPath(r.filePaths[0]);if(img.isEmpty())throw Error('图片无法读取');
      const size=img.getSize(),scale=Math.min(1,720/Math.max(size.width,size.height));
      const url=img.resize({width:Math.max(1,Math.round(size.width*scale)),height:Math.max(1,Math.round(size.height*scale))}).toDataURL();
      if(url.length>4000000)throw Error('图片内容过大，请换一张较小的图片');return url;
    });
    handle("image-apply", image => {if(image!==null)core.validateLibrary([{id:'image',text:'检查图片内容',period:'any',tags:[],image}]);state.image=image;persist();send();});
    handle("character-status", () => characterAI.status());
    handle("character-candidate", async input => {
      if (!input || !Number.isInteger(input.index) || input.index < 0 || input.index > 5) throw Error("候选编号无效");
      if (input.authorizationConfirmed !== true) throw Error("请先确认图片授权");
      return characterAI.candidate(input.portrait, input.style, input.index);
    });
    handle("character-video", async input => {
      if (!input || typeof input.character !== "string") throw Error("请先选定角色母版");
      const progress = value => {
        if (customizer && !customizer.isDestroyed()) customizer.webContents.send("character-progress", value);
        if (pet && !pet.isDestroyed()) pet.webContents.send("character-progress", value);
      };
      try {
        const result = await characterAI.actionVideo(input, progress);
        const preview = installTransparentPreview(result.webm);
        return { ...result, webm: preview.url };
      } catch (error) {
        progress({ stage: "error", text: `动作生成失败：${error.message}` });
        throw error;
      }
    });
    handle("content-list", () => [...builtin,...state.custom].map(row=>({...state.overrides[row.id]||row,builtin:builtin.some(b=>b.id===row.id),edited:!!state.overrides[row.id],enabled:!state.memory.blocked.includes(row.id)})));
    handle("content-save", input => {
      const row=core.validateLibrary([input])[0];
      if(builtin.some(r=>r.id===row.id)) state.overrides[row.id]=row;
      else {const index=state.custom.findIndex(r=>r.id===row.id);const next=[...state.custom];if(index<0)next.push(row);else next[index]=row;state.custom=core.validateLibrary(next);}
      state.memory.recent=state.memory.recent.filter(id=>id!==row.id);persist();send();if(voiceRoom&&!voiceRoom.isDestroyed())voiceRoom.webContents.send('voice-select', row.text);return row;
    });
    handle("content-toggle", input => {if(![...builtin,...state.custom].some(r=>r.id===input.id)||typeof input.enabled!=='boolean')throw Error('内容不存在');state.memory.blocked=state.memory.blocked.filter(id=>id!==input.id);if(!input.enabled)state.memory.blocked.push(input.id);persist();send();pet.webContents.send('hide-bubble');});
    handle("content-remove", async id => {
      if(![...builtin,...state.custom].some(r=>r.id===id))throw Error('内容不存在');
      const isBuiltin=builtin.some(r=>r.id===id);
      const r=await dialog.showMessageBox(customizer,{type:'question',message:isBuiltin?'恢复这条内置内容？':'删除这条自定义小动作？',detail:'已保存的配音保留，可在配音室管理。',buttons:['保留',isBuiltin?'恢复':'删除'],defaultId:0,cancelId:0});
      if(r.response!==1)return false;
      if(isBuiltin)delete state.overrides[id];else state.custom=state.custom.filter(r=>r.id!==id);
      state.memory.blocked=state.memory.blocked.filter(x=>x!==id);persist();send();pet.webContents.send('hide-bubble');return true;
    });
    handle("content-preview", id => {const base=[...builtin,...state.custom].find(r=>r.id===id);if(!base)throw Error('内容不存在');const row=state.overrides[id]||base;lastItem=row;pet.webContents.send('speak',{...row,voiceText:row.text,preview:true,moment:core.context(state.profile,new Date())});});
    handle("block-current", () => {if(lastItem){state.memory.blocked=[...new Set([...state.memory.blocked,lastItem.id])];persist();send();pet.webContents.send('hide-bubble');}});
    handle("data-location", () => app.getPath('userData'));
    handle("restore-data", async () => {
      const r=await dialog.showOpenDialog(customizer,{title:'导入此刻配置备份',filters:[{name:'此刻配置备份',extensions:['json']}],properties:['openFile']});
      if(r.canceled)return '已取消';
      if(fs.statSync(r.filePaths[0]).size>100*1024*1024)throw Error('备份文件过大');
      const restored=core.validateBackup(JSON.parse(fs.readFileSync(r.filePaths[0],'utf8')));
      const check=await dialog.showMessageBox(customizer,{type:'question',message:'用备份替换当前配置？',detail:'替换偏好、形象和小动作；当前配置会自动保留在本机 companion.before-restore.json。录音不变。',buttons:['取消','导入'],defaultId:0,cancelId:0});
      if(check.response!==1)return '已取消';
      core.save(path.join(path.dirname(file),'companion.before-restore.json'),state);
      state=restored;persist();send();pet.webContents.send('hide-bubble');return '配置已导入，原配置已备份；声音资料保持不变。';
    });
    handle("voice-room", showVoiceRoom);
    handle("voice-summary", () => voices.summary());
    handle("voice-engine", () => voiceAI.status());
    handle("voice-lines", () => {
      const rows = [{title:"击掌完成",text:"耶，击掌！这件事完成啦。"},
        {title:"声音试读（仅试听）",text:"你好呀，我在这里陪着你。"},
        ...[...builtin, ...state.custom].map(r=>state.overrides[r.id]||r).map(r=>({title:r.action?.title || "日常陪伴",text:r.variants?.[state.profile.tone] || r.text}))];
      rows.push(...voices.summary().clips.filter(c=>!rows.some(r=>r.text===c.text)).map(c=>({title:'已保留旧台词（仅试听）',text:c.text})));
      return rows.filter((r,i)=>rows.findIndex(a=>a.text===r.text)===i);
    });
    handle("voice-silent", input => {voices.setSilent(input.text, input.silent);voiceChanged();});
    handle("voice-settings", input => {voices.settings(input);voiceChanged();});
    handle("voice-preview", text => voices.audio(text, true));
    handle("voice-play", text => voices.data.enabled ? {url:voices.audio(text),volume:voices.data.volume} : null);
    handle("voice-save", input => {
      if (input?.consent !== true) throw Error("需要家长与孩子同意录制");
      const result=voices.save({...input,source:"recording",approved:false});voiceChanged();return result;
    });
    handle("voice-reference-text", text => {
      if (!voices.data.reference) throw Error("还没有声音样本");
      voiceAI.cancel();
      voices.write({...voices.data, reference:{...voices.data.reference, text:require("./voice-store.cjs").textValue(text)}});
      voiceChanged();
    });
    handle("voice-approve", text => {voices.approve(text);voiceChanged();});
    handle("voice-delete", text => {voiceAI.cancel();voices.remove(text);voiceChanged();});
    handle("voice-generate", async input => {
      if (input?.consent !== true) throw Error("需要家长与孩子同意生成");
      if (voices.data.clips[require("./voice-store.cjs").key(require("./voice-store.cjs").textValue(input.text))]) throw Error("已有配音，请先删除旧版再生成");
      const result=await voiceAI.generate(input.text);voiceChanged();return result;
    });
    handle("voice-cancel", () => voiceAI.cancel());
    handle("voice-microphone", async () => process.platform !== "darwin" || await systemPreferences.askForMediaAccess("microphone"));
    handle("voice-clear", async () => {
      const r=await dialog.showMessageBox(voiceRoom,{type:"question",message:"清除所有本机录音、声音样本和 AI 配音？",buttons:["保留","全部清除"],defaultId:0,cancelId:0});
      if(r.response===1){voiceAI.cancel();voices.reset();voiceChanged();}return r.response===1;
    });
    handle("hold", (value) => {
      if (typeof value !== "boolean") throw Error("无效的停留设置");
      cardPinned = value;
    });
    handle("laboratory", showLaboratory);
    handle("studio", showStudio);
    handle("motion-library", () => builtin.filter((x) => x.action?.motionId));
    handle("request", requestReminder);
    handle("art", (input) => require("./art.cjs")(input));
    handle("appearance", (input) => {
      state.appearance = require("./appearance.js").validate(input);
      state.image = null;
      persist();
      send();
      return snapshot();
    });
    handle("moment", () => core.context(state.profile, new Date()));
    handle("transparent-preview-pick", pickTransparentPreview);
    handle("transparent-preview-enable", setTransparentPreviewEnabled);
    handle("transparent-preview-size", setTransparentPreviewSize);
    handle("preview", (time) => speak(true, core.previewDate(time), [], time !== "now"));
    handle("menu", () => menu().popup({ window: pet }));
    handle("save", (input) => {
      Object.assign(state, core.validateSettings(input));
      if (!state.settings.enabled) {
        cardPinned = false;
        pet.webContents.send("hide-bubble");
      }
      persist();
      send();
      return snapshot();
    });
    handle("prompt", () => require("./prompt.cjs")(state.profile));
    handle("import", async () => {
      const r = await dialog.showOpenDialog(settings, {
        filters: [{ name: "100 条专属建议 JSON", extensions: ["json"] }],
        properties: ["openFile"],
      });
      if (r.canceled) return "已取消";
      if (fs.statSync(r.filePaths[0]).size > 200000) throw Error("文件过大");
      state.custom = core
        .validateLibrary(
          JSON.parse(fs.readFileSync(r.filePaths[0], "utf8")),
          true,
        )
        .map((r) => ({
          ...r,
          id:
            "custom-" +
            require("node:crypto")
              .createHash("sha256")
              .update(r.id)
              .digest("hex")
              .slice(0, 32),
        }));
      state.memory.recent = [];
      state.memory.blocked = [];
      persist();
      send();
      return "已导入 100 条，之后离线出现";
    });
    handle("clear-custom", async () => {
      const r=await dialog.showMessageBox(settings,{type:"question",message:"清除所有自定义小动作和导入内容？",buttons:["保留","清除"],defaultId:0,cancelId:0});if(r.response!==1)return "已保留";
      state.custom = [];
      state.memory.recent = [];
      persist();
      send();
    });
    handle("export", async () => {
      const r = await dialog.showSaveDialog(settings, {
        defaultPath: "此刻-本地记忆.json",
      });
      if (!r.canceled) core.save(r.filePath, state);
      return r.canceled ? "已取消" : "已导出，请妥善保管含个人偏好的文件";
    });
    handle("reset", async () => {
      const r = await dialog.showMessageBox(settings, {
        type: "question",
        message: "清除档案、历史、形象、专属建议和所有声音资料？",
        buttons: ["保留", "全部清除"],
        defaultId: 0,
        cancelId: 0,
      });
      if (r.response === 1) {
        voiceAI.cancel();
        voices.reset();
        voiceChanged();
        state = core.defaults();
        persist();
        for (const name of fs.readdirSync(path.dirname(file)))
          if (name.startsWith(path.basename(file) + ".corrupt-"))
            fs.unlinkSync(path.join(path.dirname(file), name));
        send();
        pet.webContents.send("hide-bubble");
      }
      return r.response === 1 ? "已清除" : "已保留";
    });
    handle("drag-start", () => {
      drag = {
        cursor: screen.getCursorScreenPoint(),
        position: pet.getPosition(),
      };
    });
    handle("drag", () => {
      if (drag) {
        const p = screen.getCursorScreenPoint();
        pet.setPosition(
          drag.position[0] + p.x - drag.cursor.x,
          drag.position[1] + p.y - drag.cursor.y,
        );
      }
    });
    handle("drag-end", (moved = true) => {
      drag = null;
      if (moved !== true) return;
      const [x, y] = pet.getPosition();
      const p = clamp({ x, y });
      pet.setPosition(p.x, p.y);
      state.position = p;
      persist();
    });
    handle("passthrough", (value) => {
      if (typeof value === "boolean" && !drag)
        pet.setIgnoreMouseEvents(value, { forward: true });
    });
    powerMonitor.on("lock-screen", () => {
      locked = true;
      pet.webContents.send("hide-bubble");
    });
    powerMonitor.on("unlock-screen", () => {
      locked = false;
      resumeAfter = Date.now() + 120000;
    });
    powerMonitor.on("suspend", () => pet.webContents.send("hide-bubble"));
    powerMonitor.on("resume", () => {
      resumeAfter = Date.now() + 120000;
    });
    screen.on("display-removed", resetPosition);
    setTimeout(() => speak(), 12000);
    setInterval(() => speak(), 60000);
  });
  app.on("before-quit", () => voiceAI?.cancel());
  app.on("window-all-closed", () => {});
}
