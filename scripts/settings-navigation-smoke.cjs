const { _electron: electron } = require("playwright");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const assert = require("node:assert/strict");

const root = path.resolve(__dirname, "..");
const output = path.resolve(process.env.CIKE_ARTIFACT_DIR || "artifacts/0.12.1");
fs.mkdirSync(output, { recursive: true });

(async () => {
  const testData = fs.mkdtempSync(path.join(os.tmpdir(), "cike-0121-nav-"));
  let app;
  const errors = [];
  const watch = (page) => page.on("pageerror", (error) => errors.push(`${page.url()}: ${error.message}`));
  try {
    app = await electron.launch({
      ...(process.env.CIKE_EXECUTABLE
        ? { executablePath: process.env.CIKE_EXECUTABLE, args: [] }
        : { args: [root] }),
      env: {
        ...process.env,
        CIKE_TEST_DIR: testData,
        CIKE_VOICE_RUNTIME: path.join(testData, "no-ai-runtime"),
      },
    });
    const pet = await app.firstWindow();
    watch(pet);
    await pet.waitForSelector("#pet");

    const customizerPromise = app.waitForEvent("window");
    await pet.evaluate(() => window.cike.call("customizer"));
    const customizer = await customizerPromise;
    watch(customizer);
    await customizer.waitForSelector("#choose-dango");
    await customizer.locator("#content-list .action-card").first().waitFor();
    assert.deepEqual(
      await customizer.locator("nav button").allTextContents(),
      ["安排治愈小事", "定制桌搭形象", "我的配音室", "调整陪伴偏好", "关于此刻"],
    );
    assert.equal(await customizer.locator("#choose-dango").getAttribute("aria-pressed"), "true");
    await customizer.screenshot({ path: path.join(output, "治愈小事-形象选择.png") });

    const laboratoryPromise = app.waitForEvent("window");
    await customizer.locator('[data-command="appearance"]').click();
    const laboratory = await laboratoryPromise;
    watch(laboratory);
    await laboratory.waitForSelector("#dango-tab:not([hidden])");
    assert.equal(await laboratory.locator('[data-lab-tab="dango"]').getAttribute("aria-pressed"), "true");
    await laboratory.screenshot({ path: path.join(output, "定制桌搭形象-团子.png") });

    await customizer.locator("#choose-personal").click();
    await laboratory.waitForFunction(() => document.querySelector("#personal-tab").hidden === false);
    assert.match(await laboratory.locator("#personal-tab").innerText(), /正在开发中/);
    assert.match(await laboratory.locator("#personal-tab").innerText(), /继续使用你设置好的团子形象/);
    await laboratory.screenshot({ path: path.join(output, "定制形象-开发中.png") });
    await laboratory.locator("#return-to-moments").click();
    await customizer.waitForFunction(() => document.querySelector("#actions").hidden === false);

    await laboratory.locator('[data-lab-tab="dango"]').click();
    await laboratory.waitForFunction(() => document.querySelector("#dango-tab").hidden === false);
    await laboratory.locator('[data-lab-tab="personal"]').click();
    await laboratory.waitForFunction(() => document.querySelector("#personal-tab").hidden === false);

    await customizer.locator('[data-command="appearance"]').click();
    await laboratory.waitForFunction(() => document.querySelector("#dango-tab").hidden === false);

    const voicePromise = app.waitForEvent("window");
    await customizer.locator('[data-command="voice"]').click();
    const voice = await voicePromise;
    watch(voice);
    await voice.waitForSelector("#record-line");
    assert.equal(await voice.locator("#generate").isVisible(), false);
    assert.equal(await voice.locator(".sample").isVisible(), false);
    assert.equal(await voice.locator(".batch").isVisible(), false);
    await voice.screenshot({ path: path.join(output, "我的配音室.png") });

    const preferencesPromise = app.waitForEvent("window");
    await customizer.locator('[data-command="preferences"]').click();
    const preferences = await preferencesPromise;
    watch(preferences);
    await preferences.waitForSelector("#form");

    await customizer.locator('[data-tab="about"]').click();
    assert.match(await customizer.locator("#about").innerText(), /桌搭团子 0\.12\.1/);
    assert.equal(await customizer.locator('nav button[aria-current="page"]').count(), 1);
    await customizer.screenshot({ path: path.join(output, "关于此刻.png") });
    assert.deepEqual(errors, []);
    console.log("PASS 0.12 navigation: five entries, dango/personal tabs, personal-asset fallback, return to healing moments, direct voice/preferences windows, no visible AI voice controls, no page errors.");
  } finally {
    if (app) await app.close();
    fs.rmSync(testData, { recursive: true, force: true });
  }
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
