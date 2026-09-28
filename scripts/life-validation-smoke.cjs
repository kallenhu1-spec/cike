const { _electron: electron } = require("playwright");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const output = path.resolve(process.env.CIKE_ARTIFACT_DIR || "artifacts/0.12.2");
fs.mkdirSync(output, { recursive: true });

(async () => {
  const testData = fs.mkdtempSync(path.join(os.tmpdir(), "cike-0122-life-"));
  let app;
  const errors = [];
  const watch = (page) => page.on("pageerror", (error) => errors.push(`${page.url()}: ${error.message}`));
  try {
    app = await electron.launch({
      ...(process.env.CIKE_EXECUTABLE
        ? { executablePath: process.env.CIKE_EXECUTABLE, args: [] }
        : { args: [...(process.platform === "linux" ? ["--no-sandbox", "--headless"] : []), root] }),
      env: {
        ...process.env,
        CIKE_TEST_DIR: testData,
        CIKE_VOICE_RUNTIME: path.join(testData, "no-ai-runtime"),
      },
    });
    const pet = await app.firstWindow();
    watch(pet);
    await pet.waitForSelector("#living-character:not([hidden])");
    assert.match(await pet.locator("#paper-body").getAttribute("src"), /paper-dango\/base-v1\.png$/);
    assert.equal(await pet.locator("#high-five").isVisible(), false);
    assert.equal(
      await pet.locator("#living-character").evaluate((node) => getComputedStyle(node).getPropertyValue("--sip-duration").trim()),
      "5200ms",
    );

    await pet.mouse.move(78, 455);
    const leftGaze = await pet.locator("#living-character").evaluate((node) => getComputedStyle(node).getPropertyValue("--gaze-x"));
    await pet.mouse.move(288, 390);
    const rightGaze = await pet.locator("#living-character").evaluate((node) => getComputedStyle(node).getPropertyValue("--gaze-x"));
    assert.notEqual(leftGaze, rightGaze);
    await pet.evaluate(() => triggerBlink());
    await pet.waitForSelector("#living-character.blinking");
    await pet.waitForSelector("#living-character:not(.blinking)");
    await pet.screenshot({ path: path.join(output, "桌面纸团-视线与眨眼.png") });

    await pet.evaluate(() => window.cike.call("life-demo", "high-five"));
    await pet.waitForFunction(() => document.querySelector("#high-five").dataset.phase === "ready");
    assert.equal(await pet.locator("#high-five").isVisible(), true);
    await pet.screenshot({ path: path.join(output, "桌面纸团-举手等待.png") });
    await pet.locator("#high-five").click();
    await pet.waitForFunction(() => document.querySelector("#high-five").dataset.phase === "done");
    assert.equal(await pet.locator("#high-five").isVisible(), false);
    await pet.screenshot({ path: path.join(output, "桌面纸团-击掌完成.png") });
    await pet.waitForFunction(() => document.querySelector("#high-five").dataset.phase === "");

    await pet.evaluate(() => window.cike.call("life-demo", "sip"));
    await pet.waitForFunction(() => document.querySelector("#pet").dataset.lifeMode === "sip" && document.querySelector("#pet").dataset.playing === "true");
    await pet.waitForTimeout(2200);
    await pet.screenshot({ path: path.join(output, "桌面纸团-喝水中.png") });
    await pet.waitForFunction(() => document.querySelector("#pet").dataset.lifeMode === "idle" && document.querySelector("#pet").dataset.playing === "false", {}, { timeout: 7000 });

    const laboratoryPromise = app.waitForEvent("window");
    await pet.evaluate(() => window.cike.call("laboratory", "personal"));
    const laboratory = await laboratoryPromise;
    watch(laboratory);
    await laboratory.waitForSelector("#personal-tab:not([hidden])");
    assert.equal(await laboratory.locator("#generate-sip-video").isDisabled(), true);
    assert.match(await laboratory.locator("#character-engine").innerText(), /未配置 ARK_API_KEY/);
    await laboratory.screenshot({ path: path.join(output, "生命感试映台.png") });
    assert.deepEqual(errors, []);
    console.log("PASS 0.12.2 life validation: paper master, gaze, blink, two-stage high-five, 5.2s one-shot sip, honest missing-key state, no page errors.");
  } finally {
    if (app) await app.close();
    fs.rmSync(testData, { recursive: true, force: true });
  }
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
