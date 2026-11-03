// ---- 記事本：自己的行程頁面、總日曆、提醒 ----
// 資料放在 users/{uid}/notes/{頁面}，圖片放在 users/{uid}/notes/{頁面}/imgs/{圖}；只有本人能讀寫。
// 一個頁面：{title, text, items:[{id,date,time,title,note,star,remind}], ts, order}
//   star：要不要顯示在總日曆；remind：null 不通知，0/1/3/7 = 當天／前幾天提醒。
let notes=[],notesRef=null,notesLoaded=false,noteSel=null,noteImgs=[],noteImgOff=null,noteTxtTimer=null,ncY=0,ncM=0,ncSel="";
const RM_OPTS=[["","不通知"],["0","當天"],["1","前 1 天"],["2","前 2 天"],["3","前 3 天"],["7","前 1 週"]];
const RM_TXT={0:"當天",1:"前 1 天",2:"前 2 天",3:"前 3 天",7:"前 1 週"};
const soonOn=()=>!(curPrefs&&curPrefs.noteSoon===false);
const NOTE_IMG_MAX=12;
const nWK="日一二三四五六";
const nDow=k=>nWK[new Date(k+"T00:00:00Z").getUTCDay()];
const nDays=k=>Math.round((new Date(k+"T00:00:00Z")-new Date(today()+"T00:00:00Z"))/864e5);
const nHasRm=it=>it.remind!==null&&it.remind!==undefined&&it.remind!=="";
const nSort=(a,b)=>((a.date||"")+(a.time||"")).localeCompare((b.date||"")+(b.time||""));
const nMD=k=>`${+k.slice(5,7)}/${+k.slice(8,10)}`;
const nShort=t=>{let s=String(t||"");const ps=s.split("・");if(ps.length>1)s=ps.find(x=>/作業|考|報告|截止|測驗/.test(x))||ps[0];s=s.replace(/^開/,"").replace(/[（(].*$/,"").trim()||s;return s.slice(0,4)};
const nRel=d=>d===0?"今天":d===1?"明天":d===2?"後天":`${d} 天後`;

function noteItems(){const out=[];notes.forEach(p=>(p.items||[]).forEach(it=>out.push({...it,pid:p.id,page:p.title||"未命名"})));return out.sort(nSort)}
function planMap(){const m={};noteItems().forEach(it=>{if(it.star&&it.date)(m[it.date]=m[it.date]||[]).push(it)});return m}
function dueReminders(){const soon=soonOn();return noteItems().filter(it=>{if(!it.date)return false;const d=nDays(it.date);if(d<0)return false;return (nHasRm(it)&&d<=+it.remind)||(soon&&it.star&&d<=2)})}

function notesSub(){
  notesLoaded=false;notes=[];notesRef=DB.collection(`users/${myId}/notes`);
  unsubs.push(notesRef.onSnapshot(sn=>{
    notes=sn.docs.map(d=>({id:d.id,...d.data()})).sort((a,b)=>(a.order||0)-(b.order||0)||(a.ts||0)-(b.ts||0));notesLoaded=true;
    if(loaded&&(view==="note"||view==="cal"||view==="home"))render();
  },()=>{}));
  if(noteSel)watchImgs(noteSel);
}
function notesReset(){notes=[];notesRef=null;notesLoaded=false;noteSel=null;noteImgs=[];if(noteImgOff){try{noteImgOff()}catch(e){}noteImgOff=null}}

// ---- 畫面 ----
function renderNotes(){
  let p=noteSel?notes.find(x=>x.id===noteSel):null;
  if(noteSel&&!p&&notesLoaded){closePage();p=null}
  $("nlView").hidden=!!p;$("npView").hidden=!p;$("npEdit").hidden=!p;$("nHead").textContent=p?(p.title||"未命名"):"記事本";
  renderTabs(p);renderRemindCard($("nRemind"),!!p);
  if(p){renderPage(p);return}
  $("nSoon").checked=soonOn();renderNoteCal();
}
function renderRemindCard(box,compact){
  if(!box)return;const due=dueReminders();box.innerHTML="";box.hidden=!due.length;if(!due.length)return;
  const h=mkEl("h2",null,"🔔 今天、明天、後天");box.appendChild(h);
  due.slice(0,compact?3:8).forEach(it=>box.appendChild(itemRow(it,true)));
  if(compact&&due.length>3){const m=mkEl("button","ghost sm",`還有 ${due.length-3} 個，看記事本`);m.type="button";m.onclick=()=>{if(view==="note"&&noteSel){closePage();render()}else goNotes()};const bt=mkEl("div","bt");bt.appendChild(m);box.appendChild(bt)}
}
function itemRow(it,showPage){
  const d=nDays(it.date);
  const r=mkEl("button","nit"+(d<0?" past":"")+(it.star?" star":""));r.type="button";
  const dt=mkEl("span","nd");dt.append(mkEl("b",null,nMD(it.date)),mkEl("small",null,"週"+nDow(it.date)+(it.time?" "+it.time:"")));
  const t=mkEl("span","nt");t.appendChild(mkEl("span","ttl",it.title||"（沒有標題）"));
  const sub=[showPage?it.page:"",it.note||""].filter(Boolean).join("・");if(sub)t.appendChild(mkEl("small",null,sub));
  const ic=mkEl("span","nic");
  if(showPage&&d>=0){ic.appendChild(mkEl("span","when",nRel(d)))}
  if(it.star){const s=mkEl("span","st","★");s.title="顯示在總日曆";ic.appendChild(s)}
  if(nHasRm(it)){const s=mkEl("span","bl","🔔");s.title="提醒："+RM_TXT[+it.remind];ic.appendChild(s)}
  r.append(dt,t,ic);
  r.setAttribute("aria-label",`${nMD(it.date)} 週${nDow(it.date)}${it.time?" "+it.time:""}，${it.title||""}${it.note?"，"+it.note:""}${it.star?"，顯示在總日曆":""}${nHasRm(it)?"，提醒"+RM_TXT[+it.remind]:""}`);
  r.onclick=()=>{const p=notes.find(x=>x.id===it.pid);if(p)editItem(p,p.items.find(x=>x.id===it.id))};
  return r;
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
    if(pl.length){l.textContent=nShort(pl[0].title)+(pl.length>1?"…":"");l.classList.add("plan")}
    else{const inf=dayInfo(y,m,d);if(inf.fest.length){l.textContent=inf.fest[0].replace(/節$/,"").slice(0,4);l.classList.add("fest")}}
    b.append(mkEl("span","n",String(d)),l);
    if(all[key]&&!pl.length){const dot=mkEl("i","dot");b.appendChild(dot)}
    b.setAttribute("aria-label",`${m}月${d}日`+(pl.length?"，"+pl.map(x=>x.title).join("、"):"")+(all[key]?`，共 ${all[key]} 個行程`:""));
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
  let lastM="";its.forEach(it=>{const mk=(it.date||"").slice(0,7);if(mk!==lastM){lastM=mk;box.appendChild(mkEl("div","nmh",`${+mk.slice(0,4)} 年 ${+mk.slice(5,7)} 月`))}box.appendChild(itemRow(it,false))});
  const ta=$("npText");if(document.activeElement!==ta&&!noteTxtTimer)ta.value=p.text||"";
  renderPageImgs();
}
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
  openForm({title:"編輯頁面",fields:[{key:"t",label:"頁面名稱",value:p.title||"",full:true}],
    validate:()=>fv("t")?"":"請輸入頁面名稱",
    onSave:()=>notesRef.doc(p.id).update({title:fv("t").slice(0,40)}),
    onDelete:async()=>{const pid=p.id;closePage();const sn=await notesRef.doc(pid).collection("imgs").get();for(const d of sn.docs||[])await notesRef.doc(pid).collection("imgs").doc(d.id).delete();await notesRef.doc(pid).delete();render()}});
}
function itemFields(it,pageSel){
  const f=[];
  if(pageSel)f.push({key:"pg",label:"放在哪一頁",options:notes.map(p=>[p.id,p.title||"未命名"]).concat([["__new","＋ 新的一頁「我的行程」"]]),value:pageSel,full:true});
  f.push({key:"d",label:"日期",type:"date",value:it.date||today()},{key:"tm",label:"時間（可不填）",type:"time",value:it.time||""},
    {key:"ti",label:"要做的事",value:it.title||"",full:true,placeholder:"例如：期中考、交報告"},
    {key:"no",label:"備註（可不填）",value:it.note||"",full:true,placeholder:"例如：第 3 週、教室、範圍"},
    {key:"st",label:"顯示在總日曆",options:[["1","★ 顯示"],["0","不顯示"]],value:it.star===false?"0":"1"},
    {key:"rm",label:"通知",options:RM_OPTS,value:nHasRm(it)?String(it.remind):""});
  return f;
}
function readItem(id){const rm=fv("rm");return{id,date:fv("d"),time:fv("tm"),title:fv("ti").slice(0,80),note:fv("no").slice(0,120),star:fv("st")!=="0",remind:rm===""?null:+rm}}
function editItem(p,it){
  if(!p)return;const isNew=!it;it=it||{};
  openForm({title:isNew?"新增行程":"修改行程",sub:p.title||"",fields:itemFields(it,null),
    validate:()=>!/^\d{4}-\d{2}-\d{2}$/.test(fv("d"))?"請選日期":(!fv("ti")?"請輸入要做的事":""),
    onSave:()=>{const ni=readItem(it.id||("i"+Date.now().toString(36)+Math.random().toString(36).slice(2,6)));const list=(p.items||[]).filter(x=>x.id!==ni.id).concat([ni]);return notesRef.doc(p.id).update({items:list})},
    onDelete:isNew?null:()=>notesRef.doc(p.id).update({items:(p.items||[]).filter(x=>x.id!==it.id)})});
}
function newItemOn(date){
  const def=(noteSel&&notes.find(x=>x.id===noteSel))||notes[0];
  openForm({title:"新增行程",fields:itemFields({date},def?def.id:"__new"),
    validate:()=>!/^\d{4}-\d{2}-\d{2}$/.test(fv("d"))?"請選日期":(!fv("ti")?"請輸入要做的事":""),
    onSave:async()=>{let pid=fv("pg");const ni=readItem("i"+Date.now().toString(36)+Math.random().toString(36).slice(2,6));
      if(pid==="__new"||!notes.find(x=>x.id===pid)){await notesRef.add({title:"我的行程",text:"",items:[ni],ts:Date.now(),order:Date.now()});return}
      const p=notes.find(x=>x.id===pid);await notesRef.doc(pid).update({items:(p.items||[]).concat([ni])})}});
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
  window.addEventListener("pagehide",flushText);
}
