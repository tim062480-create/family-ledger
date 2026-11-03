// ---- 記事本：自己的行程頁面、總日曆、提醒 ----
// 資料放在 users/{uid}/notes/{頁面}，圖片放在 users/{uid}/notes/{頁面}/imgs/{圖}；只有本人能讀寫。
// 一個頁面：{title, text, items:[{id,date,time,title,note,star,remind}], ts, order}
//   star：要不要顯示在總日曆；remind：null 不通知，0/1/3/7 = 當天／前幾天提醒。
let ncOpen=false,memoRef=null,memoText="",memoTimer=null,notes=[],notesRef=null,notesLoaded=false,noteSel=null,noteImgs=[],noteImgOff=null,noteTxtTimer=null,ncY=0,ncM=0,ncSel="";
const RM_OPTS=[["","不通知"],["0","當天"],["1","前 1 天"],["2","前 2 天"],["3","前 3 天"],["7","前 1 週"]];
const RM_TXT={0:"當天",1:"前 1 天",2:"前 2 天",3:"前 3 天",7:"前 1 週"};
const soonOn=()=>!(curPrefs&&curPrefs.noteSoon===false);
const NOTE_IMG_MAX=12;
const nWK="日一二三四五六";
const nDow=k=>nWK[new Date(k+"T00:00:00Z").getUTCDay()];
const nDays=k=>Math.round((new Date(k+"T00:00:00Z")-new Date(today()+"T00:00:00Z"))/864e5);
const nHasRm=it=>it.remind!==null&&it.remind!==undefined&&it.remind!=="";
const nSort=(a,b)=>(!a.date)-(!b.date)||((a.date||"")+(a.time||"")).localeCompare((b.date||"")+(b.time||""));
const nMD=k=>`${+k.slice(5,7)}/${+k.slice(8,10)}`;
const EN_SHORT=[[/Assignment\s*(\d+)/i,m=>"作業"+m[1]],[/Quiz Portal\s*(M\dQ\d)/i,m=>m[1]],[/Quiz\s*-\s*Module\s*(\d)/i,m=>"Quiz"+m[1]],[/Intragroup|Peer evaluation|Marking/i,()=>"互評"],[/Individual report/i,()=>"個人報告"],[/presentation/i,()=>"報告"],[/Proposal/i,()=>"計畫書"],[/Split into groups/i,()=>"分組"]];
const nShort=t=>{let s=String(t||"");for(const [re,f] of EN_SHORT){const m=re.exec(s);if(m)return f(m)}const ps=s.split("・");if(ps.length>1)s=ps.find(x=>/作業|考|報告|截止|測驗/.test(x))||ps[0];s=s.replace(/^開/,"").replace(/[（(].*$/,"").trim()||s;return s.slice(0,4)};
// 待辦分類：📚 學校（考試、作業、報告、上課）、📌 事務（其他）。舊的 🔴🟢🟡🏠 只保留顯示用。
const PRI={s:"📚",a:"📌",h:"🏠",r:"🔴",g:"🟢",y:"🟡"},PRI_TXT={s:"功課",a:"雜事",h:"家",r:"現在要做",g:"之後要做",y:"學習"},PRI_ORD={a:0,s:1,h:2,r:3,g:4,y:5};
const SCHOOL_KEY=/考|測驗|作業|功課|報告|課|作文|簡報|quiz|exam|homework|hw|assignment|report|presentation|proposal|專題|主題|project|論文|讀書|複習/i;
const HOME_KEY=/家|爸|媽|姐|姊|哥|弟|妹|阿公|阿嬤|爺|奶|牙|看醫生|看診|家人|回家/;
const autoCat=t=>{t=String(t||"");return SCHOOL_KEY.test(t)?"s":HOME_KEY.test(t)?"h":"a"};
const TODO_TABS=[["all","全部"],["a","雜事"],["s","功課"],["h","家"]];
const todoTab=()=>{const v=curPrefs&&curPrefs.noteTodoTab;return TODO_TABS.some(x=>x[0]===v)?v:"all"};
function setTodoTab(k){curPrefs={...(curPrefs||{}),noteTodoTab:k};if(prefsRef)prefsRef.set({noteTodoTab:k},{merge:true}).catch(()=>{});renderTodos()}
const PRI_OPTS=[["","不分類"],["a","📌 雜事"],["s","📚 功課"],["h","🏠 家"]];
const todoSort=(a,b)=>(a.done?1:0)-(b.done?1:0)||(PRI_ORD[a.pri]??9)-(PRI_ORD[b.pri]??9)||(a.date||"9999").localeCompare(b.date||"9999")||(a.ts||0)-(b.ts||0);
const nRel=d=>d===0?"今天":d===1?"明天":d===2?"後天":`${d} 天後`;

// 頁面簡稱：顯示在總日曆上，看得出是哪堂課；沒設定就用頁名前兩個字（英文最多 6 個字母）
const autoShort=t=>{t=String(t||"");return /^[A-Za-z]/.test(t)?t.split(/\s/)[0].slice(0,6):t.slice(0,2)};
const pageTag=p=>p.short!==undefined&&p.short!==null?String(p.short):autoShort(p.title);
function noteItems(){const out=[];notes.forEach(p=>{const tag=pageTag(p);(p.items||[]).forEach(it=>out.push({...it,pid:p.id,page:p.title||"未命名",ptag:it.tag!=null?it.tag:tag}))});return out.sort(nSort)}
function planMap(){const m={};noteItems().forEach(it=>{if(it.star&&it.date)(m[it.date]=m[it.date]||[]).push(it)});return m}
// 最上面的提醒：可以選今明後天、這週、下週、這個月
const RANGES=[["3d","今明後天"]];
const RANGE_TTL={"3d":"今天、明天、後天","week":"這週","next":"下週","month":"這個月"};
const curRange=()=>{const r=curPrefs&&curPrefs.noteRange;return RANGES.some(x=>x[0]===r)?r:"3d"};
const addDays=(k,n)=>{const t=new Date(k+"T00:00:00Z");t.setUTCDate(t.getUTCDate()+n);return t.toISOString().slice(0,10)};
function rangeSpan(r){
  const t=today(),mon=nMon(t);
  if(r==="week")return [t,addDays(mon,6)];
  if(r==="next")return [addDays(mon,7),addDays(mon,13)];
  if(r==="month"){const [y,m]=t.split("-").map(Number);return [t,`${y}-${pad2(m)}-${pad2(new Date(Date.UTC(y,m,0)).getUTCDate())}`]}
  return [t,addDays(t,2)];
}
function dueReminders(r){
  r=r||curRange();const soon=soonOn();
  if(r==="3d")return noteItems().filter(it=>{if(!it.date)return false;const d=nDays(it.date);if(d<0)return false;return (nHasRm(it)&&d<=+it.remind)||(soon&&(it.star||it.todo)&&!it.done&&d<=2)});
  const [s,e]=rangeSpan(r);return noteItems().filter(it=>it.date&&it.date>=s&&it.date<=e&&(it.star||it.todo||nHasRm(it))&&!it.done);
}

function notesSub(){
  notesLoaded=false;notes=[];notesRef=DB.collection(`users/${myId}/notes`);
  unsubs.push(notesRef.onSnapshot(sn=>{
    notes=sn.docs.map(d=>({id:d.id,...d.data()})).sort((a,b)=>(a.order||0)-(b.order||0)||(a.ts||0)-(b.ts||0));notesLoaded=true;
    ensureTodoPage();
    if(loaded&&(view==="note"||view==="cal"||view==="home"))render();
  },()=>{}));
  memoRef=DB.doc(`users/${myId}/prefs/memo`);
  unsubs.push(memoRef.onSnapshot(sn=>{const d=sn.exists?sn.data():null;memoText=(d&&d.text)||"";const ta=$("nMemo");if(ta&&document.activeElement!==ta&&!memoTimer)ta.value=memoText;if(view==="note"&&!noteSel)renderMemoSum()},()=>{}));
  if(noteSel)watchImgs(noteSel);
}
// 每個人都有一頁「待辦」（顯示成待辦清單），放在最前面
let todoMaking=false;
function ensureTodoPage(){
  if(todoMaking||!notesRef||notes.some(x=>x.kind==="todo"))return;todoMaking=true;
  const first=notes.length?Math.min(...notes.map(x=>x.order||0)):Date.now();
  notesRef.add({title:"待辦",kind:"todo",text:"",items:[],ts:Date.now(),order:first-1000}).catch(()=>{}).finally(()=>{setTimeout(()=>{todoMaking=false},3000)});
}
// 可以收起來的卡片：預設收起，只留標題；點標題打開（記在這台裝置）
const foldOpen=k=>{try{return localStorage.getItem("fl_fold_"+k)==="1"}catch(e){return false}};
function foldCard(box,key){
  if(!box||box.hidden||!box.firstElementChild)return;
  const hd=box.firstElementChild,body=mkEl("div","fbody");while(hd.nextSibling)body.appendChild(hd.nextSibling);box.appendChild(body);
  const cnt=key==="remind"?body.querySelectorAll(".nit").length:null,open=foldOpen(key);
  box.classList.add("fold");box.classList.toggle("open",open);body.hidden=!open;
  const h2=hd.matches("h2")?hd:hd.querySelector("h2");
  if(h2&&cnt!=null&&!h2.querySelector(".nct"))h2.appendChild(mkEl("small","nct",cnt?`${cnt} 件`:"沒有事"));
  const ar=mkEl("span","farr",open?"收起 ▴":"展開 ▾");hd.appendChild(ar);
  hd.setAttribute("role","button");hd.tabIndex=0;hd.setAttribute("aria-expanded",open?"true":"false");
  const tg=()=>{const o=body.hidden;body.hidden=!o;box.classList.toggle("open",o);ar.textContent=o?"收起 ▴":"展開 ▾";hd.setAttribute("aria-expanded",o?"true":"false");try{localStorage.setItem("fl_fold_"+key,o?"1":"0")}catch(e){}};
  hd.onclick=e=>{if(e.target.closest("button"))return;tg()};hd.onkeydown=e=>{if(e.key==="Enter"||e.key===" "){e.preventDefault();tg()}};
}
function notesReset(){memoRef=null;memoText="";notes=[];notesRef=null;notesLoaded=false;noteSel=null;noteImgs=[];if(noteImgOff){try{noteImgOff()}catch(e){}noteImgOff=null}}

// ---- 畫面 ----
function renderNotes(){
  let p=noteSel?notes.find(x=>x.id===noteSel):null;
  if(noteSel&&!p&&notesLoaded){closePage();p=null}
  $("nlView").hidden=!!p;$("npView").hidden=!p;$("npEdit").hidden=!p;$("nHead").textContent=p?(p.title||"未命名"):"記事本";
  renderTabs(p);if(p)$("nRemind").hidden=true;else{renderRemindCard($("nRemind"),false);foldCard($("nRemind"),"remind")}
  // 「待辦清單」頁（例如代辦）：不顯示行程表，改顯示跟總日曆一樣的待辦清單
  {const tc=$("nTodo"),tp=!!(p&&p.kind==="todo");$("npSched").hidden=tp;
   if(tp){if(tc.parentElement!==$("npView"))$("npView").insertBefore(tc,$("npSched"));renderTodos()}
   else if(tc.parentElement!==$("nlView"))$("nlView").insertBefore(tc,$("nMemoSum"));
   // 有「待辦清單」頁的話，總日曆就不再顯示待辦
   tc.hidden=!tp&&notes.some(x=>x.kind==="todo")}
  if(p){renderPage(p);return}
  $("nSoon").checked=soonOn();renderNoteCal();renderTodos();{const ta=$("nMemo");if(document.activeElement!==ta&&!memoTimer)ta.value=memoText}renderMemoSum();
}
function renderRemindCard(box,compact){
  if(!box)return;const r=curRange(),due=dueReminders(r),onHome=box.id==="homeRemind";box.innerHTML="";
  box.hidden=onHome&&!due.length;if(box.hidden)return;
  const hd=mkEl("div","rhd");hd.appendChild(mkEl("h2",null,"🔔 "+RANGE_TTL[r]));
  const seg=mkEl("div","seg rseg");seg.setAttribute("role","group");seg.setAttribute("aria-label","提醒的範圍");
  RANGES.forEach(([k,t])=>{const b=mkEl("button",k===r?"on":"",t);b.type="button";b.setAttribute("aria-pressed",k===r?"true":"false");b.onclick=()=>setRange(k);seg.appendChild(b)});
  if(RANGES.length>1)hd.appendChild(seg);box.appendChild(hd);
  if(!due.length){const [s,e]=rangeSpan(r);box.appendChild(mkEl("p","sub",`${nMD(s)}–${nMD(e)} 沒有 ★ 或待辦的事 🎉`));return}
  const lim=compact?(r==="3d"?3:5):40;
  due.slice(0,lim).forEach(it=>box.appendChild(itemRow(it,true)));
  if(due.length>lim){const m=mkEl("button","ghost sm",`還有 ${due.length-lim} 個，看記事本`);m.type="button";m.onclick=()=>{if(view==="note"&&noteSel){closePage();render()}else goNotes()};const bt=mkEl("div","bt");bt.appendChild(m);box.appendChild(bt)}
}
// 標題裡有考試、作業、報告這類字，就自動標 ★；一般上課不標
const NOTE_KEY=/考|測驗|作業|報告|截止|計畫書|quiz|exam|test|homework|assignment|report|presentation|proposal|deadline|due/i;
const autoStar=t=>NOTE_KEY.test(String(t||""));
// 待辦：沒有日期的事一定是待辦；有日期的事也可以「放進待辦」（todo:true），在待辦裡打勾
const isTodo=it=>!it.date||it.todo===true;
function itemRow(it,showPage,inTodo){
  const und=!it.date,d=und?0:nDays(it.date);
  const r=mkEl("div","nit"+(!und&&d<0?" past":"")+(it.star?" star":"")+(und?" todo":"")+(it.done?" done":""));
  const mb=mkEl("button","nmain");mb.type="button";
  const dt=mkEl("span","nd");
  if(und)dt.append(mkEl("b",null,PRI[it.pri]||"📝"),mkEl("small",null,PRI_TXT[it.pri]?PRI_TXT[it.pri].slice(0,2):"待辦"));
  else dt.append(mkEl("b",null,nMD(it.date)),mkEl("small",null,"週"+nDow(it.date)+(it.time?" "+it.time:"")));
  const t=mkEl("span","nt"),tt=mkEl("span","ttl");
  {const tg=showPage?it.ptag:it.tag;if(tg)tt.appendChild(mkEl("span","ptag",tg))}
  tt.appendChild(document.createTextNode((!und&&PRI[it.pri]?PRI[it.pri]+" ":"")+(it.title||"（沒有標題）")));t.appendChild(tt);
  const sub=(it.note||"");if(sub)t.appendChild(mkEl("small",null,sub));
  const ic=mkEl("span","nic");
  if(showPage&&!und&&d>=0){ic.appendChild(mkEl("span","when",nRel(d)))}
  if(nHasRm(it)){const s=mkEl("span","bl","🔔");s.title="提醒："+RM_TXT[+it.remind];ic.appendChild(s)}
  mb.append(dt,t,ic);
  mb.setAttribute("aria-label",(und?`待辦${PRI_TXT[it.pri]?"（"+PRI_TXT[it.pri]+"）":""}${it.done?"，已完成":""}`:`${nMD(it.date)} 週${nDow(it.date)}`)+`${it.time?" "+it.time:""}，${it.title||""}${it.note?"，"+it.note:""}${nHasRm(it)?"，提醒"+RM_TXT[+it.remind]:""}，點一下修改`);
  mb.onclick=()=>{const p=notes.find(x=>x.id===it.pid);if(p)editItem(p,p.items.find(x=>x.id===it.id))};
  if(und||inTodo){const cb=mkEl("button","ncheck"+(it.done?" on":""),it.done?"✓":"");cb.type="button";cb.setAttribute("aria-pressed",it.done?"true":"false");cb.setAttribute("aria-label",`${it.title||""}：完成`);cb.title=it.done?"已完成，點一下改回未完成":"做完了就勾起來";
    cb.onclick=()=>toggleField(it.pid,it.id,"done",cb);r.append(mb,cb);return r}
  const sb=mkEl("button","nstar"+(it.star?" on":""),it.star?"★":"☆");sb.type="button";
  sb.setAttribute("aria-pressed",it.star?"true":"false");sb.setAttribute("aria-label",`${it.title||""}：顯示在總日曆`);sb.title=it.star?"已顯示在總日曆，點一下取消":"點一下顯示在總日曆";
  sb.onclick=()=>toggleField(it.pid,it.id,"star",sb);
  const tb=mkEl("button","ntodo"+(it.todo?" on":""),it.todo?"已在待辦":"＋待辦");tb.type="button";
  tb.setAttribute("aria-pressed",it.todo?"true":"false");tb.setAttribute("aria-label",`${it.title||""}：放進待辦`);
  tb.onclick=()=>toggleTodo(it.pid,it.id,tb);
  r.append(mb,tb,sb);
  return r;
}
async function toggleField(pid,id,k,btn){
  const p=notes.find(x=>x.id===pid);if(!p||!notesRef)return;
  const list=(p.items||[]).map(x=>x.id===id?{...x,[k]:!x[k]}:x),v=!!list.find(x=>x.id===id)[k];
  if(btn){btn.classList.toggle("on",v);btn.textContent=k==="star"?(v?"★":"☆"):(v?"✓":"");btn.setAttribute("aria-pressed",v?"true":"false");btn.disabled=true;const row=btn.closest(".nit,.nl");if(row)row.classList.toggle(k==="star"?"star":"done",v)}
  try{await notesRef.doc(pid).update({items:list});toast(k==="star"?(v?"已顯示在總日曆 ★":"已從總日曆拿掉"):(v?"完成 ✓":"改回還沒做"))}catch(e){toast("沒有存到，請再試一次");if(btn)btn.disabled=false}
}
async function toggleTodo(pid,id,btn){
  const p=notes.find(x=>x.id===pid);if(!p||!notesRef)return;
  const list=(p.items||[]).map(x=>x.id===id?{...x,todo:!x.todo,pri:x.pri||(!x.todo?autoCat(x.title):x.pri)||null}:x),v=!!list.find(x=>x.id===id).todo;
  if(btn){btn.classList.toggle("on",v);btn.textContent=v?"已在待辦":"＋待辦";btn.setAttribute("aria-pressed",v?"true":"false");btn.disabled=true}
  try{await notesRef.doc(pid).update({items:list});toast(v?"已放進待辦 ✓":"已從待辦拿掉")}catch(e){toast("沒有存到，請再試一次");if(btn)btn.disabled=false}
}
async function toggleManyTodo(pid,ids,v,btn){
  const p=notes.find(x=>x.id===pid);if(!p||!notesRef)return;const set=new Set(ids);
  const list=(p.items||[]).map(x=>set.has(x.id)?{...x,todo:v,pri:x.pri||(v?autoCat(x.title+" "+(p.title||"")):x.pri)||null}:x);
  if(btn){btn.classList.toggle("on",v);btn.setAttribute("aria-pressed",v?"true":"false");btn.disabled=true}
  try{await notesRef.doc(pid).update({items:list});toast(v?"已放進待辦":"已從待辦拿掉")}catch(e){toast("沒有存到，請再試一次");if(btn)btn.disabled=false}
}
async function toggleMany(pid,ids,v,btn){
  const p=notes.find(x=>x.id===pid);if(!p||!notesRef)return;const set=new Set(ids);
  const list=(p.items||[]).map(x=>set.has(x.id)?{...x,star:v}:x);
  if(btn){btn.classList.toggle("on",v);btn.textContent=v?"★":"☆";btn.setAttribute("aria-pressed",v?"true":"false");btn.disabled=true;const row=btn.closest(".nl");if(row)row.classList.toggle("star",v)}
  try{await notesRef.doc(pid).update({items:list});toast(v?"已顯示在總日曆 ★":"已從總日曆拿掉")}catch(e){toast("沒有存到，請再試一次");if(btn)btn.disabled=false}
}
function renderTodos(){
  const box=$("nTodoList");box.innerHTML="";
  const grp=x=>x.pri&&PRI[x.pri]?x.pri:autoCat(x.title);
  const every=noteItems().filter(isTodo).map(x=>({...x,pri:grp(x)}));
  // 分頁：全部／雜事／功課／家
  const tab=todoTab(),seg=$("nTodoTabs");seg.innerHTML="";
  TODO_TABS.forEach(([k,t])=>{const c=k==="all"?every.filter(x=>!x.done).length:every.filter(x=>x.pri===k&&!x.done).length;
    const b=mkEl("button",k===tab?"on":"",t+(c?` ${c}`:""));b.type="button";b.setAttribute("aria-pressed",k===tab?"true":"false");b.onclick=()=>setTodoTab(k);seg.appendChild(b)});
  const all=(tab==="all"?every:every.filter(x=>x.pri===tab)).sort(todoSort),open=all.filter(x=>!x.done);
  $("nTodoCount").textContent=every.length?`還有 ${every.filter(x=>!x.done).length} 件沒做`:"";
  if(!all.length){box.appendChild(mkEl("p","sub",tab==="all"?"要做的事放這裡，例如「領貨」「準備面試」；有日期的行程按「＋待辦」也會出現在這裡。做完就打勾。":`「${PRI_TXT[tab]}」沒有要做的事 🎉`));return}
  let last=null;all.forEach(it=>{const g=it.done?"done":(it.pri||"");if(g!==last){last=g;if(tab!=="all"&&g!=="done")return box.appendChild(itemRow(it,true,true));box.appendChild(mkEl("div","nmh",g==="done"?"✓ 做完了":(PRI[g]?PRI[g]+" "+PRI_TXT[g]:"其他")))}box.appendChild(itemRow(it,true,true))});
}
let moreOpen=false;
function renderTabs(p){
  const box=$("nTabs"),more=$("nTabsMore");box.innerHTML="";more.innerHTML="";
  const mk=(to,label,on,fn,id)=>{const b=mkEl("button","ntab"+(on?" on":""),label);b.type="button";b.setAttribute("role","tab");b.setAttribute("aria-selected",on?"true":"false");if(id)b.id=id;b.onclick=fn;to.appendChild(b);return b};
  const go=x=>()=>{if(noteSel!==x.id){flushText();openPage(x.id)}};
  mk(box,"📅 總日曆",!p,()=>{if(noteSel){closePage();render();window.scrollTo(0,0)}},"nTabCal");
  const main=notes.filter(x=>x.kind==="todo"),rest=notes.filter(x=>x.kind!=="todo");
  main.forEach(x=>mk(box,"✅ "+(x.title||"待辦"),p&&p.id===x.id,go(x)));
  const inRest=!!(p&&p.kind!=="todo");if(inRest)moreOpen=true;
  const ob=mk(box,`📂 其他${rest.length?` ${rest.length}`:""} ${moreOpen?"▴":"▾"}`,inRest,()=>{moreOpen=!moreOpen;renderTabs(p)},"nTabMore");
  ob.removeAttribute("role");ob.setAttribute("aria-expanded",moreOpen?"true":"false");ob.setAttribute("aria-controls","nTabsMore");
  more.hidden=!moreOpen;
  rest.forEach(x=>mk(more,x.title||"未命名",p&&p.id===x.id,go(x)));
  const add=mk(more,"＋ 新增頁面",false,newPage,"npAdd");add.setAttribute("aria-label","新增頁面");add.classList.add("add");add.removeAttribute("role");
  const on=more.querySelector(".ntab.on");if(on)requestAnimationFrame(()=>{const l=on.offsetLeft-16;if(l<more.scrollLeft||l+on.offsetWidth>more.scrollLeft+more.clientWidth)more.scrollLeft=Math.max(0,l)});
}
function renderNoteCal(){
  if(!ncY){const t=today();ncY=+t.slice(0,4);ncM=+t.slice(5,7);ncSel=t}
  $("ncTitle").textContent=`${ncY} 年 ${ncM} 月`;
  const first=new Date(Date.UTC(ncY,ncM-1,1)),startDow=first.getUTCDay(),dim=new Date(Date.UTC(ncY,ncM,0)).getUTCDate();
  const pm=planMap(),all={};noteItems().forEach(it=>{all[it.date]=(all[it.date]||0)+1});
  const g=$("ncGrid");g.innerHTML="";const tdy=today(),cells=Math.ceil((startDow+dim)/7)*7;
  for(let k=0;k<cells;k++){
    const dt=new Date(Date.UTC(ncY,ncM-1,1-startDow+k)),y=dt.getUTCFullYear(),m=dt.getUTCMonth()+1,d=dt.getUTCDate(),key=`${y}-${pad2(m)}-${pad2(d)}`,dow=dt.getUTCDay();
    const b=mkEl("button","cday"+(m!==ncM?" out":"")+(dow===0||dow===6?" we":"")+(key===tdy?" today":"")+(key===ncSel?" sel":""));b.type="button";
    const l=mkEl("span","l"),pl=pm[key]||[];
    b.appendChild(mkEl("span","n",String(d)));
    if(pl.length){
      pl.slice(0,2).forEach(x=>{const s=mkEl("span","pli");if(x.ptag){const tg=/^[A-Za-z]/.test(x.ptag)&&x.ptag.length>3?x.ptag.slice(0,2):x.ptag.slice(0,2);s.appendChild(mkEl("b",null,tg))}s.appendChild(document.createTextNode(nShort(x.title)));b.appendChild(s)});
      if(pl.length>2)b.appendChild(mkEl("span","pmore","…+"+(pl.length-2)));
    }else{const inf=dayInfo(y,m,d);if(inf.fest.length){l.textContent=inf.fest[0].replace(/節$/,"").slice(0,4);l.classList.add("fest")}b.appendChild(l)}
    if(all[key]&&!pl.length){const dot=mkEl("i","dot");b.appendChild(dot)}
    b.setAttribute("aria-label",`${m}月${d}日`+(pl.length?"，"+pl.map(x=>(x.ptag?x.ptag+" ":"")+x.title).join("、"):"")+(all[key]?`，共 ${all[key]} 個行程`:""));
    b.dataset.key=key;
    b.onclick=e=>{e.stopPropagation();if(key===ncSel&&ncOpen&&m===ncM){closeDayPop();return}ncSel=key;ncOpen=true;if(m!==ncM){ncY=y;ncM=m}renderNoteCal()};
    g.appendChild(b);
  }
  renderNoteDay();
}
function closeDayPop(){ncOpen=false;const b=$("ncDay");if(b){b.hidden=true;b.innerHTML=""}}
function renderNoteDay(){
  const box=$("ncDay");box.innerHTML="";if(!ncSel||!ncOpen){box.hidden=true;return}
  const [y,m,d]=ncSel.split("-").map(Number);
  const hd=mkEl("div","npop-h");hd.appendChild(mkEl("h2",null,`${m} 月 ${d} 日　星期${nDow(ncSel)}`));
  const x=mkEl("button","ghost npx2","×");x.type="button";x.setAttribute("aria-label","關閉");x.onclick=closeDayPop;hd.appendChild(x);box.appendChild(hd);
  const its=noteItems().filter(x=>x.date===ncSel).sort((a,b)=>(b.star?1:0)-(a.star?1:0)||nSort(a,b));
  if(!its.length)box.appendChild(mkEl("p","sub","這天沒有行程。"));
  its.forEach(it=>box.appendChild(itemRow(it,true)));
  const bt=mkEl("div","bt"),add=mkEl("button","ghost sm","＋ 新增行程在這天");add.type="button";add.onclick=()=>newItemOn(ncSel);bt.appendChild(add);box.appendChild(bt);
  box.hidden=false;placeDayPop();
}
// 小格子放在點的那一列下面；太靠下面就放到那一列上面
function placeDayPop(){
  const box=$("ncDay"),cell=document.querySelector(`#ncGrid .cday[data-key="${ncSel}"]`),card=box.parentElement;if(!cell||!card)return;
  const cr=card.getBoundingClientRect(),r=cell.getBoundingClientRect(),h=box.offsetHeight;
  let top=r.bottom-cr.top+4;if(top+h>card.clientHeight+40&&r.top-cr.top-h-4>0)top=r.top-cr.top-h-4;
  box.style.top=top+"px";
}
function renderPage(p){
  const box=$("npItems");box.innerHTML="";
  const its=(p.items||[]).map(it=>({...it,pid:p.id,page:p.title})).sort(nSort);
  if(!its.length)box.appendChild(mkEl("p","sub","還沒有行程。按「＋ 新增行程」加上日期和要做的事。"));
  const und=its.filter(x=>!x.date).sort(todoSort);if(und.length){box.appendChild(mkEl("div","nmh","待辦（沒有日期）"));und.forEach(it=>box.appendChild(itemRow(it,false)))}
  $("npPastLast").checked=pastLast();
  const tbl=pageMode()==="table";$("npModeT").classList.toggle("on",tbl);$("npModeL").classList.toggle("on",!tbl);
  $("npModeT").setAttribute("aria-pressed",tbl?"true":"false");$("npModeL").setAttribute("aria-pressed",tbl?"false":"true");
  // 一頁可以分好幾段（例如「課程」和「小組討論」），每段各一張表，不會混在一起
  $("npStarOnly").checked=starOnly();
  const datedAll=its.filter(x=>x.date&&(!starOnly()||x.star||x.todo)),secNames=[...new Set(datedAll.map(x=>x.sec||""))].sort((a,b)=>(a?1:0)-(b?1:0));
  const multi=secNames.length>1;
  secNames.forEach(sn=>{
    const dated=datedAll.filter(x=>(x.sec||"")===sn);if(!dated.length)return;
    if(multi)box.appendChild(mkEl("div","nsec",sn||"課程"));
    if(tbl){box.appendChild(weekTable(dated,datedAll));return}
    const grp=list=>{let lastM="";list.forEach(it=>{const mk=it.date.slice(0,7);if(mk!==lastM){lastM=mk;box.appendChild(mkEl("div","nmh",`${+mk.slice(0,4)} 年 ${+mk.slice(5,7)} 月`))}box.appendChild(itemRow(it,false))})};
    if(pastLast()){const fu=dated.filter(x=>nDays(x.date)>=0),pa=dated.filter(x=>nDays(x.date)<0);grp(fu);if(pa.length){box.appendChild(mkEl("div","npast","已經過去"));grp(pa)}}
    else grp(dated);
  });
  const ta=$("npText");if(document.activeElement!==ta&&!noteTxtTimer)ta.value=p.text||"";
  renderPageImgs();
}
// ---- 表格：像學校課表一樣，一週一列，一眼看完 ----
const starOnly=()=>!!(curPrefs&&curPrefs.noteStarOnly);
const pastLast=()=>!!(curPrefs&&curPrefs.notePastLast);
const pageMode=()=>(curPrefs&&curPrefs.noteView)==="list"?"list":"table";
const nMon=k=>{const t=new Date(k+"T00:00:00Z");t.setUTCDate(t.getUTCDate()-((t.getUTCDay()+6)%7));return t.toISOString().slice(0,10)};
function weekTable(items,ref){
  let m0=null,n0=0;
  for(const it of (ref||items)){const m=/第\s*(\d+)\s*週/.exec(it.note||"");if(m){m0=nMon(it.date);n0=+m[1];break}}
  const rows=new Map();
  items.forEach(it=>{const mk=nMon(it.date);if(!rows.has(mk))rows.set(mk,[]);rows.get(mk).push(it)});
  const t=mkEl("table","ntbl"),hd=document.createElement("tr");
  (m0?["週次","日期","內容"]:["日期","內容"]).forEach(h=>hd.appendChild(mkEl("th",null,h)));
  const thead=document.createElement("thead");thead.appendChild(hd);t.appendChild(thead);const tb=document.createElement("tbody");t.appendChild(tb);
  const thisMon=nMon(today()),cols=m0?3:2;
  let keys=[...rows.keys()].sort();
  const isPast=mk=>{const ds=rows.get(mk).map(x=>x.date).sort();return nDays(ds[ds.length-1])<0};
  if(pastLast()){const fu=keys.filter(k=>!isPast(k)),pa=keys.filter(isPast);keys=fu.concat(pa.length?["__sep"]:[],pa)}
  keys.forEach(mk=>{
    if(mk==="__sep"){const tr=mkEl("tr","sep"),td=mkEl("td",null,"已經過去");td.colSpan=cols;tr.appendChild(td);tb.appendChild(tr);return}
    const list=rows.get(mk).sort(nSort),dates=[...new Set(list.map(x=>x.date))],multi=dates.length>1;
    const last=dates[dates.length-1],tr=document.createElement("tr");
    if(nDays(last)<0)tr.className="past";if(mk===thisMon)tr.className="now";
    if(m0){const wn=n0+Math.round((new Date(mk+"T00:00:00Z")-new Date(m0+"T00:00:00Z"))/(7*864e5));tr.appendChild(mkEl("td","wk",`第${wn}週`))}
    tr.appendChild(mkEl("td","dt",dates.map(nMD).join(", ")));
    const c=mkEl("td","ct");
    // 同一週、同樣內容（例如週三週四都是「逆境生理」）合成一行，跟課表一樣
    const groups=[];list.forEach(it=>{const key=(it.title||"")+"|"+(it.star?1:0)+"|"+(it.pri||"");let g=groups.find(x=>x.key===key);if(!g){g={key,its:[]};groups.push(g)}g.its.push(it)});
    groups.forEach(g=>{
      const it=g.its[0],ds=[...new Set(g.its.map(x=>x.date))];
      const l=mkEl("div","nl"+(it.star?" star":""));
      const b=mkEl("button","t");b.type="button";
      b.textContent=(multi&&groups.length>1?ds.map(nMD).join("、")+" ":"")+(PRI[it.pri]?PRI[it.pri]+" ":"")+(it.title||"");
      if(it.time&&/截止|due/i.test(it.title||"")){b.appendChild(mkEl("small",null," "+it.time))}
      b.setAttribute("aria-label",`${ds.map(nMD).join("、")}，${it.title||""}${it.time?"，"+it.time:""}${it.note?"，"+it.note:""}，點一下修改`);
      b.onclick=()=>{const p=notes.find(x=>x.id===it.pid);if(p)editItem(p,p.items.find(x=>x.id===it.id))};
      const sb=mkEl("button","nstar sm"+(it.star?" on":""),it.star?"★":"☆");sb.type="button";
      sb.setAttribute("aria-pressed",it.star?"true":"false");sb.setAttribute("aria-label",`${it.title||""}：顯示在總日曆`);
      sb.onclick=()=>toggleMany(it.pid,g.its.map(x=>x.id),!it.star,sb);
      const allTodo=g.its.every(x=>x.todo),tb=mkEl("button","ntd"+(allTodo?" on":""),"待辦");tb.type="button";
      tb.setAttribute("aria-pressed",allTodo?"true":"false");tb.setAttribute("aria-label",`${it.title||""}：放進待辦`);tb.title=allTodo?"已在待辦，點一下拿掉":"點一下放進待辦";
      tb.onclick=()=>toggleManyTodo(it.pid,g.its.map(x=>x.id),!allTodo,tb);
      l.append(b,tb,sb);c.appendChild(l);
    });
    tr.appendChild(c);tb.appendChild(tr);
  });
  const w=mkEl("div","ntw");w.appendChild(t);return w;
}
function setPageMode(m){curPrefs={...(curPrefs||{}),noteView:m};if(prefsRef)prefsRef.set({noteView:m},{merge:true}).catch(()=>{});const p=notes.find(x=>x.id===noteSel);if(p)renderPage(p)}
function renderPageImgs(){
  const g=$("npImgs");g.innerHTML="";g.hidden=!noteImgs.length;
  const list=noteImgs.map(x=>({id:x.id,full:x.t,cap:""}));
  noteImgs.forEach((x,i)=>{
    const w=mkEl("div","npi");const b=mkEl("button");b.type="button";b.setAttribute("aria-label",`看第 ${i+1} 張圖`);
    const im=document.createElement("img");im.src=x.t;im.alt="";b.appendChild(im);b.onclick=()=>openViewer(list,i);
    const del=mkEl("button","npx","×");del.type="button";del.setAttribute("aria-label",`刪除第 ${i+1} 張圖`);
    del.onclick=async()=>{if(del.dataset.arm!=="1"){del.dataset.arm="1";del.textContent="刪除？";setTimeout(()=>{del.dataset.arm="";del.textContent="×"},2500);return}
      try{await notesRef.doc(noteSel).collection("imgs").doc(x.id).delete()}catch(e){$("npImgMsg").textContent="刪除失敗"}};
    w.append(b,del);g.appendChild(w);
  });
  $("npImgAdd").hidden=noteImgs.length>=NOTE_IMG_MAX;
}

// ---- 動作 ----
function setRange(k){curPrefs={...(curPrefs||{}),noteRange:k};if(prefsRef)prefsRef.set({noteRange:k},{merge:true}).catch(()=>{});render()}
function goNotes(){closeDayPop();view="note";noteSel=null;render();window.scrollTo(0,0)}
function watchImgs(pid){
  if(noteImgOff){try{noteImgOff()}catch(e){}noteImgOff=null}noteImgs=[];if(!notesRef)return;
  const off=notesRef.doc(pid).collection("imgs").onSnapshot(sn=>{if(noteSel!==pid)return;noteImgs=sn.docs.map(d=>({id:d.id,...d.data()})).sort((a,b)=>(a.ts||0)-(b.ts||0));if(view==="note")renderPageImgs()},()=>{});
  noteImgOff=off;unsubs.push(off);
}
function openPage(pid){noteSel=pid;$("npBulkMsg").textContent="";$("npText").value=(notes.find(x=>x.id===pid)||{}).text||"";$("npImgMsg").textContent="";$("npTextMsg").textContent="";watchImgs(pid);view="note";render();window.scrollTo(0,0)}
function closePage(){flushText();noteSel=null;noteImgs=[];if(noteImgOff){try{noteImgOff()}catch(e){}noteImgOff=null}}
function newPage(){
  openForm({title:"新增頁面",sub:"一個主題一頁，例如「這學期課表」「期中考」「社團」。",fields:[{key:"t",label:"頁面名稱",value:"",full:true,placeholder:"例如：這學期課表"}],
    validate:()=>fv("t")?"":"請輸入頁面名稱",
    onSave:async()=>{const r=await notesRef.add({title:fv("t").slice(0,40),text:"",items:[],ts:Date.now(),order:Date.now()});setTimeout(()=>openPage(r.id),0)}});
}
async function movePage(pid,to){
  const list=notes.filter(x=>x.id!==pid),me=notes.find(x=>x.id===pid);if(!me)return;
  list.splice(Math.max(0,Math.min(to,list.length)),0,me);
  const base=Date.now();for(let i=0;i<list.length;i++){const o=base+i*1000;if(list[i].order!==o)await notesRef.doc(list[i].id).update({order:o})}
}
function editPage(){
  const p=notes.find(x=>x.id===noteSel);if(!p)return;
  const others=notes.filter(x=>x.id!==p.id),idx=notes.findIndex(x=>x.id===p.id),lastTodo=p.kind==="todo"&&notes.filter(x=>x.kind==="todo").length===1;
  const posOpts=[["0","最前面（總日曆後面）"]].concat(others.map((x,i)=>[String(i+1),`「${x.title||"未命名"}」後面`]));
  openForm({title:"編輯頁面",fields:[{key:"t",label:"頁面名稱",value:p.title||"",full:true},{key:"s",label:"總日曆上的簡稱（例如：生資；空白就不顯示）",value:pageTag(p),full:true},
      {key:"pos",label:"按鈕位置",options:posOpts,value:String(idx),full:true},
      ...(lastTodo?[]:[{key:"kind",label:"這頁顯示成",options:[["sched","行程表（課表、行事曆）"],["todo","待辦清單"]],value:p.kind==="todo"?"todo":"sched",full:true}])],
    validate:()=>fv("t")?"":"請輸入頁面名稱",
    onSave:async()=>{await notesRef.doc(p.id).update({title:fv("t").slice(0,40),short:fv("s").slice(0,6),kind:lastTodo?"todo":fv("kind")});const to=+fv("pos");if(to!==idx)await movePage(p.id,to)},
    onDelete:lastTodo?null:async()=>{const pid=p.id;closePage();const sn=await notesRef.doc(pid).collection("imgs").get();for(const d of sn.docs||[])await notesRef.doc(pid).collection("imgs").doc(d.id).delete();await notesRef.doc(pid).delete();render()}});
}
function itemFields(it,pageSel){
  const f=[];
  if(pageSel)f.push({key:"pg",label:"放在哪一頁",options:notes.map(p=>[p.id,p.title||"未命名"]).concat([["__new","＋ 新的一頁「我的行程」"]]),value:pageSel,full:true});
  f.push({key:"d",label:"日期（不填＝待辦）",type:"date",value:it.date===undefined?today():it.date},{key:"tm",label:"時間（可不填）",type:"time",value:it.time||""},
    {key:"ti",label:"要做的事",value:it.title||"",full:true,placeholder:"例如：期中考、交報告"},
    {key:"no",label:"備註（可不填）",value:it.note||"",full:true,placeholder:"例如：第 3 週、教室、範圍"},
    {key:"st",label:"顯示在總日曆",options:[["1","★ 顯示"],["0","不顯示"]],value:it.id?(it.star?"1":"0"):(autoStar(it.title)?"1":"0")},
    {key:"rm",label:"通知",options:RM_OPTS,value:nHasRm(it)?String(it.remind):""},
    {key:"td",label:"放進待辦",options:[["1","✓ 放進待辦"],["0","不放"]],value:(it.todo!==undefined?it.todo:it.date==="")?"1":"0"},
    ...(it.date!==""&&!it.todo?[{key:"sec",label:"分段（可不填，例如「小組討論」）",value:it.sec||"",full:true,list:[...new Set(notes.flatMap(p=>(p.items||[]).map(x=>x.sec).filter(Boolean)))]}]:[]),
    {key:"pr",label:"分類",options:PRI_OPTS.concat(it.pri&&!PRI_OPTS.some(o=>o[0]===it.pri)?[[it.pri,PRI[it.pri]+" "+PRI_TXT[it.pri]]]:[]),value:it.pri!==undefined&&it.pri!==null?it.pri:(it.date?"":autoCat(it.title)),full:true});
  return f;
}
function readItem(id){const rm=fv("rm"),pr=fv("pr"),dd=fv("d");return{id,pri:pr||null,todo:!dd||fv("td")==="1",sec:(fv("sec")||"").slice(0,20),date:dd,time:fv("tm"),title:fv("ti").slice(0,80),note:fv("no").slice(0,120),star:fv("st")!=="0",remind:rm===""?null:+rm}}
function wireAutoStar(){
  const ti=$("fs_ti"),st=$("fs_st"),pr=$("fs_pr"),d=$("fs_d");if(!ti||!st)return;let manual=false,manualP=false;
  st.addEventListener("change",()=>{manual=true});if(pr)pr.addEventListener("change",()=>{manualP=true});
  ti.addEventListener("input",()=>{if(!manual)st.value=autoStar(ti.value)?"1":"0";if(pr&&!manualP&&(!(d&&d.value)||($("fs_td")&&$("fs_td").value==="1")))pr.value=autoCat(ti.value)});
}
function editItem(p,it){
  if(!p)return;const isNew=!it;it=it||{};
  openForm({title:isNew?"新增行程":"修改行程",sub:p.title||"",fields:itemFields(it,null),
    validate:()=>fv("d")&&!/^\d{4}-\d{2}-\d{2}$/.test(fv("d"))?"日期格式不對":(!fv("ti")?"請輸入要做的事":""),
    onSave:()=>{const ni={...it,...readItem(it.id||("i"+Date.now().toString(36)+Math.random().toString(36).slice(2,6)))};if(!it.id)ni.ts=Date.now();delete ni.pid;delete ni.page;const list=(p.items||[]).filter(x=>x.id!==ni.id).concat([ni]);return notesRef.doc(p.id).update({items:list})},
    onDelete:isNew?null:()=>notesRef.doc(p.id).update({items:(p.items||[]).filter(x=>x.id!==it.id)})});
  if(isNew)wireAutoStar();
}
function newItemOn(date,pre){
  const def=(noteSel&&notes.find(x=>x.id===noteSel))||notes.find(x=>/^(代辦|待辦)$/.test(x.title))||notes.find(x=>x.title==="學校")||notes[0];
  openForm({title:date?"新增行程":"新增待辦",fields:itemFields({date,...(pre||{})},def?def.id:"__new"),
    validate:()=>fv("d")&&!/^\d{4}-\d{2}-\d{2}$/.test(fv("d"))?"日期格式不對":(!fv("ti")?"請輸入要做的事":""),
    onSave:async()=>{let pid=fv("pg");const ni={...readItem("i"+Date.now().toString(36)+Math.random().toString(36).slice(2,6)),ts:Date.now()};
      if(pid==="__new"||!notes.find(x=>x.id===pid)){await notesRef.add({title:"我的行程",text:"",items:[ni],ts:Date.now(),order:Date.now()});return}
      const p=notes.find(x=>x.id===pid);await notesRef.doc(pid).update({items:(p.items||[]).concat([ni])})}});
  wireAutoStar();
}
// ---- 隨手記整理：照標題分組，抓出日期，排出接下來要做的事（規則解析，不用 AI）----
const MEMO_BUL=/^\s*(?:[◦•●○▪・\-\*–—]|\d+[.)、])\s*(.+)$/;
function memoDate(s){
  const m=/(\d{1,2})\s*[\/月]\s*(\d{1,2})/.exec(s);if(!m)return "";
  const mo=+m[1],d=+m[2];if(mo<1||mo>12||d<1||d>31)return "";
  const ty=+today().slice(0,4);let k=`${ty}-${pad2(mo)}-${pad2(d)}`;
  if(nDays(k)<-180)k=`${ty+1}-${pad2(mo)}-${pad2(d)}`;return k;
}
const memoTime=s=>{const m=/(\d{1,2}):(\d{2})/.exec(s);return m&&+m[1]<24?`${pad2(+m[1])}:${m[2]}`:""};
function parseMemo(text){
  const secs=[];let cur=null;
  String(text||"").split(/\r?\n/).forEach(raw=>{
    const line=raw.replace(/\s+$/,"");if(!line.trim())return;
    const b=MEMO_BUL.exec(line);
    if(b){if(!cur){cur={h:"",c:"",items:[]};secs.push(cur)}cur.items.push(b[1].trim());return}
    const t=line.trim(),emo=/^(🔴|🟢|🟡|🏠|📚|📌|🟠|🔵|⚪|⭐)/.exec(t);
    if(emo||/[：:]$/.test(t)){cur={h:t.replace(/^(🔴|🟢|🟡|🏠|📚|📌|🟠|🔵|⚪|⭐)\s*/,"").replace(/[：:]$/,""),c:emo?emo[1]:"",items:[]};secs.push(cur);return}
    if(cur&&memoDate(t)){cur.items.push(t);return}
  });
  return secs.filter(s=>s.items.length);
}
const CN_NUM={"一":1,"二":2,"三":3,"四":4,"五":5,"六":6};
const memoNorm=s=>String(s||"").toLowerCase()
  .replace(/第([一二三四五六])次作業/g,(m,c)=>"作業"+CN_NUM[c]).replace(/(?:hw|as|assignment)\s*(\d)/g,"作業$1").replace(/\bhw\b/g,"作業")
  .replace(/[\s（）()：:・,，、\-–_]/g,"");
