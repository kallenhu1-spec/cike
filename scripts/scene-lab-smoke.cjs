const { _electron: electron } = require("playwright");
const assert = require("node:assert/strict"),
  fs = require("node:fs"),
  os = require("node:os"),
  path = require("node:path");
const root = path.resolve(__dirname, "..");
(async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "cike-lab-"));
  let app;
  const errors = [];
  const launch = () =>
    electron.launch({
      ...(process.env.CIKE_EXECUTABLE
        ? { executablePath: process.env.CIKE_EXECUTABLE, args: [] }
        : { args: [root] }),
      env: { ...process.env, CIKE_TEST_DIR: dir },
    });
  try {
    app = await launch();
    await app.evaluate(({ powerMonitor }) => {
      powerMonitor.getSystemIdleTime = () => 600;
    });
    const pet = await app.firstWindow();
    pet.on("pageerror", (e) => errors.push(e.message));
    await pet.waitForSelector("#pet.scene");
    await pet.waitForFunction(
      () => document.querySelector("#creature").naturalWidth === 600,
    );
    assert.equal(
      await pet
        .locator("#bubble")
        .evaluate((e) => e.classList.contains("visible")),
      false,
    );
    await pet.locator("#pet").screenshot({ path: "artifacts/常驻场景.png" });
    const memory = await pet.evaluate(async () =>
      JSON.stringify((await window.cike.call("get")).memory),
    );
    const seen = [];
    for (let i = 0; i < 6; i++) {
      await pet.locator("#pet").click();
      await pet.locator("#bubble.visible").waitFor();
      await pet.waitForFunction(
        (previous) =>
          document.querySelector("#bubble-text").textContent !== previous,
        seen.at(-1) || "",
      );
      seen.push(await pet.locator("#bubble-text").textContent());
    }
    assert.equal(new Set(seen).size, 6);
    assert.equal(
      await pet.evaluate(async () =>
        JSON.stringify((await window.cike.call("get")).memory),
      ),
      memory,
    );
    await pet.screenshot({ path: "artifacts/点击行动卡.png" });
    await pet.locator("#dismiss").click();
    await pet.locator("#bubble.visible").waitFor({ state: "hidden" });
    assert(
      await pet.locator("#pet").evaluate((e) => e.classList.contains("scene")),
    );
    // Real renderer gesture path: a >6px drag and a cancelled pointer must not draw a card.
    const box = await pet.locator("#pet").boundingBox();
    await pet.mouse.move(box.x + 100, box.y + 80);
    await pet.mouse.down();
    await pet.mouse.move(box.x + 120, box.y + 80, { steps: 3 });
    await pet.mouse.up();
    assert.equal(
      await pet
        .locator("#bubble")
        .evaluate((e) => e.classList.contains("visible")),
      false,
    );
    await pet.locator("#pet").focus();
    await pet.keyboard.press("Enter");
    await pet.locator("#bubble.visible").waitFor();
    const next = app.waitForEvent("window");
    await pet.evaluate(() => window.cike.call("laboratory"));
    const lab = await next;
    lab.on("pageerror", (e) => errors.push(e.message));
    await lab.waitForFunction(
      () => document.querySelector("#scene").naturalWidth === 600,
    );
    await lab.locator('[data-preset="round"]').click();
    await lab.locator("#baseline").click();
    await lab.locator("#face").fill("1");
    await lab.locator("#face").dispatchEvent("input");
    await lab.waitForFunction(
      () => document.querySelector("#face-value").textContent === "下移一点",
    );
    assert.notEqual(
      await lab.locator("#before").getAttribute("src"),
      await lab.locator("#after").getAttribute("src"),
    );
    await lab.locator("#apply").click();
    await lab.locator("#status").filter({ hasText: "已经住到桌面" }).waitFor();
    await pet.waitForFunction(() =>
      document.querySelector("#creature").src.startsWith("data:image/svg+xml"),
    );
    await lab.screenshot({ path: "artifacts/可爱实验室.png", fullPage: true });
    await lab.locator("#night").check();
    await lab.waitForFunction(() =>
      atob(document.querySelector("#scene").src.split(",")[1]).includes(
        "#bdc6cc",
      ),
    );
    await app.evaluate(({ BrowserWindow }) =>
      BrowserWindow.getAllWindows()
        .find((w) => w.getTitle().includes("实验室"))
        .setSize(760, 700),
    );
    await lab.waitForFunction(() => innerWidth === 760);
    assert(
      await lab.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    );
    await lab.screenshot({
      path: "artifacts/可爱实验室-窄窗口.png",
      fullPage: true,
    });
    await assert.rejects(() =>
      pet.evaluate(() => window.cike.call("appearance", { shape: "unsafe" })),
    );
    await app.close();
    app = await launch();
    const restarted = await app.firstWindow();
    await restarted.waitForFunction(() =>
      document.querySelector("#creature").src.startsWith("data:image/svg+xml"),
    );
    const saved = await restarted.evaluate(() => window.cike.call("get"));
    assert.equal(saved.appearance.shape, "round");
    assert.equal(saved.appearance.face, 1);
    await restarted.evaluate(() =>
      window.cike.call("appearance", {
        shape: "paper",
        face: 0,
        eyes: 0,
        expression: "smile",
      }),
    );
    await restarted.waitForFunction(() =>
      document.querySelector("#creature").src.includes("/assets/scenes/"),
    );
    assert.deepEqual(errors, []);
    console.log(
      "PASS: 常驻场景、连续六次点击去重且不占额度、拖动不冒卡、回车提醒、可爱实验室单变量比较、应用、窄窗口、非法参数拒绝、重启保留与恢复。",
    );
  } finally {
    if (app) await app.close();
    fs.rmSync(dir, { recursive: true, force: true });
  }
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
