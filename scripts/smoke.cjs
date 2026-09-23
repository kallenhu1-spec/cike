const { _electron: electron } = require("playwright");
const fs = require("node:fs"),
  os = require("node:os"),
  path = require("node:path"),
  assert = require("node:assert/strict");
const output = process.env.CIKE_ARTIFACT_DIR || "artifacts";
(async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "cike-smoke-"));
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
    assert.equal(await pet.evaluate(() => typeof require), "undefined");
    await pet.evaluate(async () => {
      const s = await window.cike.call("get");
      s.profile.nickname = "小夏";
      await window.cike.call("save", s);
    });
    await app.evaluate(({ BrowserWindow }) => {
      const p = BrowserWindow.getAllWindows()[0];
      p.webContents.send("speak", { text: "小夏，下午的光，适合浪费一点点。" });
    });
    await pet.locator("#bubble.visible").waitFor();
    await pet.waitForTimeout(1000);
    fs.mkdirSync(output, { recursive: true });
    await pet.screenshot({
      path: path.join(output,"桌面小生命.png"),
      omitBackground: true,
    });
    const next = app.waitForEvent("window");
    await app.evaluate(({ app }) => app.emit("second-instance"));
    const settings = await next;
    settings.on("pageerror", (e) => errors.push(e.message));
    await settings.waitForSelector("input[name=nickname]");
    await settings.locator("input[name=nickname]").fill("小夏");
    await settings.locator("input[name=joys]").fill("热茶、窗边、植物");
    await settings.locator("button[type=submit]").click();
    await settings.locator("#status").filter({ hasText: "已经记住" }).waitFor();
    assert.equal(
      await pet.evaluate(
        async () => (await window.cike.call("get")).profile.nickname,
      ),
      "小夏",
    );
    const memoryBefore = await settings.evaluate(async () =>
      JSON.stringify((await window.cike.call("get")).memory),
    );
    const scenes = [
      ["08:00", "慢慢醒来"],
      ["10:30", "上午的小空隙"],
      ["12:15", "午饭前后"],
      ["15:30", "午后的松口气"],
      ["18:30", "傍晚的日常"],
      ["22:30", "准备收尾"],
      ["00:30", "夜里轻一点"],
    ];
    for (const [time, label] of scenes) {
      await settings.locator("#preview-time").selectOption(time);
      await settings.locator("#preview").click();
      await settings
        .locator("#preview-reason")
        .filter({ hasText: label })
        .waitFor();
      assert(
        (await settings.locator("#preview-text").textContent()).length > 3,
      );
    }
    assert.equal(
      await settings.evaluate(async () =>
        JSON.stringify((await window.cike.call("get")).memory),
      ),
      memoryBefore,
    );
    await settings.locator("#preview-time").selectOption("12:15");
    await settings.locator("#preview").click();
    await settings
      .locator("#preview-reason")
      .filter({ hasText: "午饭前后" })
      .waitFor();
    await pet.waitForTimeout(1000);
    await pet.screenshot({
      path: path.join(output,"时段陪伴-午间.png"),
      omitBackground: true,
    });
    await settings.evaluate(() => window.scrollTo(0, 0));
    await settings.screenshot({ path: path.join(output,"时段陪伴-设置.png") });
    await settings.locator(".moment-card").screenshot({path:path.join(output,"时段陪伴-试听卡片.png")});
    await settings.screenshot({
      path: path.join(output,"偏好设置.png"),
      fullPage: true,
    });
    await settings.locator("#prompt").click();
    await settings.locator("#prompt-text").waitFor({ state: "visible" });
    assert(
      (await settings.locator("#prompt-text").inputValue()).includes("小夏"),
    );
    const libraryPath = path.join(dir, "personal.json");
    fs.writeFileSync(
      libraryPath,
      JSON.stringify(
        Array.from({ length: 100 }, (_, i) => ({
          id: "p" + String(i + 1).padStart(3, "0"),
          text: "这里是专属陪伴的第" + (i + 1) + "句话。",
          period: ["morning", "afternoon", "night", "any"][i % 4],
          tags: ["陪伴"],
        })),
      ),
    );
    await app.evaluate(({ dialog }, file) => {
      dialog.showOpenDialog = async () => ({
        canceled: false,
        filePaths: [file],
      });
    }, libraryPath);
    await settings.locator("#import").click();
    await settings
      .locator("#library")
      .filter({ hasText: "100 条专属建议" })
      .waitFor();
    assert.equal(
      await pet.evaluate(
        async () => (await window.cike.call("get")).custom.length,
      ),
      100,
    );
    fs.writeFileSync(libraryPath, "[]");
    await settings.locator("#import").click();
    await settings
      .locator("#status")
      .filter({ hasText: "必须恰好 100 条" })
      .waitFor();
    assert.equal(
      await pet.evaluate(
        async () => (await window.cike.call("get")).custom.length,
      ),
      100,
    );
    const invalid = await settings.evaluate(async () => {
      const s = await window.cike.call("get");
      s.settings.dailyMax = 99;
      try {
        await window.cike.call("save", s);
        return false;
      } catch {
        return true;
      }
    });
    assert(invalid);
    assert.equal(errors.length, 0, errors.join("\n"));
    await app.close();
    app = null;
    app = await electron.launch({
      ...(process.env.CIKE_EXECUTABLE
        ? { executablePath: process.env.CIKE_EXECUTABLE, args: [] }
        : { args: [path.resolve(__dirname, "..")] }),
      env: { ...process.env, CIKE_TEST_DIR: dir },
    });
    const reopened = await app.firstWindow();
    await reopened.waitForSelector("#pet");
    assert.equal(
      await reopened.evaluate(
        async () => (await window.cike.call("get")).profile.nickname,
      ),
      "小夏",
    );
    assert.equal(
      await reopened.evaluate(
        async () => (await window.cike.call("get")).custom.length,
      ),
      100,
    );
    console.log(
      "PASS: Electron 启动、隔离、冒泡、设置保存、七时段试听与零额度消耗、提示词、100 条导入、导入失败保留旧库、非法输入拒绝、重启持久化；截图已保存。",
    );
  } finally {
    if (app) await app.close();
    fs.rmSync(dir, { recursive: true, force: true });
  }
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
