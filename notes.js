// ---- 記事本：自己的行程頁面、總日曆、提醒 ----
// 資料放在 users/{uid}/notes/{頁面}，圖片放在 users/{uid}/notes/{頁面}/imgs/{圖}；只有本人能讀寫。
// 一個頁面：{title, text, items:[{id,date,time,title,note,star,remind}], ts, order}
//   star：要不要顯示在總日曆；remind：null 不通知，0/1/3/7 = 當天／前幾天提醒。
let memoRef=null,memoText="",memoTimer=null,notes=[],notesRef=null,notesLoaded=false,noteSel=null,noteImgs=[],noteImgOff=null,noteTxtTimer=null,ncY=0,ncM=0,ncSel="";
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
const PRI={r:"🔴",h:"🏠",g:"🟢",y:"🟡"},PRI_TXT={r:"現在要做",h:"家庭",g:"之後要做",y:"學習"},PRI_ORD={r:0,h:1,g:2,y:3};
const PRI_OPTS=[["","不分類"],["r","🔴 現在要做"],["h","🏠 家庭"],["g","🟢 之後要做"],["y","🟡 學習"]];
const todoSort=(a,b)=>(a.done?1:0)-(b.done?1:0)||(PRI_ORD[a.pri]??4)-(PRI_ORD[b.pri]??4)||(a.ts||0)-(b.ts||0);
const nRel=d=>d===0?"今天":d===1?"明天":d===2?"後天":`${d} 天後`;

// 頁面簡稱：顯示在總日曆上，看得出是哪堂課；沒設定就用頁名前兩個字（英文最多 6 個字母）
const autoShort=t=>{t=String(t||"");return /^[A-Za-z]/.test(t)?t.split(/\s/)[0].slice(0,6):t.slice(0,2)};
const pageTag=p=>p.short!==undefined&&p.short!==null?String(p.short):autoShort(p.title);
function noteItems(){const out=[];notes.forEach(p=>{const tag=pageTag(p);(p.items||[]).forEach(it=>out.push({...it,pid:p.id,page:p.title||"未命名",ptag:tag}))});return out.sort(nSort)}
function planMap(){const m={};noteItems().forEach(it=>{if(it.star&&it.date)(m[it.date]=m[it.date]||[]).push(it)});return m}
function dueReminders(){const soon=soonOn();return noteItems().filter(it=>{if(!it.date)return false;const d=nDays(it.date);if(d<0)return false;return (nHasRm(it)&&d<=+it.remind)||(soon&&it.star&&d<=2)})}

function notesSub(){
  notesLoaded=false;notes=[];notesRef=DB.collection(`users/${myId}/notes`);
  unsubs.push(notesRef.onSnapshot(sn=>{
    notes=sn.docs.map(d=>({id:d.id,...d.data()})).sort((a,b)=>(a.order||0)-(b.order||0)||(a.ts||0)-(b.ts||0));notesLoaded=true;
    if(loaded&&(view==="note"||view==="cal"||view==="home"))render();
  },()=>{}));
  memoRef=DB.doc(`users/${myId}/prefs/memo`);
  unsubs.push(memoRef.onSnapshot(sn=>{const d=sn.exists?sn.data():null;memoText=(d&&d.text)||"";const ta=$("nMemo");if(ta&&document.activeElement!==ta&&!memoTimer)ta.value=memoText;if(view==="note"&&!noteSel)renderMemoSum()},()=>{}));
  if(noteSel)watchImgs(noteSel);
}
function notesReset(){memoRef=null;memoText="";notes=[];notesRef=null;notesLoaded=false;noteSel=null;noteImgs=[];if(noteImgOff){try{noteImgOff()}catch(e){}noteImgOff=null}}

