const { _electron: electron } = require("playwright"),
  fs = require("node:fs"),
  os = require("node:os"),
  path = require("node:path");
(async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "cike-icon-"));
  let app;
  try {
    app = await electron.launch({
      args: [path.resolve(__dirname, "..")],
      env: { ...process.env, CIKE_TEST_DIR: dir },
    });
    const page = await app.firstWindow();
    await page.waitForSelector("#creature");
    await app.evaluate(({ BrowserWindow }) => {
      const w = BrowserWindow.getAllWindows()[0];
      w.setResizable(true);
      w.setSize(1100, 1100);
    });
    await page.locator("#creature").evaluate((el) => {
      document.body.style.width = "1100px";
      document.body.style.height = "1100px";
      document.querySelector("#pet").style.position = "static";
      document.querySelector("#spark").style.display = "none";
      el.style.width = "1024px";
      el.style.height = "1024px";
      el.style.animation = "none";
      el.style.filter = "none";
    });
    await page
      .locator("#creature")
      .screenshot({
        path: "assets/icon.png",
        omitBackground: true,
        scale: "css",
      });
  } finally {
    if (app) await app.close();
    fs.rmSync(dir, { recursive: true, force: true });
  }
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
