// End-to-end smoke test with a mock Firebase: node tests/run.js
// Needs Playwright (and a Chromium it can launch). Optional: BACKUP=path/to/backup.json to test importing it.
const { chromium } = require("playwright");
const http = require("http"), fs = require("fs"), path = require("path");
const ROOT = path.resolve(__dirname, ".."), PORT = 8765, BASE = `http://localhost:${PORT}/family-ledger/`;
const TYPES = { ".html": "text/html; charset=utf-8", ".js": "text/javascript", ".css": "text/css", ".svg": "image/svg+xml", ".png": "image/png", ".json": "application/json", ".webmanifest": "application/manifest+json", ".txt": "text/plain", ".xml": "application/xml" };
const server = http.createServer((req, res) => {
  let p = decodeURIComponent(new URL(req.url, BASE).pathname).replace(/^\/family-ledger/, "");
  if (p.endsWith("/")) p += "index.html";
  if (p === "/config.js") { res.writeHead(200, { "content-type": "text/javascript" }); return res.end('window.FIREBASE_CONFIG={apiKey:"test",authDomain:"x",projectId:"x"};'); }
  const f = path.join(ROOT, p);
  if (!f.startsWith(ROOT) || !fs.existsSync(f)) { res.writeHead(404); return res.end("nf"); }
  res.writeHead(200, { "content-type": TYPES[path.extname(f)] || "application/octet-stream" }); fs.createReadStream(f).pipe(res);
});
let errs = [];
const ok = (c, m) => { console.log((c ? "PASS " : "FAIL ") + m); if (!c) { process.exitCode = 1; if (errs.length) console.log("     page errors so far:", JSON.stringify(errs)); } };
(async () => {
  await new Promise(r => server.listen(PORT, r));
  const b = await chromium.launch({ executablePath: process.env.CHROMIUM || "/opt/pw-browsers/chromium" }).catch(() => chromium.launch());
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, acceptDownloads: true });
  const mock = fs.readFileSync(path.join(__dirname, "mock-firebase.js"), "utf8");
  await ctx.route("https://www.gstatic.com/**", r => r.fulfill({ contentType: "text/javascript", body: r.request().url().includes("app-compat") ? mock : "" }));
  await ctx.route("https://fonts.googleapis.com/**", r => r.fulfill({ contentType: "text/css", body: "" }));
  const pg = await ctx.newPage(); pg.on("pageerror", e => errs.push(e.message)); pg.on("console", m => { if (m.type() === "error") errs.push("console: " + m.text()) });
  const shot = n => pg.screenshot({ path: path.join(process.env.SHOTS || "/tmp", n + ".png") });
  const wait = ms => pg.waitForTimeout(ms);

  // 1. landing
  await pg.goto(BASE); await wait(400);
  ok(await pg.isVisible("#landing"), "landing page shows when signed out");
  ok((await pg.title()).includes("家庭記帳本"), "title has 家庭記帳本");
  await shot("01-landing");

  // 2. sign in as u1 -> wizard
  await pg.evaluate(() => localStorage.setItem("__nextuser", JSON.stringify({ uid: "u1", name: "測試弟弟" })));
  await pg.click(".loginBtn >> nth=0"); await wait(500);
  ok(await pg.isVisible("#wizard"), "wizard after first sign-in");
  await pg.fill("#wzBody input", "14000"); await pg.click("#wizard button:has-text('下一題')");
  await wait(100); await pg.click("#wizard button:has-text('下一題')"); await wait(100);
  await pg.click("#wizard button:has-text('下一題')"); await wait(100);
  const [ics] = await Promise.all([pg.waitForEvent("download"), pg.click("#wizard button:has-text('好，加到行事曆')")]);
  ok(ics.suggestedFilename().endsWith(".ics"), "reminder downloads a calendar file");
  const icsText = fs.readFileSync(await ics.path(), "utf8"); ok(/RRULE:FREQ=DAILY/.test(icsText) && /TZID=Asia\/Taipei/.test(icsText), "calendar file repeats daily in Taipei time");
  await pg.click("#wizard button:has-text('完成')"); await wait(400);
  ok(await pg.isVisible("#voice"), "home with 記一筆 after wizard");

  // 3. rule-based parsing
  await pg.fill("#vtext", "午餐一百二十元 備註好吃，捷運 30"); await pg.click("#parse"); await wait(150);
  const pv = await pg.$$eval("#preview .pv", rs => rs.map(r => [...r.querySelectorAll("input,select")].map(i => i.value).join("|")));
  ok(pv.length === 2 && pv[0].includes("|120|") && pv[1].includes("|30|"), "parses 中文數字 and two items: " + JSON.stringify(pv));
  await pg.click("#confirm"); await wait(300);
  ok((await pg.innerText("#vmsg")).includes("已記帳"), "confirm writes entries");

  // 3b. 記事本：頁面、行程、總日曆、提醒、行事曆檔、筆記
  await pg.click("#tabNote"); await wait(200);
  ok(await pg.isVisible("#nlView") && await pg.isVisible("#ncGrid") && await pg.isVisible("#nTabCal"), "notebook tab shows the overall calendar and page buttons");
  ok(await pg.isHidden("#appTitle"), "app title hidden outside the home page");
  await pg.click("#npAdd"); await pg.fill("#fs_t", "期中考"); await pg.click("#fsSave"); await wait(400);
  ok(await pg.isVisible("#npView") && (await pg.innerText("#nHead")) === "期中考", "new page opens");
  const tmr = await pg.evaluate(() => new Date(Date.now() + 8 * 3600e3 + 864e5).toISOString().slice(0, 10));
  await pg.click("#npItemAdd"); await pg.fill("#fs_d", tmr); await pg.fill("#fs_ti", "普化期中考"); await pg.fill("#fs_no", "第 1-5 章");
  await pg.selectOption("#fs_rm", "1"); await pg.click("#fsSave"); await wait(400);
  ok((await pg.innerText("#npItems")).includes("普化期中考"), "item listed on its page");
  await pg.click("#npItemAdd"); await pg.fill("#fs_d", tmr); await pg.fill("#fs_ti", "還書");
  ok((await pg.inputValue("#fs_st")) === "0", "ordinary item is not starred by default"); await pg.click("#fsSave"); await wait(400);
  await pg.click("#npItemAdd"); await pg.fill("#fs_d", tmr); await pg.fill("#fs_ti", "第三次作業");
  ok((await pg.inputValue("#fs_st")) === "1", "作業 is starred automatically"); await pg.click("#fsSave"); await wait(400);
  ok((await pg.$$eval("#npItems .ntbl tbody tr", r => r.length)) >= 1, "page shows a table by default");
  await pg.click("#npStarNone"); await pg.click("#npStarNone"); await wait(400);
  ok((await pg.$$eval("#npItems .nl.star", r => r.length)) === 0, "☆ 全部清除 removes every star on the page");
  await pg.click("#npStarAll"); await pg.click("#npStarAll"); await wait(400);
  ok((await pg.$$eval("#npItems .nl:not(.star)", r => r.length)) === 0, "★ 全部標上 stars every item");
  await pg.locator("#npItems .nl", { hasText: "還書" }).locator(".nstar").click(); await wait(400);
  const rowStar = pg.locator("#npItems .nl", { hasText: "第三次作業" }).locator(".nstar");
  await rowStar.click(); await wait(400);
  ok((await rowStar.getAttribute("aria-pressed")) === "false", "row ★ button turns the star off directly");
  await pg.click("#npModeL"); await wait(200);
  ok((await pg.$$eval("#npItems .nit", r => r.length)) >= 1 && !(await pg.$("#npItems .ntbl")), "list view still available");
  await pg.click("#npModeT"); await wait(200);
  await pg.fill("#npText", "考試範圍：第 1-5 章"); await wait(1200);
  ok((await pg.evaluate(() => Object.entries(__store).find(([k]) => /^users\/u1\/notes\/[^/]+$/.test(k))[1].text)) === "考試範圍：第 1-5 章", "notes text autosaves");
  await pg.click("#nTabCal"); await wait(300);
  ok((await pg.innerText("#nRemind")).includes("普化期中考") && !(await pg.innerText("#nRemind")).includes("還書"), "reminder card shows ★ / 通知 items in the next 3 days only");
  const lbl = await pg.$$eval("#ncGrid .pli", ls => ls.map(l => l.lastChild.textContent));
  ok(lbl.some(x => x.startsWith("普化")) && !lbl.some(x => x.includes("還書")), "only ★ items label the calendar: " + JSON.stringify(lbl));
  ok((await pg.$$eval("#ncGrid .pli b", ts => ts.map(x => x.textContent))).includes("期中"), "calendar shows which page (course) an item is from");
  ok(await pg.isHidden("#ncDay"), "day details hidden until a date is tapped");
  await pg.click(`#ncGrid .cday[data-key="${tmr}"]`); await wait(200);
  ok(await pg.isVisible("#ncDay") && (await pg.innerText("#ncDay")).includes("普化期中考"), "tapping a date pops up its items over the calendar");
  await pg.click("#ncDay .npx2"); await wait(150);
  ok(await pg.isHidden("#ncDay"), "pop-up closes");
  const [nics] = await Promise.all([pg.waitForEvent("download"), pg.click("#nIcs")]);
  const nt = fs.readFileSync(await nics.path(), "utf8");
  ok(/SUMMARY:普化期中考/.test(nt) && /TRIGGER:-PT15H/.test(nt) && /TRIGGER:-P1DT15H/.test(nt) && !/還書/.test(nt), "calendar file holds ★ items with 3-day alarms");
  await pg.uncheck("#nSoon"); await wait(300);
  ok((await pg.innerText("#nRemind")).includes("普化期中考"), "explicit 通知 still shows with the 3-day reminder off");
  await pg.check("#nSoon"); await wait(200);
  ok((await pg.$$eval("#nTabs .ntab", b => b.map(x => x.textContent))).includes("期中考"), "page has its own button");
  await pg.click("#nTodoAdd"); await pg.fill("#fs_ti", "領貨");
  ok((await pg.inputValue("#fs_pr")) === "a", "non-school to-do defaults to 雜事"); await pg.click("#fsSave"); await wait(400);
  await pg.click("#nTodoAdd"); await pg.fill("#fs_ti", "AI 作業");
  ok((await pg.inputValue("#fs_pr")) === "s", "homework to-do defaults to 功課"); await pg.click("#fsSave"); await wait(400);
  ok((await pg.innerText("#nTodoList")).includes("📚 功課") && (await pg.innerText("#nTodoList")).includes("📌 雜事"), "to-dos grouped into 雜事 and 功課");
  await pg.click("#nTodoTabs button:has-text('功課')"); await wait(300);
  ok((await pg.innerText("#nTodoList")).includes("AI 作業") && !(await pg.innerText("#nTodoList")).includes("領貨"), "功課 tab shows only homework");
  await pg.click("#nTodoTabs button:has-text('全部')"); await wait(300);
  await pg.locator("#nRemind .nit", { hasText: "普化期中考" }).locator(".ntodo").click(); await wait(400);
  ok((await pg.innerText("#nTodoList")).includes("普化期中考"), "dated item can be put into 待辦 from the calendar lists: " + (await pg.innerText("#nRemind")).replace(/\n/g," ") + " || " + (await pg.innerText("#nTodoList")).replace(/\n/g," "));
  await pg.click("#nRemind .rseg button:has-text('這個月')"); await wait(300);
  ok((await pg.innerText("#nRemind")).includes("這個月"), "reminder range can switch to 這個月");
  await pg.click("#nRemind .rseg button:has-text('今明後天')"); await wait(300);
  await pg.locator("#nTodoList .nit", { hasText: "領貨" }).locator(".ncheck").click(); await wait(400);
  ok((await pg.innerText("#nTodoList")).includes("做完了"), "ticking a to-do marks it done");
  const md5 = await pg.evaluate(() => { const d = new Date(Date.now() + 8 * 3600e3 + 5 * 864e5); return (d.getUTCMonth() + 1) + "/" + d.getUTCDate(); });
  await pg.fill("#nMemo", `學校 不要忘東忘西！\n\n活動：\n${md5} 17:40 看牙齒\n\n🔴事情\n ◦ 領貨\n ◦ 想主題`); await wait(1200);
  const ms = await pg.innerText("#nMemoSum");
  ok(ms.includes("未來一個月") && ms.includes("看牙齒") && !ms.includes("普化期中考") && !ms.includes("領貨"), "未來一個月 lists dated memo lines, not undated ones or items already in 待辦");
  await pg.locator("#nMemoSum .msr", { hasText: "看牙齒" }).locator(".tdck input").check(); await wait(600);
  ok((await pg.innerText("#nTodoList")).includes("看牙齒"), "checking a memo line puts it into 待辦");
  ok(!(await pg.innerText("#nMemoSum")).includes("看牙齒"), "to-do items move out of 未來一個月");
  await pg.click("#npAdd"); await pg.fill("#fs_t", "行事曆"); await pg.click("#fsSave"); await wait(500);
  await pg.click("#npEdit"); await pg.selectOption("#fs_pos", "0"); await pg.click("#fsSave"); await wait(600);
  ok((await pg.$$eval("#nTabs .ntab", b => b.map(x => x.textContent)))[1] === "行事曆", "page can be moved to the front");
  await pg.click("#npEdit"); await pg.selectOption("#fs_kind", "todo"); await pg.click("#fsSave"); await wait(500);
  ok(await pg.isHidden("#npSched") && await pg.isVisible("#npView #nTodo") && (await pg.innerText("#nTodoList")).includes("領貨"), "a page can show the to-do list instead of a schedule");
  await pg.click("#nTabCal"); await wait(200);
  ok((await pg.evaluate(() => __store["users/u1/prefs/memo"] && __store["users/u1/prefs/memo"].text)) .startsWith("學校 不要忘東忘西！"), "隨手記 autosaves");
  await pg.click("#tabCal"); await wait(300);
  ok((await pg.$$eval("#calGrid .l.plan", ls => ls.length)) === 0, "birthday calendar does not show notebook items");
  ok((await pg.innerText("#vCal .vhd h2")) === "朋友和家人生日", "birthday page has its heading");
  ok(JSON.stringify(await pg.$$eval("#tabbar .tab span", s => s.map(x => x.textContent))) === JSON.stringify(["記帳", "記事本", "生日", "設定"]), "tab order 記帳・記事本・生日・設定");
  await pg.click("#tabRec"); await wait(300);
  ok((await pg.innerText("#homeRemind")).includes("普化期中考"), "home shows the reminder");
  ok(await pg.evaluate(() => { const r = document.getElementById("homeRemind"), v = document.getElementById("voice"); return !!(r.compareDocumentPosition(v) & Node.DOCUMENT_POSITION_FOLLOWING); }), "reminder sits above 記一筆");
  ok(await pg.isVisible("#appTitle"), "app title shows on the home page");
  ok((await pg.innerText("#tabCal")).trim() === "生日", "second tab is named 生日");
  await shot("03b-notes");

  // 3c. 自己的每日一句
  await pg.click("#tabSet"); await pg.click("#setMenu .mi:has-text('背景與每日一句')"); await wait(200);
  await pg.click("#myQuoteAdd"); await pg.fill("#fs_qt", "今天也要好好照顧自己。"); await pg.fill("#fs_qs", "自己"); await pg.click("#fsSave"); await wait(400);
  ok((await pg.innerText("#myQuoteList")).includes("今天也要好好照顧自己"), "own quote is listed in settings");
  await pg.selectOption("#quoteSrc", "mine"); await wait(400);
  await pg.click("#tabRec"); await wait(300);
  ok((await pg.innerText("#quote")).includes("今天也要好好照顧自己"), "home shows own quote when 只用我自己的句子");

  // 4. create a household + invite
  await pg.click("#tabSet"); await wait(150); await pg.click("#setMenu .mi:has-text('家庭成員與邀請')"); await wait(150);
  await pg.fill("#famCard input", "簡家"); await pg.click("#famCard button:has-text('建立')"); await wait(400);
  ok((await pg.innerText("#famCard")).includes("簡家"), "household created");
  await pg.click("#famCard button:has-text('產生邀請連結')"); await wait(300);
  const invite = await pg.inputValue("#famCard .invurl");
  ok(/\?join=[^.]+\.[0-9a-f]{32}&openExternalBrowser=1$/.test(invite), "invite link: " + invite);
  await shot("02-family");

  // 5. family ledger
  ok(await pg.isVisible("#ledgerSw"), "ledger switch appears after joining a household");
  await pg.click("#ledgerSw button[data-k=fam]"); await wait(300);
  ok(await pg.isVisible("#wizard"), "family ledger wizard");
  await pg.fill("#wzBody input", "30000"); await pg.click("#wizard button:has-text('下一題')"); await wait(100);
  await pg.click("#wizard button:has-text('下一題')"); await wait(100);
  await pg.click("#wizard button:has-text('完成')"); await wait(300);
  await pg.fill("#vtext", "全聯 478"); await pg.click("#parse"); await wait(100); await pg.click("#confirm"); await wait(300);
  const famExp = await pg.evaluate(() => Object.entries(__store).filter(([k]) => k.includes("/ledgers/main/expenses/") && k.startsWith("households/")).map(([, v]) => v));
  ok(famExp.length === 1 && famExp[0].byName === "測試弟弟", "family expense records who wrote it");
  await pg.click("#ledgerSw button[data-k=me]"); await wait(200);
  await pg.click("#tabSet"); await pg.click("#setMenu .mi:has-text('分享給家人')"); await pg.selectOption("#shareLevel", "full"); await wait(1200);

  // 6. second user joins with the invite link
  await pg.evaluate(() => firebase.auth().signOut()); await wait(200);
  ok(await pg.isVisible("#landing"), "signed out -> landing");
  await pg.evaluate(() => localStorage.setItem("__nextuser", JSON.stringify({ uid: "u2", name: "測試媽媽" })));
  const local = invite.replace(/^https?:\/\/[^/]+\/family-ledger\//, BASE);
  await pg.goto(local); await wait(400);
  ok(await pg.isVisible("#joinHint"), "invite hint on landing");
  await pg.click(".loginBtn >> nth=0"); await wait(600);
  ok((await pg.innerText("#joinCard")).includes("簡家"), "join card names the household");
  await shot("03-join");
  await pg.fill("#joinCard input", "媽媽"); await pg.click("#joinCard button:has-text('加入')"); await wait(600);
  ok(!pg.url().includes("join="), "join param removed from URL");
  ok(await pg.isVisible("#wizard"), "new member gets own ledger wizard");
  for (let i = 0; i < 3; i++) { await pg.click("#wizard button:has-text('下一題')"); await wait(80); }
  await pg.click("#wizard button:has-text('先不用')"); await pg.click("#wizard button:has-text('完成')"); await wait(300);
  await pg.click("#ledgerSw button[data-k=fam]"); await wait(400);
  ok(!(await pg.isVisible("#wizard")) && (await pg.innerText("#monthList")).includes("花"), "member sees the shared family ledger");
  await pg.click(".mrow >> nth=0"); await wait(300);
  ok((await pg.innerText("#rows")).includes("測試弟弟"), "shows who recorded each family entry");
  await shot("04-family-ledger");
  await pg.click("#ledgerSw button[data-k=me]"); await wait(300);
  await pg.click(".mrow >> nth=0"); await wait(300);
  ok((await pg.isVisible("#fam")) && (await pg.innerText("#fam")).includes("測試弟弟") && (await pg.innerText("#famBody")).includes("本月已支出"), "member sees what the other shared");

  // 7. owner sees the new member
  await pg.evaluate(() => firebase.auth().signOut()); await wait(200);
  await pg.evaluate(() => localStorage.setItem("__nextuser", JSON.stringify({ uid: "u1", name: "測試弟弟" })));
  await pg.click(".loginBtn >> nth=0"); await wait(600);
  await pg.click("#tabSet"); await pg.click("#setMenu .mi:has-text('家庭成員與邀請')"); await wait(200);
  ok((await pg.innerText("#famCard")).includes("媽媽"), "owner sees the new member");

  // 8. import a backup (optional real file)
  if (process.env.BACKUP) {
    await pg.click("#setBack"); await pg.click("#setMenu .mi:has-text('匯出與備份')"); await wait(150);
    // Playwright drops change events for non-ASCII paths, so copy to an ASCII name first
    const tmp = path.join(require("os").tmpdir(), "fl-backup-test.json"); fs.copyFileSync(process.env.BACKUP, tmp);
    const [fc] = await Promise.all([pg.waitForEvent("filechooser"), pg.click("#bkImport")]); await fc.setFiles(tmp); await wait(500);
    ok((await pg.innerText("#bkConfirm")).includes("筆支出"), "backup preview: " + (await pg.innerText("#bkConfirm")).slice(0, 60));
    await pg.click("#bkConfirm button:has-text('匯入')"); await wait(2500);
    ok((await pg.innerText("#bkMsg")).includes("匯入完成"), "import finished: " + await pg.innerText("#bkMsg"));
    const [dl] = await Promise.all([pg.waitForEvent("download"), pg.click("#bkExport")]);
    const back = JSON.parse(fs.readFileSync(await dl.path(), "utf8"));
    ok(back.app === "family-ledger" && back.expenses.length > 0, "backup export round-trips");
  }

  // 9. member leaves
  await pg.evaluate(() => firebase.auth().signOut()); await wait(200);
  await pg.evaluate(() => localStorage.setItem("__nextuser", JSON.stringify({ uid: "u2", name: "測試媽媽" })));
  await pg.click(".loginBtn >> nth=0"); await wait(600);
  await pg.click("#tabSet"); await pg.click("#setMenu .mi:has-text('家庭成員與邀請')"); await wait(200);
  await pg.click("#famCard button:has-text('離開這個家')"); await pg.click("#fsSave"); await wait(600);
  ok(!(await pg.evaluate(() => "households/" + Object.keys(__store).find(k => /^households\/[^/]+$/.test(k)).split("/")[1] + "/members/u2" in __store)), "member left the household");
  ok(await pg.isHidden("#ledgerSw"), "ledger switch hidden after leaving");

  ok(errs.length === 0, "no page errors " + JSON.stringify(errs));
  await b.close(); server.close();
})();