const memoStrip=s=>String(s||"").replace(/\d{1,2}\s*[\/月]\s*\d{1,2}[日號]?|\d{1,2}:\d{2}|（.）|\(.\)|\(w\d+\)/gi,"");
function memoFind(txt,sec){
  let a=memoNorm(memoStrip(txt));if(a.length<2&&sec&&sec.h)a=memoNorm(sec.h);if(a.length<2)return null;
  const its=noteItems();
  return its.find(it=>memoNorm(it.title)===a)||its.find(it=>{const b=memoNorm((it.ptag||"")+it.title),c=memoNorm(it.title);return (c.length>=2&&a.includes(c)&&c.length>=a.length*0.6)||b.includes(a)})||null;
}
// ---- 未來一個月：總日曆和隨手記裡、今天起 30 天內的事，照日期往下列；勾「待辦」就放進待辦 ----
const memoTitle=txt=>txt.replace(/\d{1,2}\s*[\/月]\s*\d{1,2}[日號]?\s*(（.）|\(.\))?/,"").replace(/\d{1,2}:\d{2}(\s*[-–~]\s*\d{1,2}:\d{2})?/,"").replace(/^\s*[前後]/,"").replace(/\s+/g," ").trim()||txt;
function memoPage(txt){
  const s=String(txt||"").toLowerCase();
  return notes.find(p=>{const t=pageTag(p);return (t&&s.includes(t.toLowerCase()))||(p.title&&s.includes(p.title.toLowerCase()))})||notes.find(p=>/^(代辦|待辦)$/.test(p.title))||notes.find(p=>p.title==="學校")||notes[0]||null;
}
async function memoToTodo(o,box){
  if(!notesRef)return;const p=memoPage(o.txt);
  const it={id:"m"+Date.now().toString(36)+Math.random().toString(36).slice(2,6),date:o.date,time:memoTime(o.txt),title:memoTitle(o.txt),note:(/前/.test(o.txt)?`${nMD(o.date)} 前・`:"")+"來自隨手記",star:true,todo:true,pri:autoCat(o.txt+" "+((o.sec&&o.sec.h)||"")),remind:null,ts:Date.now()};
  try{if(p)await notesRef.doc(p.id).update({items:(p.items||[]).concat([it])});else await notesRef.add({title:"學校",text:"",items:[it],ts:Date.now(),order:Date.now()});toast("已放進待辦，也加到總日曆 ✓")}catch(e){toast("沒有存到，請再試一次")}
}
function renderMemoSum(){renderMemoSum0();foldCard($("nMemoSum"),"month")}
function renderMemoSum0(){
  const box=$("nMemoSum");if(!box)return;box.innerHTML="";
  const t=today(),end=addDays(t,30),inR=k=>k&&k>=t&&k<=end;
  const seen=new Set(),rows=[];
  noteItems().forEach(it=>{if(!inR(it.date))return;if(it.star||it.todo||nHasRm(it)){seen.add(it.pid+"/"+it.id);rows.push({it,date:it.date,time:it.time||""})}});
  parseMemo($("nMemo").value||memoText).forEach(sec=>sec.items.forEach(txt=>{
    const date=memoDate(txt);if(!inR(date))return;const tm=memoTime(txt);
    // 同一天同一個時間的，就當作同一件事（例如你把「活動」改名成別的）
    const f=memoFind(txt,sec)||(tm?noteItems().find(x=>x.date===date&&x.time===tm):null);
    if(f){if(f.date&&inR(f.date)&&!seen.has(f.pid+"/"+f.id)){seen.add(f.pid+"/"+f.id);rows.push({it:f,date:f.date,time:f.time||""})}return}
    rows.push({memo:true,txt,date,time:memoTime(txt),sec});
  }));
  rows.sort((a,b)=>(a.date+(a.time||"")).localeCompare(b.date+(b.time||"")));
  const hd=mkEl("div","lhead");hd.appendChild(mkEl("h2",null,`未來一個月 <small class="nct"></small>`.replace(/<.*/,"")));
  hd.firstChild.appendChild(mkEl("small","nct",`${nMD(t)}–${nMD(end)}・${rows.length} 件`));box.appendChild(hd);
  {const tp=notes.find(x=>x.kind==="todo");box.appendChild(mkEl("p","sub",`總日曆上的事和隨手記裡寫了日期的事都在這裡；勾「待辦」就會同時放進${tp?`「${tp.title}」頁`:"上面的待辦"}。`))}
  box.hidden=false;
  if(!rows.length){box.appendChild(mkEl("p","sub","未來一個月沒有排事情 🎉"));return}
  const mon0=nMon(t);let lastW=null;
  rows.forEach(o=>{
    const w=nMon(o.date);if(w!==lastW){lastW=w;const k=Math.round((new Date(w+"T00:00:00Z")-new Date(mon0+"T00:00:00Z"))/(7*864e5));
      box.appendChild(mkEl("div","nmh",k===0?"這週":k===1?"下週":`${nMD(w)}–${nMD(addDays(w,6))}`))}
    const it=o.it,d=nDays(o.date),r=mkEl("div","msr"+(d<=2?" soon":"")+(it&&it.done?" done":""));
    const dt=mkEl("span","md");dt.append(mkEl("b",null,nMD(o.date)),mkEl("small",null,d<=2?nRel(d):`週${nDow(o.date)}`));
    const tx=mkEl("button","mt");tx.type="button";
    if(it){if(it.ptag)tx.appendChild(mkEl("span","ptag",it.ptag));tx.appendChild(document.createTextNode((it.star?"★ ":"")+it.title));const sub=[it.time&&!(it.note||"").includes(it.time)?it.time:"",it.note].filter(Boolean).join("・");if(sub)tx.appendChild(mkEl("small",null,sub));
      tx.onclick=()=>{const p=notes.find(x=>x.id===it.pid);if(p)editItem(p,p.items.find(x=>x.id===it.id))}}
    else{tx.appendChild(document.createTextNode(memoTitle(o.txt)));tx.appendChild(mkEl("small",null,"隨手記"+(o.sec&&o.sec.h?"・"+(o.sec.c?o.sec.c+" ":"")+o.sec.h:"")+(o.time?"・"+o.time:"")));tx.onclick=()=>{const ta=$("nMemo");ta.focus();ta.scrollIntoView({block:"center"})}}
    const on=!!(it&&it.todo),lb=mkEl("button","ntodo"+(on?" on":""),on?"已在待辦":"＋待辦");lb.type="button";
    lb.setAttribute("aria-pressed",on?"true":"false");lb.setAttribute("aria-label",`${it?it.title:memoTitle(o.txt)}：放進待辦`);
    lb.onclick=()=>{lb.disabled=true;if(it)toggleTodo(it.pid,it.id,lb);else memoToTodo(o,null)};
    r.append(dt,tx,lb);box.appendChild(r);
  });
}
function flushMemo(){
  memoTimer=null;if(!memoRef)return;const v=$("nMemo").value.slice(0,20000);memoText=v;
  memoRef.set({text:v,ts:Date.now()}).then(()=>{$("nMemoMsg").textContent="已儲存"}).catch(()=>{$("nMemoMsg").textContent="儲存失敗，請稍後再試"});
}
function flushText(){
  if(!noteTxtTimer)return;clearTimeout(noteTxtTimer);noteTxtTimer=null;
  const pid=noteSel,v=$("npText").value;if(!pid||!notesRef)return;
  notesRef.doc(pid).update({text:v.slice(0,20000)}).then(()=>{$("npTextMsg").textContent="已儲存"}).catch(()=>{$("npTextMsg").textContent="儲存失敗，請稍後再試"});
}

