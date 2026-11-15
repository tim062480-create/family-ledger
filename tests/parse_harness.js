// 不開瀏覽器，直接把 app.js 裡的解析程式拿出來跑測試句子：node tests/parse_harness.js
const fs = require("fs"), vm = require("vm");
const src = fs.readFileSync(__dirname + "/../app.js", "utf8");
const cut = (a, b) => { const i = src.indexOf(a), j = src.indexOf(b, i); if (i < 0 || j < 0) throw new Error("找不到 " + a); return src.slice(i, j); };
const code = [
  cut("const PRESETS", "const SITE_URL"),
  "const today=()=>'2026-11-15';const iso=d=>d.toISOString().slice(0,10);",
  "let settings={categories:CATS};const cats=()=>settings.categories;",
  "const toT=x=>String(x||'');const CPW=/優惠券|禮券|券/g;",
  cut("function guess(", "function findDate("),
  cut("function findDate(", "function renderPreview("),
  "this.localParse=localParse;this.setCats=c=>{settings.categories=c};"
].join("\n");
const mine = ["餐飲", "交通", "娛樂", "捐款", "攀岩", "杂项", "洗衣服"].map(name => ({ name }));
const ctx = { CATS: mine, console }; vm.createContext(ctx); vm.runInContext(code, ctx);
const cases = require("./parse_cases.js");
let bad = 0;
const dflt = ["餐飲", "交通", "購物", "娛樂", "其他"].map(name => ({ name }));
for (const [input, want, set] of cases) {
  ctx.setCats(set === "default" ? dflt : mine);
  const got = ctx.localParse(input).map(x => [x.note, x.amount, x.remark, x.category]);
  const ok = JSON.stringify(got) === JSON.stringify(want);
  if (!ok) { bad++; console.log("✗", input, "\n   得到", JSON.stringify(got), "\n   應為", JSON.stringify(want)); }
}
console.log(`${cases.length - bad}/${cases.length} 通過`);
process.exit(bad ? 1 : 0);
