const { _electron: electron } = require("playwright");
const fs = require("node:fs"),
  os = require("node:os"),
  path = require("node:path"),
  assert = require("node:assert/strict");
const core = require("../src/core.cjs"),
  rows = core.validateLibrary(require("../assets/moments.json"));
(async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "cike-action-ui-"));
  let app;
  const errors = [];
  try {
    app = await electron.launch({
      ...(process.env.CIKE_EXECUTABLE
        ? { executablePath: process.env.CIKE_EXECUTABLE, args: [] }
        : { args: [path.resolve(__dirname, "..")] }),
      env: { ...process.env, CIKE_TEST_DIR: dir },
    });
    await app.evaluate(({ powerMonitor }) => {
      powerMonitor.getSystemIdleTime = () => 600;
    });
    const pet = await app.firstWindow();
    pet.on("pageerror", (e) => errors.push(e.message));
    await pet.waitForSelector("#creature");
    await pet.clock.install();
    await pet.evaluate(async () => {
      const s = await window.cike.call("get");
      s.settings.reducedMotion = true;
      await window.cike.call("save", s);
    });
    async function show(row, hour = 15) {
      const item = {
        ...row,
        moment: core.context(
          core.defaults().profile,
          new Date(2026, 8, 22, hour),
        ),
      };
      await app.evaluate(
        ({ BrowserWindow }, item) =>
          BrowserWindow.getAllWindows()
            .find((w) => w.webContents.getURL().endsWith("/pet.html"))
            .webContents.send("speak", item),
        item,
      );
      await pet.locator("#bubble.visible").waitFor();
      await pet.waitForFunction(
        ({ text, label }) =>
          document.querySelector("#bubble-text").textContent === text &&
          document.querySelector("#bubble-label").textContent === label,
        { text: item.text, label: item.moment.label },
      );
      await pet.waitForFunction(
        () =>
          document.querySelector("#creature").complete &&
          document.querySelector("#creature").naturalWidth > 0,
      );
    }
    async function capture(name) {
      const box = await pet.locator("#bubble").boundingBox();
      const y = Math.max(0, Math.floor(box.y) - 12);
      await pet.screenshot({
        path: `artifacts/${name}.png`,
        omitBackground: true,
        clip: { x: 0, y, width: 340, height: 560 - y },
      });
    }
    fs.mkdirSync("artifacts", { recursive: true });
    for (const [id, name, hour] of [
      ["moment-wake-01", "行动卡-喝水", 8],
      ["moment-afternoon-02", "行动卡-桌角", 15],
      ["moment-winddown-01", "行动卡-明天一行字", 22],
    ]) {
      await show(
        rows.find((r) => r.id === id),
        hour,
      );
      await capture(name);
    }
    // All eight shipped scene files must actually decode in Chromium.
    for (const art of core.ILLUSTRATIONS) {
      for (const hour of [15, 22]) {
        await show(
          (() => {
            const r = rows.find((r) => r.action.illustration === art);
            const action = { ...r.action };
            delete action.motionId;
            return { ...r, action };
          })(),
          hour,
        );
        assert.equal(
          await pet.locator("#creature").evaluate((img) => img.naturalWidth),
          600,
        );
        assert(
          (await pet.locator("#creature").getAttribute("src")).endsWith(
            art + (hour === 22 ? "-night" : "") + ".svg",
          ),
        );
      }
    }
    await show(rows[0], 8);
    await pet.locator("#hold").click();
    await pet.waitForFunction(
      () =>
        document.querySelector("#hold").getAttribute("aria-pressed") === "true",
    );
    await pet.clock.fastForward(31000);
    assert(
      await pet
        .locator("#bubble")
        .evaluate((el) => el.classList.contains("visible")),
    );
    await pet.locator("#hold").click();
    await pet.waitForFunction(
      () =>
        document.querySelector("#hold").getAttribute("aria-pressed") ===
        "false",
    );
    await pet.clock.fastForward(31000);
    await pet.locator("#bubble.visible").waitFor({ state: "hidden" });
    assert(
      await pet
        .locator("#pet")
        .evaluate((el) => el.classList.contains("scene")),
    );
    // Maximum supported imported copy, including a 24-character nickname.
    const long = {
      ...rows[0],
      text: "字".repeat(88),
      action: {
        ...rows[0].action,
        title: "题".repeat(18),
        closing: "界".repeat(32),
        duration: "约需三分钟左右",
      },
    };
    await show(long);
    const box = await pet.locator("#bubble").boundingBox();
    assert(box.y >= 0);
    assert(box.y + box.height <= 560);
    assert.equal(
      await pet
        .locator("#bubble")
        .evaluate((el) => el.scrollWidth <= el.clientWidth),
      true,
    );
    await capture("行动卡-最长文案验收");
    await pet.locator("#dismiss").click();
    await pet.locator("#bubble.visible").waitFor({ state: "hidden" });
    const next = app.waitForEvent("window");
    await app.evaluate(({ app }) => app.emit("second-instance"));
    const settings = await next;
    settings.on("pageerror", (e) => errors.push(e.message));
    await settings.waitForSelector("#preview-sample");
    await settings.locator("#preview-time").selectOption("15:30");
    await settings.locator("#preview").click();
    await settings
      .locator("#preview-reason")
      .filter({ hasText: "午后的松口气" })
      .waitFor();
    await settings
      .locator("#preview-sample")
      .screenshot({ path: "artifacts/行动预览-桌面.png" });
    await app.evaluate(({ BrowserWindow }) =>
      BrowserWindow.getAllWindows()
        .find((w) => w.getTitle().includes("偏好"))
        .setSize(540, 700),
    );
    await settings.waitForFunction(() => innerWidth === 540);
    await settings
      .locator("#preview-sample")
      .screenshot({ path: "artifacts/行动预览-窄窗口.png" });
    assert(
      await settings.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    );
    // Keep user-supplied artwork when the message has an illustration.
    const custom =
      "data:image/png;base64," +
      fs.readFileSync("assets/tray.png").toString("base64");
    await app.evaluate(({ BrowserWindow }, image) => {
      const w = BrowserWindow.getAllWindows().find((w) =>
        w.webContents.getURL().endsWith("/pet.html"),
      );
      w.webContents.send("state", {
        profile: {},
        settings: { enabled: true, reducedMotion: true },
        image,
        moment: { scene: "wake", mood: "morning" },
      });
    }, custom);
    await pet.waitForFunction(
      (image) => document.querySelector("#creature").src === image,
      custom,
    );
    await show(rows[0], 8);
    assert.equal(await pet.locator("#creature").getAttribute("src"), custom);
    assert(
      !(await pet
        .locator("#pet")
        .evaluate((el) => el.classList.contains("scene"))),
    );
    await pet
      .locator("#creature")
      .evaluate((img) => (img.src = "../assets/scenes/missing.svg"));
    await pet.waitForFunction(
      () =>
        document.querySelector("#creature").src.endsWith("/creature.svg") &&
        document.querySelector("#creature").naturalWidth > 0,
    );
    assert.deepEqual(errors, []);
    console.log(
      "PASS: 8 场景昼夜版本解码、行动卡截图、停留/自动收起、最长文案无裁切、窄窗口无横向溢出、自定义形象保留、图片失败回退。",
    );
  } finally {
    if (app) await app.close();
    fs.rmSync(dir, { recursive: true, force: true });
  }
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
