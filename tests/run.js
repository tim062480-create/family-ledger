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
  const noPin = async () => { await wait(450); if (await pg.isVisible("#fsheet") && (await pg.innerText("#fsheet")).includes("要幫你的帳設密碼")) { await pg.click("#fsCancel"); await wait(150); } };
  const tab = async sel => { await pg.evaluate(() => window.scrollTo(0, 0)); await wait(350); await pg.click(sel); };
  const loginAs = async (uid, name, pickSelf = true) => {
    await pg.evaluate(([u, n]) => localStorage.setItem("__nextuser", JSON.stringify({ uid: u, name: n })), [uid, name]);
    if (await pg.isVisible("#who .tile:has-text('其他帳號')")) await pg.click("#who .tile:has-text('其他帳號')"); else await pg.click(".loginBtn >> nth=0");
    await wait(700);
    if (pickSelf && await pg.isVisible("#whoBtns")) { await pg.click("#whoBtns .tile >> nth=0"); await wait(300); }
  };

  // 1. landing
  await pg.goto(BASE); await wait(400);
  ok(await pg.isVisible("#landing"), "landing page shows when signed out");
  ok((await pg.title()).includes("家庭記帳本"), "title has 家庭記帳本");
  await shot("01-landing");

  // 2. sign in as u1 -> wizard
  await pg.evaluate(() => localStorage.setItem("__nextuser", JSON.stringify({ uid: "u1", name: "測試弟弟" })));
  await pg.click(".loginBtn >> nth=0"); await wait(500);
  ok(await pg.isVisible("#wizard"), "wizard after first sign-in");
  await pg.click("#acctBtn"); await wait(300);
  ok(await pg.isVisible("#who") && await pg.isHidden("#wizard"), "account button works even before setup is finished");
  await pg.click("#whoBtns .tile >> nth=0"); await wait(300);
  ok(await pg.isVisible("#wizard"), "picking yourself goes back to setup");
  ok((await pg.isVisible("#fsheet")) && (await pg.innerText("#fsheet")).includes("要幫你的帳設密碼嗎"), "new account is asked once whether to set a password");
  await pg.click("#fsCancel"); await wait(200);
  await pg.fill("#wzBody input", "14000"); await pg.click("#wizard button:has-text('下一題')");
  await wait(100); await pg.click("#wizard button:has-text('下一題')"); await wait(100);
  await pg.click("#wizard button:has-text('下一題')"); await wait(100);
  const [ics] = await Promise.all([pg.waitForEvent("download"), pg.click("#wizard button:has-text('好，加到行事曆')")]);
  ok(ics.suggestedFilename().endsWith(".ics"), "reminder downloads a calendar file");
  const icsText = fs.readFileSync(await ics.path(), "utf8"); ok(/RRULE:FREQ=DAILY/.test(icsText) && /TZID=Asia\/Taipei/.test(icsText), "calendar file repeats daily in Taipei time");
  await pg.click("#wizard button:has-text('完成')"); await wait(400);
  ok(await pg.isVisible("#voice"), "home with 記一筆 after wizard");
  await wait(400);
  ok(!(await pg.isVisible("#fsheet")), "password offer is not repeated");

  // 3. rule-based parsing
  await pg.fill("#vtext", "午餐一百二十元 備註好吃，捷運 30"); await pg.click("#parse"); await wait(150);
  const pv = await pg.$$eval("#preview .pv", rs => rs.map(r => [...r.querySelectorAll("input,select")].map(i => i.value).join("|")));
  ok(pv.length === 2 && pv[0].includes("|120|") && pv[1].includes("|30|"), "parses 中文數字 and two items: " + JSON.stringify(pv));
  await pg.click("#confirm"); await wait(300);
  ok((await pg.innerText("#vmsg")).includes("已記帳"), "confirm writes entries");
  ok(JSON.stringify(await pg.evaluate(() => localParse("活大素食 62 晚餐").map(x => [x.note, x.amount, x.remark]))) === JSON.stringify([["活大素食", 62, "晚餐"]]), "text after the amount becomes 備註");

  // 3b. 記事本：頁面、行程、總日曆、提醒、行事曆檔、筆記
  await pg.evaluate(() => { localStorage.setItem("fl_fold_remind", "1"); localStorage.setItem("fl_fold_month", "1"); });
  await tab("#tabNote"); await wait(200);
  ok(await pg.isVisible("#nlView") && await pg.isVisible("#ncGrid") && await pg.isVisible("#nTabCal"), "notebook tab shows the overall calendar and page buttons");
  await pg.click("#nRemind > :first-child"); await wait(150);
  ok(await pg.isHidden("#nRemind .fbody"), "今明後天 folds when you tap its title");
  await pg.click("#nRemind > :first-child"); await wait(150);
  ok(await pg.isHidden("#appTitle"), "app title hidden outside the home page");
  ok(await pg.isHidden("#nTabsMore"), "other pages fold under 其他");
  await pg.evaluate(() => { document.body.style.minHeight = "4000px"; window.scrollTo(0, 120); }); await wait(100);
  const yb = await pg.evaluate(() => document.getElementById("nTabs").getBoundingClientRect().top);
  await pg.evaluate(() => document.querySelector("#nTabs .ntab:nth-child(2)").click()); await wait(300);
  ok(Math.abs(await pg.evaluate(() => document.getElementById("nTabs").getBoundingClientRect().top) - yb) < 2, "switching pages keeps the screen where it was");
  await pg.evaluate(() => { document.getElementById("nTabCal").click(); document.body.style.minHeight = ""; window.scrollTo(0, 0); }); await wait(300);
  if (await pg.isHidden("#npAdd")) await pg.click("#nTabMore"); await pg.click("#npAdd"); await pg.fill("#fs_t", "期中考"); await pg.click("#fsSave"); await wait(400);
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
  await pg.click("#npItemAdd"); await pg.fill("#fs_d", tmr); await pg.fill("#fs_ti", "小組討論"); await pg.fill("#fs_sec", "小組討論"); await pg.click("#fsSave"); await wait(400);
  ok(JSON.stringify(await pg.$$eval("#npItems .nsec", s => s.map(x => x.textContent))) === JSON.stringify(["課程", "小組討論"]) && (await pg.$$eval("#npItems .ntbl", t => t.length)) === 2, "a page can be split into sections, each with its own table");
  await pg.check("#npStarOnly"); await wait(300);
  ok(!(await pg.innerText("#npItems")).includes("還書") && (await pg.innerText("#npItems")).includes("普化期中考"), "只看 ★ hides items that are not on the calendar");
  await pg.uncheck("#npStarOnly"); await wait(200);
  await pg.check("#npPastLast"); await wait(300);
  ok(await pg.evaluate(() => { const rs = [...document.querySelectorAll("#npItems .ntbl tbody tr")]; const i = rs.findIndex(r => r.classList.contains("sep")); return i < 0 || rs.slice(0, i).every(r => !r.classList.contains("past")); }), "過去的放最後 moves past weeks to the end");
  await pg.uncheck("#npPastLast"); await wait(200);
  await pg.click("#npTools"); await wait(100);
  await pg.click("#npStarNone"); await pg.click("#npStarNone"); await wait(400);
  ok((await pg.$$eval("#npItems .nl.star", r => r.length)) === 0, "☆ 全部清除 removes every star on the page");
  await pg.click("#npStarAll"); await pg.click("#npStarAll"); await wait(400);
  ok((await pg.$$eval("#npItems .nl:not(.star)", r => r.length)) === 0, "★ 全部標上 stars every item");
  await pg.locator("#npItems .nl", { hasText: "還書" }).locator(".nstar").click(); await wait(400);
  await pg.locator("#npItems .nl", { hasText: "還書" }).locator(".ntd").click(); await wait(400);
  ok(await pg.evaluate(() => notes.some(p => (p.items || []).some(i => i.title === "還書" && i.todo))), "table row can be put into 待辦 directly");
  await pg.locator("#npItems .nl", { hasText: "還書" }).locator(".ntd").click(); await wait(400);
  const rowStar = pg.locator("#npItems .nl", { hasText: "第三次作業" }).locator(".nstar");
  await rowStar.click(); await wait(400);
  ok((await rowStar.getAttribute("aria-pressed")) === "false", "row ★ button turns the star off directly");
  await pg.click("#npModeL"); await wait(200);
  ok((await pg.$$eval("#npItems .nit", r => r.length)) >= 1 && !(await pg.$("#npItems .ntbl")), "list view still available");
  await pg.click("#npModeT"); await wait(200);
  await pg.fill("#npText", "考試範圍：第 1-5 章"); await wait(1200);
  ok((await pg.evaluate(() => Object.entries(__store).find(([k, v]) => /^users\/u1\/notes\/[^/]+$/.test(k) && v.title === "期中考")[1].text)) === "考試範圍：第 1-5 章", "notes text autosaves");
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
  ok((await pg.$$eval("#nTabsMore .ntab", b => b.map(x => x.textContent))).includes("期中考"), "page has its own button under 其他");
  ok((await pg.$$eval("#nTabs .ntab", b => b.map(x => x.textContent))).length === 3, "top row is just 總日曆 / 待辦 / 其他");
  ok((await pg.$$eval("#nTabs .ntab", b => b.map(x => x.textContent)))[1] === "✅ 待辦", "everyone gets a 待辦 page, first after 總日曆");
  ok(await pg.evaluate(() => { const r = document.getElementById("nRemind"), c = document.querySelector(".ncal"); return !!(c.compareDocumentPosition(r) & Node.DOCUMENT_POSITION_FOLLOWING); }), "今明後天 sits under the calendar");
  const toTodo = async () => { await pg.click("#nTabs .ntab:has-text('待辦')"); await wait(300); };
  await toTodo();
  await pg.click("#nTodoAdd"); await pg.fill("#fs_ti", "領貨");
  ok((await pg.inputValue("#fs_pr")) === "a", "non-school to-do defaults to 雜事"); await pg.click("#fsSave"); await wait(400);
  await pg.click("#nTodoAdd"); await pg.fill("#fs_ti", "AI 作業");
  ok((await pg.inputValue("#fs_pr")) === "s", "homework to-do defaults to 功課"); await pg.click("#fsSave"); await wait(400);
  ok((await pg.innerText("#nTodoList")).includes("📚 功課") && (await pg.innerText("#nTodoList")).includes("📌 雜事"), "to-dos grouped into 雜事 and 功課");
  await pg.click("#nTodoTabs button:has-text('功課')"); await wait(300);
  ok((await pg.innerText("#nTodoList")).includes("AI 作業") && !(await pg.innerText("#nTodoList")).includes("領貨"), "功課 tab shows only homework");
  await pg.click("#nTodoTabs button:has-text('全部')"); await wait(300);
  ok(await pg.isHidden("#nRemind"), "今明後天 only on 總日曆, not on pages");
  await pg.click("#nTabCal"); await wait(300);
  await pg.locator("#nRemind .nit", { hasText: "普化期中考" }).locator(".ntodo").click(); await wait(400);
  await toTodo();
  ok((await pg.innerText("#nTodoList")).includes("普化期中考"), "dated item can be put into 待辦 from the calendar lists: " + (await pg.innerText("#nRemind")).replace(/\n/g," ") + " || " + (await pg.innerText("#nTodoList")).replace(/\n/g," "));
  ok(!(await pg.$("#nRemind .rseg")), "reminder shows only 今明後天 (no range buttons)");
  await pg.locator("#nTodoList .nit", { hasText: "領貨" }).locator(".ncheck").click(); await wait(400);
  ok((await pg.innerText("#nTodoList")).includes("做完了"), "ticking a to-do marks it done");
  await pg.click("#nTabCal"); await wait(300);
  const md5 = await pg.evaluate(() => { const d = new Date(Date.now() + 8 * 3600e3 + 5 * 864e5); return (d.getUTCMonth() + 1) + "/" + d.getUTCDate(); });
  await pg.fill("#nMemo", `學校 不要忘東忘西！\n\n活動：\n${md5} 17:40 看牙齒\n\n🔴事情\n ◦ 領貨\n ◦ 想主題`); await wait(1200);
  const ms = await pg.innerText("#nMemoSum");
  ok(ms.includes("未來一個月") && ms.includes("看牙齒") && ms.includes("普化期中考") && !ms.includes("領貨"), "未來一個月 lists dated memo lines and calendar items (incl. 待辦), not undated ones");
  await pg.locator("#nMemoSum .msr", { hasText: "看牙齒" }).locator(".ntodo").click(); await wait(600);
  ok((await pg.locator("#nMemoSum .msr", { hasText: "看牙齒" }).locator(".ntodo").innerText()) === "已在待辦", "to-do items stay in 未來一個月, ticked");
  await toTodo();
  ok((await pg.innerText("#nTodoList")).includes("看牙齒"), "checking a memo line puts it into 待辦");
  if (await pg.isHidden("#npAdd")) await pg.click("#nTabMore"); await pg.click("#npAdd"); await pg.fill("#fs_t", "行事曆"); await pg.click("#fsSave"); await wait(500);
  await pg.click("#npEdit"); await pg.selectOption("#fs_pos", "0"); await pg.click("#fsSave"); await wait(600);
  ok((await pg.$$eval("#nTabsMore .ntab", b => b.map(x => x.textContent)))[0] === "行事曆", "page can be moved to the front");
  await pg.click("#npEdit"); await pg.selectOption("#fs_kind", "todo"); await pg.click("#fsSave"); await wait(500);
  ok(await pg.isHidden("#npSched") && await pg.isVisible("#npView #nTodo") && (await pg.innerText("#nTodoList")).includes("領貨"), "a page can show the to-do list instead of a schedule");
  await pg.click("#nTabCal"); await wait(300);
  ok(await pg.isHidden("#nTodo"), "總日曆 hides 待辦 once a to-do page exists");
  await pg.click("#nTabCal"); await wait(200);
  ok((await pg.evaluate(() => __store["users/u1/prefs/memo"] && __store["users/u1/prefs/memo"].text)) .startsWith("學校 不要忘東忘西！"), "隨手記 autosaves");
  await tab("#tabCal"); await wait(300);
  ok((await pg.$$eval("#calGrid .l.plan", ls => ls.length)) === 0, "birthday calendar does not show notebook items");
  ok((await pg.innerText("#vCal .vhd h2")) === "朋友和家人生日", "birthday page has its heading");
  ok(JSON.stringify(await pg.$$eval("#tabbar .tab span", s => s.map(x => x.textContent))) === JSON.stringify(["記帳", "記事本", "生日", "AI 輸入", "設定"]), "tab order 記帳・記事本・生日・AI 輸入・設定");
  await tab("#tabRec"); await wait(300);
  ok(await pg.isHidden("#homeRemind"), "home page no longer shows the 3-day reminder");
  ok(await pg.isVisible("#appTitle"), "app title shows on the home page");
  ok((await pg.innerText("#tabCal")).trim() === "生日", "second tab is named 生日");
  await shot("03b-notes");

  // 3d. AI 幫你輸入：貼上 AI 回的 JSON，一鍵加入
  await tab("#tabAi"); await wait(300);
  ok(await pg.isVisible("#aiCopy") && await pg.isHidden("#aiApps"), "AI tab starts with the copy button only");
  await pg.click("#aiCopy"); await wait(200);
  ok(await pg.isVisible("#aiApps") && (await pg.$$eval("#aiApps button", b => b.map(x => x.textContent))).join() === "ChatGPT,Claude,Gemini", "after copying, the three AIs appear");
  ok((await pg.evaluate(() => aiPrompt())).includes("family-ledger-ai") && (await pg.evaluate(() => aiPrompt())).includes("期中考"), "prompt includes the format and my pages");
  const aiJson = '好的，整理如下：\n```json\n' + JSON.stringify({ app: "family-ledger-ai", v: 1, actions: [
    { do: "addExpense", date: "2026-11-02", category: "餐飲", amount: 88, note: "AI午餐", remark: "" },
    { do: "addIncome", date: "2026-11-02", amount: 300, note: "AI打工" },
    { do: "addPage", title: "AI課表", short: "AI", text: "週一上課", items: [{ date: "2026-11-16", time: "10:20", title: "期中考", note: "第 11 週", star: true }, { date: "2026-11-09", time: "", title: "上課", note: "", star: false }] },
    { do: "addTodo", title: "AI買文具", date: "", cat: "雜事", note: "" },
    { do: "addBirthday", name: "AI同學", group: "同學", solar: [12, 1], lunar: null, year: 0 },
    { do: "deleteAll" }] }) + '\n```';
  await pg.fill("#aiIn", aiJson); await pg.click("#aiRead"); await wait(300);
  ok((await pg.innerText("#aiPlan")).includes("要加入 5 筆") && (await pg.innerText("#aiPlan")).includes("看不懂"), "AI reply is previewed; unknown actions are skipped");
  await pg.click("#aiPlan button:has-text('全部加入')"); await wait(1200);
  ok((await pg.innerText("#aiMsg2")).includes("加入完成") && await pg.evaluate(() => Object.values(__store).some(v => v && v.note === "AI午餐" && v.amount === 88) && Object.values(__store).some(v => v && v.title === "AI課表" && v.items && v.items.length === 2) && notes.some(p => p.kind === "todo" && p.items.some(i => i.title === "AI買文具")) && bdays.some(b => b.name === "AI同學")), "AI data is added to the ledger, notebook, to-dos and birthdays");
  await shot("06-ai");

  // 3c0. 每日一句先顯示選擇卡
  await tab("#tabRec"); await wait(300);
  ok((await pg.innerText("#quote")).includes("選一種每日一句") && !(await pg.$("#quote .qt")), "first time shows a theme picker, not 太上感應篇");
  ok((await pg.$$eval("#quote .qpb b", b => b.map(x => x.textContent)))[0] === "改命", "改命 is the first theme");
  await pg.click("#quote .qpb:has-text('輕鬆小品')"); await wait(400);
  ok((await pg.innerText("#quote")).includes("輕鬆小品"), "picking a theme shows its quote");
  // 3c. 自己的每日一句
  await tab("#tabSet"); await pg.click("#setMenu .mi:has-text('背景與每日一句')"); await wait(200);
  await pg.click("#myQuoteAdd"); await pg.fill("#fs_qt", "今天也要好好照顧自己。"); await pg.fill("#fs_qs", "自己"); await pg.click("#fsSave"); await wait(400);
  ok((await pg.innerText("#myQuoteList")).includes("今天也要好好照顧自己"), "own quote is listed in settings");
  await pg.click("#appIconGrid .aib:has-text('小豬撲滿')"); await wait(300);
  ok((await pg.getAttribute('link[rel="apple-touch-icon"]', "href")).includes("piggy"), "home-screen icon can be chosen");
  await pg.selectOption("#quoteSet", "my:我的句子"); await wait(400);
  ok((await pg.$$eval("#quoteSet option", o => o.map(x => x.value))).includes("daojia"), "more built-in themes (道家智慧 etc.)");
  await tab("#tabRec"); await wait(300);
  ok((await pg.innerText("#quote")).includes("今天也要好好照顧自己"), "home shows own quote when my theme is chosen");

  // 4. create a household + invite
  await tab("#tabSet"); await wait(150); await pg.click("#setMenu .mi:has-text('家庭成員與邀請')"); await wait(150);
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
  await tab("#tabSet"); await pg.click("#setMenu .mi:has-text('分享給家人')"); await pg.selectOption("#shareLevel", "full"); await wait(1200);

  // 6. second user joins with the invite link
  await pg.evaluate(() => firebase.auth().signOut()); await wait(200);
  ok(await pg.isVisible("#who") && (await pg.innerText("#who")).includes("選擇使用者") && (await pg.innerText("#who")).includes("測試弟弟"), "signed out -> this device remembers 測試弟弟");
  ok(await pg.isHidden("#landing"), "landing hidden when the device has a profile");
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
  await pg.click("#wizard button:has-text('先不用')"); await pg.click("#wizard button:has-text('完成')"); await wait(300); await noPin();
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
  await loginAs("u1", "測試弟弟", false);
  ok(await pg.isVisible("#whoBtns") && (await pg.innerText("#who")).includes("誰要記帳") && (await pg.innerText("#whoBtns")).includes("媽媽"), "picker shows me and family members");
  await pg.click("#whoBtns .tile:has-text('新增')"); await pg.fill("#fs_n", "姐姐"); await pg.click("#fsSave"); await wait(600);
  ok((await pg.innerText("#whoBtns")).includes("姐姐") && (await pg.innerText("#whoBtns")).includes("待邀請"), "added family member shows as 待邀請");
  await shot("05-who");
  await pg.click("#whoBtns .tile >> nth=0"); await wait(300);
  ok(await pg.isVisible("#tabbar") && await pg.isHidden("#who"), "tapping my tile enters the app");
  await tab("#tabSet"); await pg.click("#setMenu .mi:has-text('帳號')"); await wait(200);
  await pg.click("#acctCard button:has-text('設定密碼')"); await pg.fill("#fs_p1", "2468"); await pg.fill("#fs_p2", "2468"); await pg.click("#fsSave"); await wait(400);
  await pg.click("#acctBtn"); await wait(300); await pg.click("#whoBtns .tile >> nth=0"); await wait(200);
  await pg.fill("#fs_pin", "1111"); await pg.click("#fsSave"); await wait(300);
  ok(await pg.isVisible("#who") && (await pg.innerText("#fsMsg")).includes("不對"), "wrong password keeps you out");
  await pg.fill("#fs_pin", "2468"); await pg.click("#fsSave"); await wait(400);
  ok(await pg.isHidden("#who") && await pg.isVisible("#tabbar"), "right password lets you in");
  await tab("#tabSet"); await pg.click("#setMenu .mi:has-text('帳號')"); await wait(200);
  await pg.click("#acctCard button:has-text('更改或取消密碼')"); await pg.click("#fsDel"); await pg.click("#fsDel"); await wait(400);
  ok(!(await pg.evaluate(() => __store["users/u1"].pinHash)), "password can be removed");
  await pg.click("#acctBtn"); await wait(300);
  await pg.click("#who .whoLock"); await pg.click("#fsSave"); await wait(400);
  ok(!(await pg.isVisible("#whoBtns .tile:has-text('新增')")) && !(await pg.isVisible("#whoBtns .tile:has-text('編輯')")), "新增 and 編輯 can be hidden");
  await pg.click("#whoBtns .tile >> nth=0"); await wait(300);
  await tab("#tabSet"); await pg.click("#setMenu .mi:has-text('帳號')"); await wait(200);
  await pg.click("#acctCard button:has-text('重新顯示')"); await wait(400);
  ok(!(await pg.evaluate(() => __store["users/u1"].whoLocked)), "settings can bring them back");
  await tab("#tabRec"); await wait(200);
  await pg.evaluate(() => { document.body.style.minHeight = "3000px"; window.scrollTo(0, 800); }); await wait(400);
  ok(await pg.evaluate(() => document.getElementById("tabbar").classList.contains("away")), "tab bar hides after scrolling down");
  await pg.evaluate(() => window.scrollTo(0, 0)); await wait(400);
  ok(await pg.evaluate(() => !document.getElementById("tabbar").classList.contains("away")), "tab bar comes back at the top");
  await pg.evaluate(() => { document.body.style.minHeight = ""; });
  // 7b. invite from the 待邀請 tile -> 姐姐 joins and takes over that tile
  await pg.click("#acctBtn"); await wait(300);
  await pg.click("#whoBtns .tile:has-text('姐姐')"); await pg.click("#fsSave"); await wait(600);
  const sisInv = await pg.evaluate(() => { const k = Object.keys(__store).find(k => /\/invites\//.test(k) && __store[k].pname === "姐姐"); return k ? k.split("/")[1] + "." + k.split("/")[3] : ""; });
  ok(!!sisInv, "invite link remembers which tile it is for");
  await pg.click("#whoBtns .tile >> nth=0"); await wait(200);
  await pg.evaluate(() => firebase.auth().signOut()); await wait(200);
  await pg.evaluate(() => localStorage.setItem("__nextuser", JSON.stringify({ uid: "u3", name: "測試姐姐" })));
  await pg.goto(BASE + "?join=" + sisInv); await wait(400); await pg.click(".loginBtn >> nth=0"); await wait(700);
  ok((await pg.inputValue("#joinCard input")) === "姐姐", "join form is pre-filled with the tile's name");
  await pg.click("#joinCard button:has-text('加入')"); await wait(800);
  ok(await pg.evaluate(() => { const k = Object.keys(__store).find(k => /^households\/[^/]+$/.test(k)); return !(__store[k].pending || []).length && __store[k.replace(/$/, "/members/u3")].name === "姐姐"; }), "joining takes over the 待邀請 tile");
  for (let i = 0; i < 3; i++) { await pg.click("#wizard button:has-text('下一題')"); await wait(80); }
  await pg.click("#wizard button:has-text('先不用')"); await pg.click("#wizard button:has-text('完成')"); await wait(300); await noPin();
  await pg.evaluate(() => firebase.auth().signOut()); await wait(200);
  await loginAs("u1", "測試弟弟");
  // 7b2. 音樂：古典樂
  await pg.evaluate(() => window.scrollTo(0, 0)); await pg.click("#musicBtn"); await wait(150);
  await pg.click("#mGenre button[data-g='classic']"); await wait(100);
  ok((await pg.innerText("#mQ")).includes("古典樂"), "music pop-up offers 古典樂");
  ok(await pg.evaluate(() => CLASSICS.length >= 10 && FOLK.length >= 4 && [...CLASSICS, ...FOLK].every(c => { const s = c.build(); return s.ev.length > 50 && s.ev.every(e => e.m > 20 && e.m < 100 && e.t >= 0 && e.d > 0); })), "every classical piece builds valid notes");
  const e0 = errs.length; await pg.click("#mYes"); await wait(700); await pg.click("#mNext"); await wait(500);
  ok(errs.length === e0 && (await pg.innerText("#mQ")).includes("CLASSICS" ? "《" : ""), "classical music plays and skips without errors");
  const nm1 = await pg.innerText("#mQ"); await pg.click("#mPrev"); await wait(300);
  ok((await pg.innerText("#mQ")) !== nm1 && (await pg.innerText("#mQ")).includes("巴哈"), "上一首 goes back a song");
  const e1 = errs.length; await pg.click("#mGenre button[data-g='folk']"); await wait(600);
  ok(errs.length === e1 && (await pg.innerText("#mQ")).includes("綠袖子"), "民謠 plays too");
  await pg.click("#mClose"); await wait(100);
  // 7c. 一鍵邀請全家：一個連結，加入時選「我是哪一位」
  await pg.click("#acctBtn"); await wait(300);
  await pg.click("#whoBtns .tile:has-text('新增')"); await pg.fill("#fs_n", "爸爸"); await pg.click("#fsSave"); await wait(600);
  ok(await pg.isVisible("#who .whoAll"), "one-tap family invite button shows when someone is 待邀請");
  await pg.click("#who .whoAll"); await wait(600);
  const grpInv = await pg.evaluate(() => { const k = Object.keys(__store).find(k => /\/invites\//.test(k) && __store[k].group); return k ? k.split("/")[1] + "." + k.split("/")[3] : ""; });
  ok(!!grpInv && (await pg.innerText("#fsheet")).includes("傳到 LINE"), "group invite link is ready to send to LINE");
  await pg.click("#fsCancel"); await pg.click("#whoBtns .tile >> nth=0"); await wait(200);
  await pg.evaluate(() => firebase.auth().signOut()); await wait(200);
  await pg.evaluate(() => localStorage.setItem("__nextuser", JSON.stringify({ uid: "u4", name: "測試爸爸" })));
  await pg.goto(BASE + "?join=" + grpInv); await wait(400); await pg.click(".loginBtn >> nth=0"); await wait(700);
  ok((await pg.innerText("#joinCard")).includes("你是哪一位"), "group invite asks who you are");
  await pg.click("#joinCard .jt:has-text('爸爸')"); await pg.click("#joinCard button:has-text('加入')"); await wait(800);
  ok(await pg.evaluate(() => { const k = Object.keys(__store).find(k => /^households\/[^/]+$/.test(k)); return !(__store[k].pending || []).some(p => p.name === "爸爸") && __store[k + "/members/u4"].name === "爸爸"; }), "picking your tile takes it over");
  for (let i = 0; i < 3; i++) { await pg.click("#wizard button:has-text('下一題')"); await wait(80); }
  await pg.click("#wizard button:has-text('先不用')"); await pg.click("#wizard button:has-text('完成')"); await wait(300); await noPin();
  await pg.evaluate(() => firebase.auth().signOut()); await wait(200);
  await loginAs("u1", "測試弟弟");
  await tab("#tabSet"); await pg.click("#setMenu .mi:has-text('家庭成員與邀請')"); await wait(200);
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
  await loginAs("u2", "測試媽媽");
  await tab("#tabSet"); await pg.click("#setMenu .mi:has-text('家庭成員與邀請')"); await wait(200);
  await pg.click("#famCard button:has-text('離開這個家')"); await pg.click("#fsSave"); await wait(600);
  ok(!(await pg.evaluate(() => "households/" + Object.keys(__store).find(k => /^households\/[^/]+$/.test(k)).split("/")[1] + "/members/u2" in __store)), "member left the household");
  ok(await pg.isHidden("#ledgerSw"), "ledger switch hidden after leaving");

  ok(errs.length === 0, "no page errors " + JSON.stringify(errs));
  await b.close(); server.close();
})();