// ---- 加到手機行事曆：所有要通知、還沒過的行程，各自帶提醒 ----
const icsEsc=s=>String(s||"").replace(/\\/g,"\\\\").replace(/;/g,"\\;").replace(/,/g,"\\,").replace(/\r?\n/g,"\\n");
function notesICS(){
  const st=new Date().toISOString().replace(/[-:]/g,"").replace(/\.\d+Z$/,"Z");
  const L=["BEGIN:VCALENDAR","VERSION:2.0","PRODID:-//family-ledger//notes//zh-TW","CALSCALE:GREGORIAN","METHOD:PUBLISH",
    "BEGIN:VTIMEZONE","TZID:Asia/Taipei","BEGIN:STANDARD","DTSTART:19700101T000000","TZOFFSETFROM:+0800","TZOFFSETTO:+0800","TZNAME:CST","END:STANDARD","END:VTIMEZONE"];
  const soon=soonOn(),list=noteItems().filter(it=>nDays(it.date)>=0&&(nHasRm(it)||(soon&&it.star)));
  list.forEach(it=>{
    const d=it.date.replace(/-/g,""),n=+it.remind;
    L.push("BEGIN:VEVENT",`UID:${it.pid}-${it.id}@family-ledger`,"DTSTAMP:"+st);
    if(it.time){L.push(`DTSTART;TZID=Asia/Taipei:${d}T${it.time.replace(":","")}00`,"DURATION:PT1H")}
    else{const nx=new Date(Date.UTC(+d.slice(0,4),+d.slice(4,6)-1,+d.slice(6,8)+1)).toISOString().slice(0,10).replace(/-/g,"");L.push(`DTSTART;VALUE=DATE:${d}`,`DTEND;VALUE=DATE:${nx}`)}
    L.push("SUMMARY:"+icsEsc(it.title),"DESCRIPTION:"+icsEsc([it.page,it.note].filter(Boolean).join("・")));
    // 沒有時間的行程：在那天（或前幾天）早上 9 點提醒；有時間的：當天提前 1 小時，或前幾天同一時間
    const trig=n=>it.time?(n?`-P${n}D`:"-PT1H"):(n?(n===1?"-PT15H":`-P${n-1}DT15H`):"PT9H");
    const ns=new Set();if(nHasRm(it))ns.add(+it.remind);if(soon&&it.star)[2,1,0].forEach(x=>ns.add(x));
    [...ns].sort((a,b)=>b-a).forEach(k=>L.push("BEGIN:VALARM","ACTION:DISPLAY","DESCRIPTION:"+icsEsc(it.title),"TRIGGER:"+trig(k),"END:VALARM"));
    L.push("END:VEVENT");
  });
  L.push("END:VCALENDAR");return{text:L.join("\r\n")+"\r\n",count:list.length};
}

