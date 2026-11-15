// ---- 日記：每天一篇，可以設密碼，日曆可以跳回過去任何一天 ----
// 資料：users/{uid}/diary/{YYYY-MM-DD} = {text, mood, ts}；密碼雜湊放在 prefs/ui.diaryPin
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
  view="diary";if(!dySel){dySel=today();dyY=+dySel.slice(0,4);dyM=+dySel.slice(5,7)}
  render();window.scrollTo(0,0);
}
function renderDiary(){
  if(!diaryRef&&myId)diarySub();
  const locked=dyHasPin()&&!dyOpen;
  $("dyLocked").hidden=!locked;$("dyBody").hidden=locked;
  $("dyLockBtn").textContent=dyHasPin()?"🔒 密碼":"🔓 設密碼";
  if(locked){$("dyPin").value="";$("dyPinMsg").textContent="";return}
  if(!dySel){dySel=today();dyY=+dySel.slice(0,4);dyM=+dySel.slice(5,7)}
  renderDiaryCal();renderDiaryEd();
}
function renderDiaryCal(){
  if(view!=="diary"||(dyHasPin()&&!dyOpen))return;
  $("dyMonth").textContent=`${dyY} 年 ${dyM} 月`;
  $("dyJump").value=dySel||"";$("dyJump").max=today();
  const g=$("dyGrid");g.innerHTML="";
  "日一二三四五六".split("").forEach(w=>g.appendChild(mkEl("div","dyw",w)));
  const first=new Date(Date.UTC(dyY,dyM-1,1)),pad=first.getUTCDay(),days=new Date(Date.UTC(dyY,dyM,0)).getUTCDate(),td=today();
  for(let i=0;i<pad;i++)g.appendChild(mkEl("div","dyc dye"));
  let n=0;
  for(let d=1;d<=days;d++){
    const k=`${dyY}-${String(dyM).padStart(2,"0")}-${String(d).padStart(2,"0")}`,e=diary[k],has=!!(e&&((e.text||"").trim()||e.mood));
    if(has)n++;
    const b=mkEl("button","dyc"+(k===dySel?" sel":"")+(k===td?" td":"")+(has?" has":""));b.type="button";b.dataset.key=k;
    b.appendChild(mkEl("span","dyn",String(d)));b.appendChild(mkEl("span","dym",has?(e.mood||"•"):""));
    b.setAttribute("aria-label",`${dyM} 月 ${d} 日${has?"，有寫日記":""}`);
    if(k>td){b.disabled=true;b.classList.add("fut")}
    b.onclick=()=>{flushDiary();dySel=k;renderDiaryCal();renderDiaryEd()};
    g.appendChild(b);
  }
  $("dyCount").textContent=n?`這個月寫了 ${n} 天`:"這個月還沒寫";
}
function renderDiaryEd(){
  const k=dySel,e=diary[k]||{};
  $("dyTitle").textContent=`${+k.slice(0,4)!==+today().slice(0,4)?k.slice(0,4)+" 年 ":""}${+k.slice(5,7)} 月 ${+k.slice(8)} 日　星期${dyDow(k)}${k===today()?"（今天）":""}`;
  const t=$("dyText");if(document.activeElement!==t||t.dataset.key!==k){t.value=e.text||"";t.dataset.key=k}
  $("dySaved").textContent="";
  const mb=$("dyMoods");mb.innerHTML="";
  MOODS_DY.forEach(m=>{const b=mkEl("button","dymood"+(e.mood===m?" on":""),m);b.type="button";b.setAttribute("aria-pressed",String(e.mood===m));b.setAttribute("aria-label","心情 "+m);
    b.onclick=()=>{const cur=(diary[k]||{}).mood;saveDiary(k,{mood:cur===m?"":m});renderDiaryEd();renderDiaryCal()};mb.appendChild(b)});
  // 往年的今天
  const md=k.slice(5),past=Object.keys(diary).filter(x=>x.slice(5)===md&&x<k&&(diary[x].text||"").trim()).sort().reverse();
  const box=$("dyPast");box.innerHTML="";box.hidden=!past.length;
  if(past.length){box.appendChild(mkEl("h2",null,"往年的今天"));past.forEach(x=>{const r=mkEl("button","dypast");r.type="button";
    r.append(mkEl("b",null,`${x.slice(0,4)} 年 ${diary[x].mood||""}`),mkEl("span",null,(diary[x].text||"").trim().slice(0,60)));
    r.onclick=()=>{flushDiary();dySel=x;dyY=+x.slice(0,4);dyM=+x.slice(5,7);renderDiaryCal();renderDiaryEd();window.scrollTo(0,0)};box.appendChild(r)})}
}
async function saveDiary(k,patch){
  if(!diaryRef)return;const now={...(diary[k]||{}),...patch,ts:Date.now()};diary[k]=now;
  try{await diaryRef.doc(k).set(now,{merge:true});if($("dyText").dataset.key===k)$("dySaved").textContent="已儲存 ✓"}catch(e){$("dySaved").textContent="沒有存到，請再試一次"}
}
function flushDiary(){
  const t=$("dyText");if(!t||!t.dataset.key)return;clearTimeout(dyTimer);dyTimer=null;
  const k=t.dataset.key;if((diary[k]||{}).text===t.value||(!diary[k]&&!t.value))return;saveDiary(k,{text:t.value});
}
function dyShift(n){flushDiary();dyM+=n;if(dyM<1){dyM=12;dyY--}if(dyM>12){dyM=1;dyY++}renderDiaryCal()}
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
  $("dyPrev").onclick=()=>dyShift(-1);$("dyNext").onclick=()=>dyShift(1);
  $("dyToday").onclick=()=>{flushDiary();dySel=today();dyY=+dySel.slice(0,4);dyM=+dySel.slice(5,7);renderDiaryCal();renderDiaryEd()};
  $("dyJump").onchange=e=>{const v=e.target.value;if(!/^\d{4}-\d{2}-\d{2}$/.test(v))return;flushDiary();dySel=v>today()?today():v;dyY=+dySel.slice(0,4);dyM=+dySel.slice(5,7);renderDiaryCal();renderDiaryEd()};
  $("dyText").oninput=()=>{$("dySaved").textContent="…";clearTimeout(dyTimer);dyTimer=setTimeout(flushDiary,800)};
  $("dyText").onblur=flushDiary;
  $("dyLockBtn").onclick=dyEditPin;
  $("dyUnlock").onclick=dyUnlock;$("dyPin").onkeydown=e=>{if(e.key==="Enter")dyUnlock()};
  $("dyForgot").onclick=dyForgot;
  // 離開 App 超過 3 分鐘，回來要重新輸入日記密碼
  document.addEventListener("visibilitychange",()=>{if(document.visibilityState==="hidden"){flushDiary();dyHidAt=Date.now()}else if(dyHidAt&&Date.now()-dyHidAt>3*60e3&&dyHasPin()){dyOpen=false;if(view==="diary")renderDiary()}});
  window.addEventListener("pagehide",flushDiary);
}
