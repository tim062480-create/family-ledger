// ---- 日記：每天一篇，可以設密碼，日曆可以跳回過去任何一天 ----
// 資料：users/{uid}/diary/{YYYY-MM-DD} = {entries:[{id,t,mood,ts}], draft}（舊版是 text, mood）；密碼雜湊放在 prefs/ui.diaryPin
let diary={},diaryRef=null,dySel=null,dyY=0,dyM=0,dyOpen=false,dyHidAt=0,dyTimer=null,dyUnsub=null;
const MOODS_DY=["😄","🙂","😐","😢","😡","😴","🥰"];
const dyDow=d=>"日一二三四五六"[new Date(d+"T00:00:00Z").getUTCDay()];
const dyHasPin=()=>!!(curPrefs&&curPrefs.diaryPin);
async function dyHash(pin){const b=await crypto.subtle.digest("SHA-256",new TextEncoder().encode(myId+":diary:"+pin));return [...new Uint8Array(b)].map(x=>x.toString(16).padStart(2,"0")).join("")}

function diarySub(){
  if(dyUnsub){dyUnsub();dyUnsub=null}
  diary={};dyOpen=false;if(!DB||!myId)return;
  diaryRef=DB.collection(`users/${myId}/diary`);
  dyUnsub=diaryRef.onSnapshot(sn=>{diary={};sn.docs.forEach(d=>{diary[d.id]=d.data()});if(view==="diary")renderDiaryCal()},()=>{});
  unsubs.push(()=>{if(dyUnsub){dyUnsub();dyUnsub=null}});
}
function goDiary(){
  view="diary";dySel=today();
  render();window.scrollTo(0,0);
}
function renderDiary(){
  if(!diaryRef&&myId)diarySub();
  const locked=dyHasPin()&&!dyOpen;
  $("dyLocked").hidden=!locked;$("dyBody").hidden=locked;
  $("dyLockBtn").textContent=dyHasPin()?"🔒 密碼":"🔓 設密碼";
  if(locked){$("dyPin").value="";$("dyPinMsg").textContent="";return}
  if(!dySel)dySel=today();
  renderDiaryEd();renderDiaryCal();
}
// 一天可以寫好幾篇：entries=[{id,t,mood,ts}]；舊版的 text 也當成一篇顯示。還沒按儲存的草稿放在 draft
const dyEntries=k=>{const e=diary[k]||{};const a=Array.isArray(e.entries)?e.entries.slice():[];if((e.text||"").trim())a.unshift({id:"old",t:e.text,mood:e.mood||"",ts:e.ts0||0});return a.sort((x,y)=>(x.ts||0)-(y.ts||0))};
const dyHas=k=>dyEntries(k).length>0;
const dySnip=k=>{const a=dyEntries(k);return{mood:a.map(x=>x.mood).filter(Boolean).slice(-3).join(""),t:a.map(x=>(x.t||"").trim()).filter(Boolean).join("　").slice(0,50),n:a.length}};
const dyTime=ts=>{if(!ts)return"";const d=new Date(ts);return String(d.getHours()).padStart(2,"0")+":"+String(d.getMinutes()).padStart(2,"0")};
let dyMood="",dyShowAll=false;
// 下方小格：選日期，或點最近寫過的日子
function renderDiaryCal(){
  if(view!=="diary"||(dyHasPin()&&!dyOpen))return;
  const td=today();$("dyJump").max=td;$("dyJump").value=dySel&&dySel!==td?dySel:"";
  const keys=Object.keys(diary).filter(k=>/^\d{4}-\d{2}-\d{2}$/.test(k)&&dyHas(k)&&k!==dySel).sort().reverse();
  const box=$("dyList");box.innerHTML="";
  if(!keys.length)box.appendChild(mkEl("p","sub","寫過的日記會列在這裡，也可以用上面的「選日期」翻到任何一天。"));
  keys.slice(0,dyShowAll?keys.length:5).forEach(k=>{const sn=dySnip(k),r=mkEl("button","dypast");r.type="button";r.dataset.key=k;
    r.append(mkEl("b",null,`${+k.slice(0,4)!==+td.slice(0,4)?k.slice(0,4)+"/":""}${+k.slice(5,7)}/${+k.slice(8)}（${dyDow(k)}）${k===td?" 今天":""} ${sn.mood}${sn.n>1?`・${sn.n} 篇`:""}`),mkEl("span",null,sn.t||"（只有心情）"));
    r.onclick=()=>dyGo(k);box.appendChild(r)});
  if(keys.length>5){const m=mkEl("button","ghost sm",dyShowAll?"收起":`看全部 ${keys.length} 天`);m.type="button";m.onclick=()=>{dyShowAll=!dyShowAll;renderDiaryCal()};box.appendChild(m)}
  const mo=td.slice(0,7),n=Object.keys(diary).filter(k=>k.startsWith(mo)&&dyHas(k)).length;
  $("dyCount").textContent=n?`這個月寫了 ${n} 天`:"";
}
function dyGo(k){flushDiary();dySel=k>today()?today():k;dyMood="";renderDiaryEd();renderDiaryCal();window.scrollTo({top:0,behavior:"smooth"})}
function renderDiaryEd(){
  const k=dySel,e=diary[k]||{},isT=k===today();
  $("dyTitle").textContent=`${+k.slice(0,4)!==+today().slice(0,4)?k.slice(0,4)+" 年 ":""}${+k.slice(5,7)} 月 ${+k.slice(8)} 日　星期${dyDow(k)}${isT?"（今天）":""}`;
  const t=$("dyText");if(document.activeElement!==t||t.dataset.key!==k){t.value=e.draft||"";t.dataset.key=k}
  $("dySaved").textContent=(e.draft||"").trim()?"草稿":"";$("dyBackRow").hidden=isT;
  $("dySave").disabled=!t.value.trim()&&!dyMood;
  const mb=$("dyMoods");mb.innerHTML="";
  MOODS_DY.forEach(m=>{const b=mkEl("button","dymood"+(dyMood===m?" on":""),m);b.type="button";b.setAttribute("aria-pressed",String(dyMood===m));b.setAttribute("aria-label","心情 "+m);
    b.onclick=()=>{dyMood=dyMood===m?"":m;renderDiaryEd()};mb.appendChild(b)});
  // 這天已經存起來的
  const list=dyEntries(k),box=$("dyEntries");box.innerHTML="";box.hidden=!list.length;
  if(list.length){box.appendChild(mkEl("div","nmh",`${isT?"今天":"這天"}寫的・${list.length} 篇`));
    list.slice().reverse().forEach(x=>{const r=mkEl("button","dyent");r.type="button";
      r.append(mkEl("small",null,[dyTime(x.ts),x.mood].filter(Boolean).join("　")||"　"),mkEl("span",null,(x.t||"").trim()||"（只有心情）"));
      r.onclick=()=>dyEditEntry(k,x);box.appendChild(r)})}
  // 往年的今天
  const md=k.slice(5),past=Object.keys(diary).filter(x=>x.slice(5)===md&&x<k&&dyHas(x)).sort().reverse();
  const pb=$("dyPast");pb.innerHTML="";pb.hidden=!past.length;
  if(past.length){pb.appendChild(mkEl("h2",null,"往年的今天"));past.forEach(x=>{const sn=dySnip(x),r=mkEl("button","dypast");r.type="button";
    r.append(mkEl("b",null,`${x.slice(0,4)} 年 ${sn.mood}`),mkEl("span",null,sn.t));
    r.onclick=()=>dyGo(x);pb.appendChild(r)})}
}
// 合併舊版 text 成一篇，回傳新的 entries 陣列
const dyBase=k=>dyEntries(k).map(x=>x.id==="old"?{...x,id:"o"+Date.now().toString(36)}:x);
async function dyWrite(k,data){
  if(!diaryRef)return false;diary[k]={...(diary[k]||{}),...data};
  try{await diaryRef.doc(k).set(data,{merge:true});return true}catch(e){toast("沒有存到，請再試一次");return false}
}
async function dySaveNow(){
  const k=dySel,t=$("dyText"),tx=t.value.trim();if(!tx&&!dyMood)return;
  const ent={id:"e"+Date.now().toString(36)+Math.random().toString(36).slice(2,5),t:tx,mood:dyMood,ts:Date.now()};
  clearTimeout(dyTimer);dyTimer=null;
  if(await dyWrite(k,{entries:dyBase(k).concat([ent]),text:"",mood:"",draft:"",ts:Date.now()})){
    t.value="";dyMood="";toast("日記存好了 ✓");renderDiaryEd();renderDiaryCal();
  }
}
function dyEditEntry(k,x){
  openForm({title:"修改這篇日記",sub:`${+k.slice(5,7)}/${+k.slice(8)} ${dyTime(x.ts)}`,
    fields:[{key:"dt",label:"內容",value:x.t||"",full:true,textarea:true,max:20000},{key:"dm",label:"心情",value:x.mood||"",options:[["","（不選）"]].concat(MOODS_DY.map(m=>[m,m]))}],
    onSave:async()=>{const l=dyBase(k).map(y=>y.id===x.id||(x.id==="old"&&y.ts===x.ts&&y.t===x.t)?{...y,t:fv("dt").trim(),mood:fv("dm")}:y);await dyWrite(k,{entries:l,text:"",mood:""});renderDiaryEd();renderDiaryCal()},
    onDelete:async()=>{const l=dyBase(k).filter(y=>!(y.id===x.id||(x.id==="old"&&y.ts===x.ts&&y.t===x.t)));await dyWrite(k,{entries:l,text:"",mood:""});renderDiaryEd();renderDiaryCal()}});
  $("fsDel").textContent="刪除這篇";
}
// 還沒按儲存的字先存成草稿，關掉 App 也不會不見
function flushDiary(){
  const t=$("dyText");if(!t||!t.dataset.key)return;clearTimeout(dyTimer);dyTimer=null;
  const k=t.dataset.key;if(((diary[k]||{}).draft||"")===t.value)return;dyWrite(k,{draft:t.value}).then(ok=>{if(ok&&$("dyText").dataset.key===k)$("dySaved").textContent=t.value.trim()?"草稿已暫存":""});
}
function dyEditPin(){
  const has=dyHasPin();
  openForm({title:has?"日記密碼":"幫日記設密碼",sub:"設了以後，每次打開日記都要輸入這組密碼，別人拿到你的手機也看不到。忘記的話，可以用 Google 帳號重新驗證後清除。",
    fields:[{key:"d1",label:"新密碼（4–6 位數字）",type:"password",inputmode:"numeric",full:true},{key:"d2",label:"再輸入一次",type:"password",inputmode:"numeric",full:true}],
    validate:()=>!/^\d{4,6}$/.test(fv("d1"))?"請輸入 4–6 位數字":(fv("d1")!==fv("d2")?"兩次輸入的不一樣":""),
    onSave:async()=>{const h=await dyHash(fv("d1"));await prefsRef.set({diaryPin:h},{merge:true});curPrefs={...(curPrefs||{}),diaryPin:h};dyOpen=true;toast("日記密碼設定好了 🔒");renderDiary()},
    onDelete:has?async()=>{await prefsRef.set({diaryPin:""},{merge:true});curPrefs={...(curPrefs||{}),diaryPin:""};toast("已取消日記密碼");renderDiary()}:null});
  if(has)$("fsDel").textContent="取消密碼";
}
async function dyUnlock(){
  const p=$("dyPin").value.trim();if(!p){$("dyPinMsg").textContent="請輸入密碼";return}
  if(await dyHash(p)!==curPrefs.diaryPin){$("dyPinMsg").textContent="密碼不對，再試一次";$("dyPin").value="";$("dyPin").focus();return}
  dyOpen=true;renderDiary();
}
async function dyForgot(){
  try{
    const u=fbAuth.currentUser;
    if(!u||!u.reauthenticateWithPopup)throw new Error("no");
    await u.reauthenticateWithPopup(new firebase.auth.GoogleAuthProvider());
    await prefsRef.set({diaryPin:""},{merge:true});curPrefs={...(curPrefs||{}),diaryPin:""};dyOpen=true;toast("已用 Google 驗證，日記密碼清除了");renderDiary();
  }catch(e){$("dyPinMsg").textContent="沒有完成 Google 驗證。請再試一次，要用跟這個帳號相同的 Google 帳號。"}
}
function initDiary(){
  $("tabDiary").onclick=()=>{if(typeof flushText==="function")flushText();goDiary()};
  $("dyToday").onclick=()=>dyGo(today());
  $("dyJump").onchange=e=>{const v=e.target.value;if(/^\d{4}-\d{2}-\d{2}$/.test(v))dyGo(v)};
  $("dyText").oninput=()=>{$("dySave").disabled=!$("dyText").value.trim()&&!dyMood;clearTimeout(dyTimer);dyTimer=setTimeout(flushDiary,1500)};
  $("dySave").onclick=dySaveNow;
  $("dyText").onblur=flushDiary;
  $("dyLockBtn").onclick=dyEditPin;
  $("dyUnlock").onclick=dyUnlock;$("dyPin").onkeydown=e=>{if(e.key==="Enter")dyUnlock()};
  $("dyForgot").onclick=dyForgot;
  // 離開 App 超過 3 分鐘，回來要重新輸入日記密碼
  document.addEventListener("visibilitychange",()=>{if(document.visibilityState==="hidden"){flushDiary();dyHidAt=Date.now()}else if(dyHidAt&&Date.now()-dyHidAt>3*60e3&&dyHasPin()){dyOpen=false;if(view==="diary")renderDiary()}});
  window.addEventListener("pagehide",flushDiary);
}
