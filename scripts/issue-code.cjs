// 售后交付凭证，不是客户端激活密钥。账本只保存在本机 .private。
const fs = require("node:fs"),
  path = require("node:path"),
  crypto = require("node:crypto");
const [order, tier] = process.argv.slice(2);
if (
  !order ||
  !/^[-a-zA-Z0-9_]{3,80}$/.test(order) ||
  !["full", "supporter"].includes(tier)
) {
  console.error("用法：node scripts/issue-code.cjs ORDER_ID full|supporter");
  process.exit(1);
}
const dir = path.join(__dirname, "../.private"),
  file = path.join(dir, "orders.csv");
fs.mkdirSync(dir, { recursive: true, mode: 0o700 });
const rows = fs.existsSync(file)
  ? fs.readFileSync(file, "utf8").trim().split("\n")
  : ["order,tier,code,created,status"];
const existing = rows.slice(1).find((r) => r.split(",")[0] === order);
if (existing) {
  console.log("此订单已发码：" + existing.split(",")[2]);
  process.exit(0);
}
const code = "CIKE-" + crypto.randomBytes(8).toString("hex").toUpperCase();
rows.push([order, tier, code, new Date().toISOString(), "issued"].join(","));
fs.writeFileSync(file + ".tmp", rows.join("\n") + "\n", { mode: 0o600 });
fs.renameSync(file + ".tmp", file);
console.log(code);
