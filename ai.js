// ---- AI 幫你輸入：用免費的 ChatGPT／Claude／Gemini 整理資料，貼回來一鍵加入 ----
// 網站不呼叫任何 AI；只產生一段說明讓使用者帶去 AI，再讀 AI 回的 JSON。
let aiPlan=null;
const AI_APPS=[["ChatGPT","https://chatgpt.com/"],["Claude","https://claude.ai/new"],["Gemini","https://gemini.google.com/app"]];
function aiPrompt(){
  const t=today(),dw="日一二三四五六"[new Date(t+"T00:00:00Z").getUTCDay()];
  const cs=cats().map(c=>c.name||c).filter(Boolean);
  const pages=(typeof notes!=="undefined"?notes:[]).filter(p=>p.kind!=="todo").map(p=>p.title).filter(Boolean);
  return `你是「家庭記帳本」網站的資料整理小幫手。我會給你文字、截圖或檔案，請把要加進網站的資料整理成下面規定的 JSON。

今天是 ${t}（星期${dw}），台灣時間。
我的記帳類別：${cs.join("、")||"餐飲、交通、購物、娛樂、其他"}
我記事本裡已經有的頁面：${pages.join("、")||"（還沒有）"}
待辦分類：雜事、功課、家

規則：
1. 最後只輸出一個 \`\`\`json 程式碼區塊，內容是 {"app":"family-ledger-ai","v":1,"actions":[ ... ]}。區塊外可以用一兩句話說明。
2. 日期一律寫 YYYY-MM-DD；沒寫年份就用離今天最近的那一年。時間寫 HH:MM（24 小時制），沒有就寫 ""。
3. 看不清楚或不確定的地方，先問我，不要亂猜。
4. actions 裡只能用這幾種 do：
- addExpense 支出：{"do":"addExpense","date":"YYYY-MM-DD","category":"盡量用我的類別","amount":120,"note":"買了什麼","remark":"備註"}
- addIncome 收入：{"do":"addIncome","date":"YYYY-MM-DD","amount":500,"note":"說明"}
- addPage 新增一頁（例如一堂課的課表、一份行事曆）：{"do":"addPage","title":"頁名","short":"日曆上的簡稱，2～4 個字","text":"這頁的筆記（上課時間、地點、成績比例等）","items":[行程, ...]}
- addItems 把行程加到已經有的頁面：{"do":"addItems","page":"頁名","items":[行程, ...]}
  行程的格式：{"date":"YYYY-MM-DD","time":"","title":"要做的事","note":"備註，例如第幾週","star":true 或 false}
  star 代表要不要顯示在總日曆：考試、作業、報告、截止日用 true，一般上課用 false。
- addTodo 待辦：{"do":"addTodo","title":"要做的事","date":"YYYY-MM-DD 或 \"\"","time":"","cat":"雜事、功課、家 三選一","note":""}
- addMemo 在隨手記加一段文字：{"do":"addMemo","text":"內容"}
- addBirthday 生日：{"do":"addBirthday","name":"名字","group":"家人、朋友、同學、其他 四選一","solar":[月,日] 或 null,"lunar":[月,日] 或 null,"year":出生年或 0}
- addQuote 每日一句（我自己的句子）：{"do":"addQuote","text":"句子","src":"出處","theme":"主題名稱"}
5. 一份課表或行事曆用一個 addPage，一個日期一筆行程；同一天有兩件事就寫兩筆。
6. 金額只寫數字（新台幣）。

範例：我說「昨天午餐 120，下週五要交生資作業」，你回：
\`\`\`json
{"app":"family-ledger-ai","v":1,"actions":[
{"do":"addExpense","date":"(昨天的日期)","category":"餐飲","amount":120,"note":"午餐","remark":""},
{"do":"addTodo","title":"交生資作業","date":"(下週五的日期)","time":"","cat":"功課","note":""}]}
\`\`\`

接下來我要給你的資料：`;
}
// 先按「複製說明」，複製好了才出現三個 AI 讓你選
function aiCopy(){
  const p=aiPrompt();
  try{navigator.clipboard&&navigator.clipboard.writeText(p).catch(()=>{$("aiPromptBox").hidden=false;$("aiPromptBox").value=p})}catch(e){}
  if(!navigator.clipboard){$("aiPromptBox").hidden=false;$("aiPromptBox").value=p}
  $("aiCopy").textContent="✅ 已複製，再按一次可以重新複製";
  $("aiMsg1").textContent="選一個 AI 打開，在對話框「貼上」，再接著輸入或上傳你想加的資料。";
  $("aiApps").hidden=false;
}
function aiParse(raw){
  let s=String(raw||"").trim();if(!s)throw new Error("請先貼上 AI 的回覆");
  const fence=s.match(/```(?:json)?\s*([\s\S]*?)```/i);if(fence)s=fence[1].trim();
  else{const a=s.indexOf("{"),b=s.lastIndexOf("}");if(a>=0&&b>a)s=s.slice(a,b+1)}
  s=s.replace(/[“”]/g,'"').replace(/,\s*([}\]])/g,"$1");
  let obj;try{obj=JSON.parse(s)}catch(e){throw new Error("讀不懂這段內容。請 AI 「只用一個 json 程式碼區塊回覆」，再整段貼上。")}
  const acts=Array.isArray(obj)?obj:Array.isArray(obj.actions)?obj.actions:null;if(!acts||!acts.length)throw new Error("裡面沒有要加入的資料");
  return acts;
}
const aiDate=d=>/^\d{4}-\d{2}-\d{2}$/.test(String(d||""))?d:"";
const aiTime=t=>/^\d{1,2}:\d{2}$/.test(String(t||""))?String(t).padStart(5,"0"):"";
const aiCat=c=>{const cs=cats().map(x=>x.name||x);if(cs.includes(c))return c;const f=cs.find(x=>String(c||"").includes(x)||x.includes(String(c||"")));return f||(cs.includes("其他")?"其他":cs[0]||"其他")};
const aiTodoCat=c=>/功課|作業|考|課/.test(c||"")?"s":/家/.test(c||"")?"h":"a";
function aiItem(x){return{id:"i"+Date.now().toString(36)+Math.random().toString(36).slice(2,7),date:aiDate(x.date),time:aiTime(x.time),title:String(x.title||"").slice(0,80),note:String(x.note||"").slice(0,120),star:x.star===true||(x.star!==false&&autoStar(x.title)),remind:null,ts:Date.now()}}
// 每一筆變成預覽：{ok, text, warn, run}
function aiPlanOf(acts){
  return acts.map(a=>{const d=String(a&&a.do||"");
    if(d==="addExpense"){const amt=Math.round(+a.amount||0),dt=aiDate(a.date)||today(),c=aiCat(a.category);
      return{ok:amt>0,text:`💸 支出 ${nMD(dt)}　${c}　${a.note||""}　${fmt(amt)}`,warn:amt>0?(c!==a.category&&a.category?`類別「${a.category}」改成「${c}」`:""):"金額不對",
        run:()=>col.add({...byFields(),date:dt,month:dt.slice(0,7),category:c,amount:amt,note:String(a.note||"").slice(0,60),remark:String(a.remark||"").slice(0,60)})}}
    if(d==="addIncome"){const amt=Math.round(+a.amount||0),dt=aiDate(a.date)||today();
      return{ok:amt>0,text:`💰 收入 ${nMD(dt)}　${a.note||""}　${fmt(amt)}`,warn:amt>0?"":"金額不對",run:()=>incCol.add({...byFields(),date:dt,month:dt.slice(0,7),amount:amt,note:String(a.note||"").slice(0,60)})}}
    if(d==="addPage"||d==="addItems"){const its=(Array.isArray(a.items)?a.items:[]).map(aiItem).filter(x=>x.title),bad=(a.items||[]).length-its.length;
      const title=String(a.title||a.page||"").slice(0,40)||"新頁面",ex=notes.find(p=>p.title===title);
      const star=its.filter(x=>x.star).length;
      return{ok:!!its.length||d==="addPage",text:`📄 ${ex?"加到":"新頁面"}「${title}」：${its.length} 個行程（${star} 個標 ★）`,warn:bad>0?`${bad} 筆沒有標題，略過`:"",
        run:async()=>{const p=notes.find(x=>x.title===title);
          if(p)await notesRef.doc(p.id).update({items:(p.items||[]).concat(its),...(a.text&&!p.text?{text:String(a.text).slice(0,20000)}:{})});
          else await notesRef.add({title,short:String(a.short||"").slice(0,6)||autoShort(title),text:String(a.text||"").slice(0,20000),items:its,ts:Date.now(),order:Date.now()})}}}
    if(d==="addTodo"){const it={...aiItem(a),todo:true,pri:aiTodoCat(a.cat),star:!!aiDate(a.date)};
      return{ok:!!it.title,text:`✅ 待辦（${PRI_TXT[it.pri]}）：${it.title}${it.date?"　"+nMD(it.date):""}`,warn:it.title?"":"沒有標題",
        run:async()=>{const p=notes.find(x=>x.kind==="todo")||notes[0];if(!p){await notesRef.add({title:"待辦",kind:"todo",text:"",items:[it],ts:Date.now(),order:Date.now()});return}await notesRef.doc(p.id).update({items:(p.items||[]).concat([it])})}}}
    if(d==="addMemo"){const tx=String(a.text||"").slice(0,5000);
      return{ok:!!tx,text:`📝 隨手記：${tx.slice(0,40)}${tx.length>40?"…":""}`,warn:"",run:async()=>{const v=(memoText?memoText+"\n\n":"")+tx;memoText=v;await memoRef.set({text:v.slice(0,20000),ts:Date.now()})}}}
    if(d==="addBirthday"){const s=Array.isArray(a.solar)&&+a.solar[0]?[+a.solar[0],+a.solar[1]||0]:null,l=Array.isArray(a.lunar)&&+a.lunar[0]&&+a.lunar[1]?[+a.lunar[0],+a.lunar[1]]:null;
      const g=GRPS.includes(a.group)?a.group:"朋友",name=String(a.name||"").slice(0,20);
      return{ok:!!name&&!!(s||l),text:`🎂 生日：${name}（${g}）${s?`國曆 ${s[0]}/${s[1]||"?"}`:""}${l?` 農曆 ${l[0]}/${l[1]}`:""}`,warn:name&&(s||l)?"":"名字或日期不完整",
        run:()=>bdRef.set({list:bdays.concat([{id:Date.now().toString(36)+Math.random().toString(36).slice(2,5),name,g,s,l,y:+a.year||0}])})}}
    if(d==="addQuote"){const tx=String(a.text||"").slice(0,400),th=String(a.theme||"我的句子").slice(0,20);
      return{ok:!!tx,text:`💬 每日一句（${th}）：${tx.slice(0,30)}${tx.length>30?"…":""}`,warn:"",run:async()=>{const nl=myQuotes().concat([{id:"q"+Date.now().toString(36)+Math.random().toString(36).slice(2,5),t:tx,src:String(a.src||"").slice(0,60),theme:th}]);curPrefs={...(curPrefs||{}),myQuotes:nl};await prefsRef.set({myQuotes:nl},{merge:true})}}}
    return{ok:false,text:`❓ 看不懂的項目：${d||JSON.stringify(a).slice(0,40)}`,warn:"這個網站不支援，略過",run:null};
  });
}
function renderAiPlan(){
  const box=$("aiPlan");box.innerHTML="";if(!aiPlan){box.hidden=true;return}box.hidden=false;
  const n=aiPlan.filter(x=>x.ok&&x.on!==false).length;
  box.appendChild(mkEl("h3",null,`要加入 ${n} 筆`));
  box.appendChild(mkEl("p","sub",curKey==="fam"?"支出和收入會記在「全家的帳」。":"支出和收入會記在「我的帳」。"));
  aiPlan.forEach((x,i)=>{const r=mkEl("label","aip"+(x.ok?"":" bad")),cb=document.createElement("input");cb.type="checkbox";cb.checked=x.ok&&x.on!==false;cb.disabled=!x.ok;
    cb.onchange=()=>{x.on=cb.checked;renderAiPlan()};const t=mkEl("span","t",x.text);if(x.warn)t.appendChild(mkEl("small",null,x.warn));r.append(cb,t);box.appendChild(r)});
  const bt=mkEl("div","bt"),go=mkEl("button",null,`全部加入（${n}）`),no=mkEl("button","ghost","取消");go.type=no.type="button";go.disabled=!n;
  go.onclick=async()=>{go.disabled=true;let done=0,fail=0;for(const x of aiPlan){if(!x.ok||x.on===false||!x.run)continue;try{await x.run();done++}catch(e){fail++}go.textContent=`加入中… ${done}`}
    aiPlan=null;renderAiPlan();$("aiIn").value="";$("aiMsg2").textContent=`加入完成 🎉 ${done} 筆`+(fail?`，${fail} 筆失敗`:"");toast(`已加入 ${done} 筆`)};
  no.onclick=()=>{aiPlan=null;renderAiPlan()};bt.append(go,no);box.appendChild(bt);
}
function renderAi(){
  const g=$("aiApps");if(!g.firstChild){AI_APPS.forEach(([n,u])=>{const b=mkEl("a","aia",n);b.href=u;b.target="_blank";b.rel="noopener noreferrer";g.appendChild(b)})}
  renderAiPlan();
}
function initAi(){
  $("aiCopy").onclick=aiCopy;
  $("tabAi").onclick=()=>{view="ai";render();window.scrollTo(0,0)};
  $("aiRead").onclick=()=>{$("aiMsg2").textContent="";try{aiPlan=aiPlanOf(aiParse($("aiIn").value));renderAiPlan();$("aiPlan").scrollIntoView({behavior:"smooth",block:"start"})}catch(e){aiPlan=null;renderAiPlan();$("aiMsg2").textContent=e.message}};
  $("aiPaste").onclick=async()=>{try{const t=await navigator.clipboard.readText();if(t){$("aiIn").value=t;$("aiRead").click()}}catch(e){$("aiMsg2").textContent="沒辦法自動貼上，請長按輸入框手動貼上"}};
}