function initNotes(){
  $("tabNote").onclick=()=>{flushText();goNotes()};
  $("npEdit").onclick=editPage;
  // 一鍵標註／清除：這一頁有日期的行程全部標 ★ 或全部取消（按兩下確認）
  const bulk=(btn,v,label)=>{btn.onclick=async()=>{
    const p=notes.find(x=>x.id===noteSel);if(!p)return;const dated=(p.items||[]).filter(x=>x.date),chg=dated.filter(x=>!!x.star!==v).length;
    if(!chg){$("npBulkMsg").textContent=v?"已經全部標上了":"已經沒有 ★ 了";return}
    if(btn.dataset.arm!=="1"){btn.dataset.arm="1";btn.textContent=`確定？（${chg} 個）`;setTimeout(()=>{btn.dataset.arm="";btn.textContent=label},3000);return}
    btn.dataset.arm="";btn.textContent=label;btn.disabled=true;
    try{await notesRef.doc(p.id).update({items:(p.items||[]).map(x=>x.date?{...x,star:v}:x)});toast(v?`已標上 ${chg} 個 ★`:`已清除 ${chg} 個 ★`);$("npBulkMsg").textContent=""}catch(e){$("npBulkMsg").textContent="沒有存到，請再試一次"}
    btn.disabled=false}};
  bulk($("npStarAll"),true,"★ 全部標上");bulk($("npStarNone"),false,"☆ 全部清除");
  $("npTools").onclick=()=>{const b=$("npToolsBox"),o=b.hidden;b.hidden=!o;$("npTools").textContent=o?"整理 ▴":"整理 ▾";$("npTools").setAttribute("aria-expanded",o?"true":"false")};
  $("npStarOnly").onchange=e=>{const v=e.target.checked;curPrefs={...(curPrefs||{}),noteStarOnly:v};if(prefsRef)prefsRef.set({noteStarOnly:v},{merge:true}).catch(()=>{});const p=notes.find(x=>x.id===noteSel);if(p)renderPage(p)};
  {const b=$("npDelPlain");b.onclick=async()=>{const p=notes.find(x=>x.id===noteSel);if(!p)return;const del=(p.items||[]).filter(x=>x.date&&!x.star&&!x.todo);
    if(!del.length){$("npBulkMsg").textContent="沒有沒標 ★ 的行程";return}
    if(b.dataset.arm!=="1"){b.dataset.arm="1";b.textContent=`確定刪除 ${del.length} 個？不能復原`;setTimeout(()=>{b.dataset.arm="";b.textContent="🗑 刪除沒 ★ 的"},4000);return}
    b.dataset.arm="";b.textContent="🗑 刪除沒 ★ 的";const ids=new Set(del.map(x=>x.id));
    try{await notesRef.doc(p.id).update({items:(p.items||[]).filter(x=>!ids.has(x.id))});toast(`已刪除 ${del.length} 個沒標 ★ 的行程`)}catch(e){$("npBulkMsg").textContent="沒有刪到，請再試一次"}}}
  $("npPastLast").onchange=e=>{const v=e.target.checked;curPrefs={...(curPrefs||{}),notePastLast:v};if(prefsRef)prefsRef.set({notePastLast:v},{merge:true}).catch(()=>{});const p=notes.find(x=>x.id===noteSel);if(p)renderPage(p)};
  $("npModeT").onclick=()=>setPageMode("table");$("npModeL").onclick=()=>setPageMode("list");
  $("nTodoAdd").onclick=()=>newItemOn("",{todo:true,...(todoTab()!=="all"?{pri:todoTab()}:{})});
  $("nMemo").oninput=()=>{$("nMemoMsg").textContent="";clearTimeout(renderMemoSum._t);renderMemoSum._t=setTimeout(renderMemoSum,300);clearTimeout(memoTimer);memoTimer=setTimeout(flushMemo,800)};
  $("nMemo").onblur=()=>{if(memoTimer){clearTimeout(memoTimer);flushMemo()}};
  $("nSoon").onchange=e=>{const v=e.target.checked;curPrefs={...(curPrefs||{}),noteSoon:v};if(prefsRef)prefsRef.set({noteSoon:v},{merge:true}).catch(()=>{});render()};
  $("npItemAdd").onclick=()=>{const p=notes.find(x=>x.id===noteSel);if(p)editItem(p,null)};
  $("npText").oninput=()=>{$("npTextMsg").textContent="";clearTimeout(noteTxtTimer);noteTxtTimer=setTimeout(()=>{noteTxtTimer=1;flushText()},800)};
  $("npText").onblur=flushText;
  $("npImgAdd").onclick=()=>$("npFile").click();
  $("npFile").onchange=async e=>{
    const fs=[...(e.target.files||[])];e.target.value="";const pid=noteSel;if(!fs.length||!pid)return;
    const room=NOTE_IMG_MAX-noteImgs.length,msg=$("npImgMsg");let ok=0,bad=0;msg.textContent="上傳中…";
    for(const f of fs.slice(0,room)){try{const t=await shrink(f);await notesRef.doc(pid).collection("imgs").add({t,ts:Date.now()});ok++}catch(err){bad++}}
    msg.textContent=(bad?`有 ${bad} 張沒辦法讀取。`:"")+(fs.length>room?`每頁最多 ${NOTE_IMG_MAX} 張。`:"");
  };
  $("ncPrev").onclick=()=>{closeDayPop();ncM--;if(ncM<1){ncM=12;ncY--}renderNoteCal()};
  $("ncNext").onclick=()=>{closeDayPop();ncM++;if(ncM>12){ncM=1;ncY++}renderNoteCal()};
  $("ncToday").onclick=()=>{closeDayPop();const t=today();ncY=+t.slice(0,4);ncM=+t.slice(5,7);ncSel=t;renderNoteCal()};
  document.addEventListener("click",e=>{if(!ncOpen)return;const b=$("ncDay");if(b.contains(e.target)||e.target.closest("#fsheet,#sheetBg,#toast"))return;closeDayPop()});
  document.addEventListener("keydown",e=>{if(e.key==="Escape"&&ncOpen)closeDayPop()});
  $("nIcs").onclick=()=>{const r=notesICS(),m=$("nIcsMsg");
    if(!r.count){m.textContent="目前沒有要提醒、還沒到的行程。打開上面的「提醒我今天、明天、後天的事」，或在行程裡設定「通知」。";return}
    saveFile("schedule-reminders.ics",r.text,"text/calendar;charset=utf-8");
    m.textContent=`已下載 ${r.count} 個行程（★ 的行程會在前 2 天、前 1 天和當天提醒）。打開這個檔案，選「全部加入」就會加到手機行事曆，時間到會通知。之後有新增或修改，再按一次就好。`};
  window.addEventListener("pagehide",()=>{flushText();if(memoTimer){clearTimeout(memoTimer);flushMemo()}});
}