// ---- 畫面 ----
function renderNotes(){
  let p=noteSel?notes.find(x=>x.id===noteSel):null;
  if(noteSel&&!p&&notesLoaded){closePage();p=null}
  $("nlView").hidden=!!p;$("npView").hidden=!p;$("npEdit").hidden=!p;$("nHead").textContent=p?(p.title||"未命名"):"記事本";
  renderTabs(p);renderRemindCard($("nRemind"),!!p);
  if(p){renderPage(p);return}
  $("nSoon").checked=soonOn();renderNoteCal();renderTodos();{const ta=$("nMemo");if(document.activeElement!==ta&&!memoTimer)ta.value=memoText}renderMemoSum();
}
function renderRemindCard(box,compact){
  if(!box)return;const due=dueReminders();box.innerHTML="";box.hidden=!due.length;if(!due.length)return;
  const h=mkEl("h2",null,"🔔 今天、明天、後天");box.appendChild(h);
  due.slice(0,compact?3:8).forEach(it=>box.appendChild(itemRow(it,true)));
  if(compact&&due.length>3){const m=mkEl("button","ghost sm",`還有 ${due.length-3} 個，看記事本`);m.type="button";m.onclick=()=>{if(view==="note"&&noteSel){closePage();render()}else goNotes()};const bt=mkEl("div","bt");bt.appendChild(m);box.appendChild(bt)}
}
// 標題裡有考試、作業、報告這類字，就自動標 ★；一般上課不標
const NOTE_KEY=/考|測驗|作業|報告|截止|計畫書|quiz|exam|test|homework|assignment|report|presentation|proposal|deadline|due/i;
const autoStar=t=>NOTE_KEY.test(String(t||""));
function itemRow(it,showPage){
  const und=!it.date,d=und?0:nDays(it.date);
  const r=mkEl("div","nit"+(!und&&d<0?" past":"")+(it.star?" star":"")+(und?" todo":"")+(it.done?" done":""));
  const mb=mkEl("button","nmain");mb.type="button";
  const dt=mkEl("span","nd");
  if(und)dt.append(mkEl("b",null,PRI[it.pri]||"📝"),mkEl("small",null,PRI_TXT[it.pri]?PRI_TXT[it.pri].slice(0,2):"待辦"));
  else dt.append(mkEl("b",null,nMD(it.date)),mkEl("small",null,"週"+nDow(it.date)+(it.time?" "+it.time:"")));
  const t=mkEl("span","nt"),tt=mkEl("span","ttl");
  if(showPage&&it.ptag)tt.appendChild(mkEl("span","ptag",it.ptag));
  tt.appendChild(document.createTextNode((!und&&PRI[it.pri]?PRI[it.pri]+" ":"")+(it.title||"（沒有標題）")));t.appendChild(tt);
  const sub=[showPage&&!it.ptag?it.page:"",it.note||""].filter(Boolean).join("・");if(sub)t.appendChild(mkEl("small",null,sub));
  const ic=mkEl("span","nic");
  if(showPage&&!und&&d>=0){ic.appendChild(mkEl("span","when",nRel(d)))}
  if(nHasRm(it)){const s=mkEl("span","bl","🔔");s.title="提醒："+RM_TXT[+it.remind];ic.appendChild(s)}
  mb.append(dt,t,ic);
  mb.setAttribute("aria-label",(und?`待辦${PRI_TXT[it.pri]?"（"+PRI_TXT[it.pri]+"）":""}${it.done?"，已完成":""}`:`${nMD(it.date)} 週${nDow(it.date)}`)+`${it.time?" "+it.time:""}，${it.title||""}${it.note?"，"+it.note:""}${nHasRm(it)?"，提醒"+RM_TXT[+it.remind]:""}，點一下修改`);
  mb.onclick=()=>{const p=notes.find(x=>x.id===it.pid);if(p)editItem(p,p.items.find(x=>x.id===it.id))};
  if(und){const cb=mkEl("button","ncheck"+(it.done?" on":""),it.done?"✓":"");cb.type="button";cb.setAttribute("aria-pressed",it.done?"true":"false");cb.setAttribute("aria-label",`${it.title||""}：完成`);cb.title=it.done?"已完成，點一下改回未完成":"做完了就勾起來";
    cb.onclick=()=>toggleField(it.pid,it.id,"done",cb);r.append(mb,cb);return r}
  const sb=mkEl("button","nstar"+(it.star?" on":""),it.star?"★":"☆");sb.type="button";
  sb.setAttribute("aria-pressed",it.star?"true":"false");sb.setAttribute("aria-label",`${it.title||""}：顯示在總日曆`);sb.title=it.star?"已顯示在總日曆，點一下取消":"點一下顯示在總日曆";
  sb.onclick=()=>toggleField(it.pid,it.id,"star",sb);
  r.append(mb,sb);
  return r;
}
async function toggleField(pid,id,k,btn){
  const p=notes.find(x=>x.id===pid);if(!p||!notesRef)return;
  const list=(p.items||[]).map(x=>x.id===id?{...x,[k]:!x[k]}:x),v=!!list.find(x=>x.id===id)[k];
  if(btn){btn.classList.toggle("on",v);btn.textContent=k==="star"?(v?"★":"☆"):(v?"✓":"");btn.setAttribute("aria-pressed",v?"true":"false");btn.disabled=true;const row=btn.closest(".nit,.nl");if(row)row.classList.toggle(k==="star"?"star":"done",v)}
  try{await notesRef.doc(pid).update({items:list});toast(k==="star"?(v?"已顯示在總日曆 ★":"已從總日曆拿掉"):(v?"完成 ✓":"改回還沒做"))}catch(e){toast("沒有存到，請再試一次");if(btn)btn.disabled=false}
}
async function toggleMany(pid,ids,v,btn){
  const p=notes.find(x=>x.id===pid);if(!p||!notesRef)return;const set=new Set(ids);
  const list=(p.items||[]).map(x=>set.has(x.id)?{...x,star:v}:x);
  if(btn){btn.classList.toggle("on",v);btn.textContent=v?"★":"☆";btn.setAttribute("aria-pressed",v?"true":"false");btn.disabled=true;const row=btn.closest(".nl");if(row)row.classList.toggle("star",v)}
  try{await notesRef.doc(pid).update({items:list});toast(v?"已顯示在總日曆 ★":"已從總日曆拿掉")}catch(e){toast("沒有存到，請再試一次");if(btn)btn.disabled=false}
}
function renderTodos(){
  const box=$("nTodoList");box.innerHTML="";
  const all=noteItems().filter(x=>!x.date).sort(todoSort),open=all.filter(x=>!x.done);
  $("nTodoCount").textContent=all.length?`還有 ${open.length} 件沒做`:"";
  if(!all.length){box.appendChild(mkEl("p","sub","沒有日期的事放這裡，例如「領貨」「準備面試」。做完就打勾。"));return}
  let last=null;all.forEach(it=>{const g=it.done?"done":(it.pri||"");if(g!==last){last=g;box.appendChild(mkEl("div","nmh",g==="done"?"✓ 做完了":(PRI[g]?PRI[g]+" "+PRI_TXT[g]:"其他")))}box.appendChild(itemRow(it,true))});
}
function renderTabs(p){
  const box=$("nTabs");box.innerHTML="";
  const mk=(label,on,fn,id)=>{const b=mkEl("button","ntab"+(on?" on":""),label);b.type="button";b.setAttribute("role","tab");b.setAttribute("aria-selected",on?"true":"false");if(id)b.id=id;b.onclick=fn;box.appendChild(b);return b};
  mk("📅 總日曆",!p,()=>{if(noteSel){closePage();render();window.scrollTo(0,0)}},"nTabCal");
  notes.forEach(x=>mk(x.title||"未命名",p&&p.id===x.id,()=>{if(noteSel!==x.id){flushText();openPage(x.id)}}));
  const add=mk("＋",false,newPage,"npAdd");add.setAttribute("aria-label","新增頁面");add.classList.add("add");add.removeAttribute("role");
  const on=box.querySelector(".ntab.on");if(on)requestAnimationFrame(()=>{const l=on.offsetLeft-16;if(l<box.scrollLeft||l+on.offsetWidth>box.scrollLeft+box.clientWidth)box.scrollLeft=Math.max(0,l)});
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
    let tg=null;
    if(pl.length){l.textContent=nShort(pl[0].title)+(pl.length>1?"…":"");l.classList.add("plan");if(pl[0].ptag)tg=mkEl("span","ptg",pl[0].ptag.slice(0,6))}
    else{const inf=dayInfo(y,m,d);if(inf.fest.length){l.textContent=inf.fest[0].replace(/節$/,"").slice(0,4);l.classList.add("fest")}}
    b.append(mkEl("span","n",String(d)));if(tg)b.appendChild(tg);b.appendChild(l);
    if(all[key]&&!pl.length){const dot=mkEl("i","dot");b.appendChild(dot)}
    b.setAttribute("aria-label",`${m}月${d}日`+(pl.length?"，"+pl.map(x=>(x.ptag?x.ptag+" ":"")+x.title).join("、"):"")+(all[key]?`，共 ${all[key]} 個行程`:""));
    b.onclick=()=>{ncSel=key;if(m!==ncM){ncY=y;ncM=m}renderNoteCal()};
    g.appendChild(b);
  }
  renderNoteDay();
}
function renderNoteDay(){
  const box=$("ncDay");box.innerHTML="";if(!ncSel)return;
  const [y,m,d]=ncSel.split("-").map(Number);
  box.appendChild(mkEl("h2",null,`${m} 月 ${d} 日　星期${nDow(ncSel)}`));
  const its=noteItems().filter(x=>x.date===ncSel).sort((a,b)=>(b.star?1:0)-(a.star?1:0)||nSort(a,b));
  if(!its.length)box.appendChild(mkEl("p","sub","這天沒有行程。"));
  its.forEach(it=>box.appendChild(itemRow(it,true)));
  const bt=mkEl("div","bt"),add=mkEl("button","ghost sm","＋ 新增行程在這天");add.type="button";add.onclick=()=>newItemOn(ncSel);bt.appendChild(add);box.appendChild(bt);
}
function renderPage(p){
  const box=$("npItems");box.innerHTML="";
  const its=(p.items||[]).map(it=>({...it,pid:p.id,page:p.title})).sort(nSort);
  if(!its.length)box.appendChild(mkEl("p","sub","還沒有行程。按「＋ 新增行程」加上日期和要做的事。"));
  const und=its.filter(x=>!x.date).sort(todoSort);if(und.length){box.appendChild(mkEl("div","nmh","待辦（沒有日期）"));und.forEach(it=>box.appendChild(itemRow(it,false)))}
  const tbl=pageMode()==="table";$("npModeT").classList.toggle("on",tbl);$("npModeL").classList.toggle("on",!tbl);
  $("npModeT").setAttribute("aria-pressed",tbl?"true":"false");$("npModeL").setAttribute("aria-pressed",tbl?"false":"true");
  if(tbl){const dated=its.filter(x=>x.date);if(dated.length)box.appendChild(weekTable(dated))}
  else{let lastM="";its.filter(x=>x.date).forEach(it=>{const mk=it.date.slice(0,7);if(mk!==lastM){lastM=mk;box.appendChild(mkEl("div","nmh",`${+mk.slice(0,4)} 年 ${+mk.slice(5,7)} 月`))}box.appendChild(itemRow(it,false))})}
  const ta=$("npText");if(document.activeElement!==ta&&!noteTxtTimer)ta.value=p.text||"";
  renderPageImgs();
}
// ---- 表格：像學校課表一樣，一週一列，一眼看完 ----
const pageMode=()=>(curPrefs&&curPrefs.noteView)==="list"?"list":"table";
const nMon=k=>{const t=new Date(k+"T00:00:00Z");t.setUTCDate(t.getUTCDate()-((t.getUTCDay()+6)%7));return t.toISOString().slice(0,10)};
function weekTable(items){
  let m0=null,n0=0;
  for(const it of items){const m=/第\s*(\d+)\s*週/.exec(it.note||"");if(m){m0=nMon(it.date);n0=+m[1];break}}
  const rows=new Map();
  items.forEach(it=>{const mk=nMon(it.date);if(!rows.has(mk))rows.set(mk,[]);rows.get(mk).push(it)});
  const t=mkEl("table","ntbl"),hd=document.createElement("tr");
  (m0?["週次","日期","內容"]:["日期","內容"]).forEach(h=>hd.appendChild(mkEl("th",null,h)));
  const thead=document.createElement("thead");thead.appendChild(hd);t.appendChild(thead);const tb=document.createElement("tbody");t.appendChild(tb);
  const thisMon=nMon(today());
  [...rows.keys()].sort().forEach(mk=>{
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
      l.append(b,sb);c.appendChild(l);
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
function goNotes(){view="note";noteSel=null;render();window.scrollTo(0,0)}
function watchImgs(pid){
  if(noteImgOff){try{noteImgOff()}catch(e){}noteImgOff=null}noteImgs=[];if(!notesRef)return;
  const off=notesRef.doc(pid).collection("imgs").onSnapshot(sn=>{if(noteSel!==pid)return;noteImgs=sn.docs.map(d=>({id:d.id,...d.data()})).sort((a,b)=>(a.ts||0)-(b.ts||0));if(view==="note")renderPageImgs()},()=>{});
  noteImgOff=off;unsubs.push(off);
}
function openPage(pid){noteSel=pid;$("npText").value=(notes.find(x=>x.id===pid)||{}).text||"";$("npImgMsg").textContent="";$("npTextMsg").textContent="";watchImgs(pid);view="note";render();window.scrollTo(0,0)}
function closePage(){flushText();noteSel=null;noteImgs=[];if(noteImgOff){try{noteImgOff()}catch(e){}noteImgOff=null}}
function newPage(){
  openForm({title:"新增頁面",sub:"一個主題一頁，例如「這學期課表」「期中考」「社團」。",fields:[{key:"t",label:"頁面名稱",value:"",full:true,placeholder:"例如：這學期課表"}],
    validate:()=>fv("t")?"":"請輸入頁面名稱",
    onSave:async()=>{const r=await notesRef.add({title:fv("t").slice(0,40),text:"",items:[],ts:Date.now(),order:Date.now()});setTimeout(()=>openPage(r.id),0)}});
}
function editPage(){
  const p=notes.find(x=>x.id===noteSel);if(!p)return;
  openForm({title:"編輯頁面",fields:[{key:"t",label:"頁面名稱",value:p.title||"",full:true},{key:"s",label:"總日曆上的簡稱（例如：生資；空白就不顯示）",value:pageTag(p),full:true}],
    validate:()=>fv("t")?"":"請輸入頁面名稱",
    onSave:()=>notesRef.doc(p.id).update({title:fv("t").slice(0,40),short:fv("s").slice(0,6)}),
    onDelete:async()=>{const pid=p.id;closePage();const sn=await notesRef.doc(pid).collection("imgs").get();for(const d of sn.docs||[])await notesRef.doc(pid).collection("imgs").doc(d.id).delete();await notesRef.doc(pid).delete();render()}});
}
function itemFields(it,pageSel){
  const f=[];
  if(pageSel)f.push({key:"pg",label:"放在哪一頁",options:notes.map(p=>[p.id,p.title||"未命名"]).concat([["__new","＋ 新的一頁「我的行程」"]]),value:pageSel,full:true});
  f.push({key:"d",label:"日期（不填＝待辦）",type:"date",value:it.date===undefined?today():it.date},{key:"tm",label:"時間（可不填）",type:"time",value:it.time||""},
    {key:"ti",label:"要做的事",value:it.title||"",full:true,placeholder:"例如：期中考、交報告"},
    {key:"no",label:"備註（可不填）",value:it.note||"",full:true,placeholder:"例如：第 3 週、教室、範圍"},
    {key:"st",label:"顯示在總日曆",options:[["1","★ 顯示"],["0","不顯示"]],value:it.id?(it.star?"1":"0"):(autoStar(it.title)?"1":"0")},
    {key:"rm",label:"通知",options:RM_OPTS,value:nHasRm(it)?String(it.remind):""},
    {key:"pr",label:"分類",options:PRI_OPTS,value:it.pri||"",full:true});
  return f;
}
function readItem(id){const rm=fv("rm"),pr=fv("pr");return{id,pri:pr||null,date:fv("d"),time:fv("tm"),title:fv("ti").slice(0,80),note:fv("no").slice(0,120),star:fv("st")!=="0",remind:rm===""?null:+rm}}
function wireAutoStar(){
  const ti=$("fs_ti"),st=$("fs_st");if(!ti||!st)return;let manual=false;
  st.addEventListener("change",()=>{manual=true});
  ti.addEventListener("input",()=>{if(!manual)st.value=autoStar(ti.value)?"1":"0"});
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
  const def=(noteSel&&notes.find(x=>x.id===noteSel))||notes.find(x=>x.title==="學校")||notes[0];
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
    const t=line.trim(),emo=/^(🔴|🟢|🟡|🏠|🟠|🔵|⚪|⭐)/.exec(t);
    if(emo||/[：:]$/.test(t)){cur={h:t.replace(/^(🔴|🟢|🟡|🏠|🟠|🔵|⚪|⭐)\s*/,"").replace(/[：:]$/,""),c:emo?emo[1]:"",items:[]};secs.push(cur);return}
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
function renderMemoSum(){
  const box=$("nMemoSum");if(!box)return;box.innerHTML="";
  const secs=parseMemo($("nMemo").value||memoText);box.hidden=!secs.length;if(!secs.length)return;
  const hd=mkEl("div","lhead");hd.appendChild(mkEl("h2",null,"隨手記整理"));box.appendChild(hd);
  box.appendChild(mkEl("p","sub","照你在隨手記寫的標題和日期自動整理；按「＋」可以加到待辦或總日曆。"));
  const row=(txt,sec)=>{
    const date=memoDate(txt),f=memoFind(txt,sec),r=mkEl("div","msr"+(f&&f.done?" done":""));
    const dt=mkEl("span","md");if(date){const d=nDays(date);dt.append(mkEl("b",null,nMD(date)),mkEl("small",null,d<0?"已過":d<=2?nRel(d):`${d} 天後`));if(d>=0&&d<=2)r.classList.add("soon");if(d<0)r.classList.add("past")}else dt.appendChild(mkEl("b",null,sec.c||"•"));
    const t=mkEl("span","mt",txt);if(sec&&sec.h&&date)t.appendChild(mkEl("small",null,(sec.c?sec.c+" ":"")+sec.h));
    const a=mkEl("button","ghost sm ma");a.type="button";
    if(f){a.textContent=f.date?"✓ 日曆":"✓ 待辦";a.title=`已在「${f.page}」`;a.onclick=()=>openPage(f.pid)}
    else{a.textContent="＋";a.setAttribute("aria-label",`把「${txt}」加到${date?"總日曆":"待辦"}`);
      const title=txt.replace(/\d{1,2}\s*[\/月]\s*\d{1,2}[日號]?\s*(（.）|\(.\))?/,"").replace(/\d{1,2}:\d{2}(\s*[-–~]\s*\d{1,2}:\d{2})?/,"").replace(/^\s*[前後]/,"").trim()||txt;
      a.onclick=()=>newItemOn(date,{title,time:memoTime(txt),pri:sec&&sec.c==="🔴"?"r":null,note:date&&/前/.test(txt)?`${nMD(date)} 前`:""})}
    r.append(dt,t,a);return r;
  };
  const dated=[];secs.forEach(s=>s.items.forEach(x=>{const d=memoDate(x);if(d&&nDays(d)>=0)dated.push({x,d,s})}));
  if(dated.length){box.appendChild(mkEl("div","nmh","📅 接下來（有日期的）"));dated.sort((a,b)=>a.d.localeCompare(b.d)).forEach(o=>box.appendChild(row(o.x,o.s)))}
  secs.forEach(s=>{const und=s.items.filter(x=>!memoDate(x));if(!und.length)return;box.appendChild(mkEl("div","nmh",(s.c?s.c+" ":"")+(s.h||"其他")+`（${und.length}）`));und.forEach(x=>box.appendChild(row(x,s)))});
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
  $("npModeT").onclick=()=>setPageMode("table");$("npModeL").onclick=()=>setPageMode("list");
  $("nTodoAdd").onclick=()=>newItemOn("");
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
  $("ncPrev").onclick=()=>{ncM--;if(ncM<1){ncM=12;ncY--}renderNoteCal()};
  $("ncNext").onclick=()=>{ncM++;if(ncM>12){ncM=1;ncY++}renderNoteCal()};
  $("ncToday").onclick=()=>{const t=today();ncY=+t.slice(0,4);ncM=+t.slice(5,7);ncSel=t;renderNoteCal()};
  $("nIcs").onclick=()=>{const r=notesICS(),m=$("nIcsMsg");
    if(!r.count){m.textContent="目前沒有要提醒、還沒到的行程。打開上面的「提醒我今天、明天、後天的事」，或在行程裡設定「通知」。";return}
    saveFile("schedule-reminders.ics",r.text,"text/calendar;charset=utf-8");
    m.textContent=`已下載 ${r.count} 個行程（★ 的行程會在前 2 天、前 1 天和當天提醒）。打開這個檔案，選「全部加入」就會加到手機行事曆，時間到會通知。之後有新增或修改，再按一次就好。`};
  window.addEventListener("pagehide",()=>{flushText();if(memoTimer){clearTimeout(memoTimer);flushMemo()}});
}
