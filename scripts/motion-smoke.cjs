const { _electron: electron } = require("playwright");
const fs = require("node:fs"),
  path = require("node:path"),
  os = require("node:os"),
  assert = require("node:assert/strict");
const core = require("../src/core.cjs"),
  { ids } = require("../src/motions.js"),
  rows = require("../assets/moments.json");
(async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "cike-motion-ui-"));
  let app;
  const errors = [];
  try {
    app = await electron.launch({
      ...(process.env.CIKE_EXECUTABLE
        ? { executablePath: process.env.CIKE_EXECUTABLE, args: [] }
        : { args: [path.resolve(__dirname, "..")] }),
      env: { ...process.env, CIKE_TEST_DIR: dir },
    });
    await app.evaluate(
      ({ powerMonitor }) => (powerMonitor.getSystemIdleTime = () => 600),
    );
    const pet = await app.firstWindow();
    pet.on("pageerror", (e) => errors.push(e.message));
    await pet.waitForSelector("#pet.scene");
    await pet.emulateMedia({ reducedMotion: "no-preference" });
    async function show(id) {
      const item = rows.find((r) => r.id === id);
      await app.evaluate(
        ({ BrowserWindow }, item) =>
          BrowserWindow.getAllWindows()
            .find((w) => w.webContents.getURL().endsWith("/pet.html"))
            .webContents.send("speak", {
              ...item,
              moment: {
                scene: "afternoon",
                mood: "afternoon",
                label: "午后",
                illustration: "window",
              },
            }),
        item,
      );
    }
    await show("moment-wake-01");
    await pet.waitForFunction(
      () => document.querySelector("#pet").dataset.playing === "true",
    );
    await pet.waitForFunction(
      () =>
        document.querySelector("#creature").complete &&
        document.querySelector("#creature").naturalWidth === 600,
    );
    // Capture pixels mid-action and after completion to establish motion actually renders.
    await pet.waitForTimeout(1000);
    const moving = await pet
      .locator("#creature")
      .screenshot({ animations: "allow" });
    await pet.waitForFunction(
      () => document.querySelector("#pet").dataset.playing === "false",
    );
    await pet.waitForFunction(
      () =>
        !atob(document.querySelector("#creature").src.split(",")[1]).includes(
          "<animate",
        ),
    );
    const end1 = await pet
      .locator("#creature")
      .screenshot({ animations: "allow" });
    await pet.waitForTimeout(600);
    const end2 = await pet
      .locator("#creature")
      .screenshot({ animations: "allow" });
    assert.notDeepEqual(moving, end1);
    assert.deepEqual(end1, end2);
    fs.writeFileSync("artifacts/一次动作-喝水中.png", moving);
    fs.writeFileSync("artifacts/一次动作-喝水后.png", end1);
    await show("moment-lunch-04");
    await pet.waitForFunction(
      () =>
        document.querySelector("#pet").dataset.motion === "rinse-cup" &&
        document.querySelector("#pet").dataset.playing === "true",
    );
    await show("moment-late-04");
    await pet.waitForFunction(
      () => document.querySelector("#pet").dataset.motion === "save-file",
    );
    await pet.waitForFunction(
      () => document.querySelector("#pet").dataset.playing === "false",
    );
    assert.equal(
      await pet.locator("#pet").getAttribute("data-motion"),
      "save-file",
    );
    await pet.evaluate(async () => {
      const s = await window.cike.call("get");
      s.settings.reducedMotion = true;
      await window.cike.call("save", s);
    });
    await show("moment-morning-06");
    await pet.waitForFunction(
      () => document.querySelector("#pet").dataset.motion === "wipe-leaf",
    );
    assert.equal(
      await pet.locator("#pet").getAttribute("data-playing"),
      "false",
    );
    await pet.evaluate(async () => {
      const s = await window.cike.call("get");
      s.settings.reducedMotion = false;
      await window.cike.call("save", s);
    });
    await pet.emulateMedia({ reducedMotion: "reduce" });
    await show("moment-wake-01");
    await pet.waitForFunction(
      () => document.querySelector("#pet").dataset.motion === "sip",
    );
    assert.equal(
      await pet.locator("#pet").getAttribute("data-playing"),
      "false",
    );
    await pet.emulateMedia({ reducedMotion: "no-preference" });
    const next = app.waitForEvent("window");
    await pet.evaluate(() => window.cike.call("studio"));
    const studio = await next;
    studio.on("pageerror", (e) => errors.push(e.message));
    await studio.emulateMedia({ reducedMotion: "no-preference" });
    await studio.waitForFunction(
      () =>
        document.querySelectorAll(".action img").length === 35 &&
        Array.from(document.querySelectorAll(".action img")).every(
          (i) => i.complete && i.naturalWidth === 600,
        ),
    );
    await studio.screenshot({ path: "artifacts/灵感工作台.png" });
    await studio
      .locator(".action-section")
      .screenshot({ path: "artifacts/35种动作总览.png" });
    for (const id of ids) {
      const card = studio.locator(`[data-id="${id}"]`);
      await card.locator("button").click();
      await card.waitFor({ state: "visible" });
      await studio.waitForFunction(
        (id) =>
          document.querySelector(`[data-id="${id}"]`).dataset.playing ===
          "true",
        id,
      );
    }
    await studio.locator("#filter").selectOption("water");
    await studio.waitForFunction(
      () => document.querySelectorAll(".action").length === 4,
    );
    await studio
      .locator(".action-section")
      .screenshot({ path: "artifacts/杯子四种动作.png" });
    await studio.locator('[data-id="sip"] button').click();
    await studio.waitForFunction(
      () =>
        document.querySelector('[data-id="sip"]').dataset.playing === "false",
    );
    assert(await studio.locator('[data-id="sip"] button').isEnabled());
    await app.evaluate(({ BrowserWindow }) =>
      BrowserWindow.getAllWindows()
        .find((w) => w.getTitle().includes("动作工作台"))
        .setSize(760, 700),
    );
    await studio.waitForFunction(() => innerWidth === 760);
    assert(
      await studio.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    );
    assert.deepEqual(errors, []);
    console.log(
      "PASS: 实际动画像素变化、完成后像素稳定、新提醒取消旧动作、应用/系统减少动画、35 动作解码与播放、筛选、窄窗口。",
    );
  } finally {
    if (app) await app.close();
    fs.rmSync(dir, { recursive: true, force: true });
  }
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
