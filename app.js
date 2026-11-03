const PRESETS=[["餐飲","🍜"],["交通","🚌"],["購物","🛍️"],["娛樂","🎮"],["日用品","🧴"],["居住","🏠"],["醫療","🩺"],["教育","📚"],["通訊","📱"],["運動","🏃"],["旅遊","✈️"],["人情禮物","🎁"],["捐款","💝"],["其他","📦"]];
const DEFAULT_ON=["餐飲","交通","購物","娛樂","其他"];
const KEYS={
 "餐飲":/飯|麵|早餐|午餐|晚餐|宵夜|餐|吃|喝|飲|茶|咖啡|便當|零食|麥當勞|素食|吐司/,
 "交通":/捷運|公車|火車|高鐵|計程|uber|ubike|加油|機車|停車|油錢|悠遊卡|交通/i,
 "購物":/衣|鞋|褲|購物|蝦皮|momo|網購|包包/i,
 "娛樂":/電影|遊戲|netflix|訂閱|ktv|演唱會|spotify|點數/i,
 "日用品":/日用|衛生紙|洗|牙膏|超市|全聯/,
 "居住":/房租|水電|瓦斯|網路費|管理費/,
 "醫療":/看診|醫|藥|掛號|牙|診所/,
 "教育":/書|學費|課|補習|文具|影印/,
 "通訊":/電話費|手機費|月租|話費/,
 "運動":/運動|健身|球|游泳|攀岩|岩館/,
 "旅遊":/旅|住宿|機票|民宿|門票/,
 "人情禮物":/禮|紅包|送禮|份子/,
 "捐款":/捐/
};
KEYS["餐飲"]=/飯|饭|麵|面|早餐|午餐|晚餐|宵夜|餐|吃|喝|飲|饮|茶|咖啡|便當|便当|零食|麥當勞|麦当劳|素食|吐司/;
KEYS["食物"]=KEYS["餐飲"];
KEYS["交通"]=/捷運|捷运|公車|公车|火車|火车|高鐵|高铁|計程|计程|uber|ubike|加油|機車|机车|停車|停车|油錢|悠遊卡|交通/i;
KEYS["攀岩"]=/攀岩|岩館|岩馆|抱石|岩鞋|粉袋/;
const SITE_URL=location.origin+location.pathname.replace(/index\.html$/,"");
const REPO_URL="https://github.com/tim062480-create/family-ledger";
const JOIN=(new URLSearchParams(location.search).get("join")||"").trim();
const INAPP=/Line\/|FBAN|FBAV|FB_IAB|Instagram|MicroMessenger|KAKAOTALK/i.test(navigator.userAgent||"");
const $=id=>document.getElementById(id);
const fmt=n=>"NT$"+Math.round(n).toLocaleString("zh-TW");
const today=()=>new Date(Date.now()+8*3600e3).toISOString().slice(0,10);
const iso=d=>d.toISOString().slice(0,10);
let csCtx=null,csSort="date",csBack=false,phCol=null,vPh=[],shPh=[],vw=null,phPickCb=null;
const phCache=new Map(),PH_MAX=4;
let bdays=[],bdRef=null,coupons=[],cpCol=null,incomes=[],incCol=null,goal=null,contribs=[],setSub=null,recurTried=new Set(),curPrefs=null,wz=null,curKey=null,loaded=false,unsubs=[],DB=null,prefsRef=null,view="home",myId=null,others={},famSel="",lastPub="",pubTimer=null,base=null,col=null,settings=null,expenses=[],cur=today().slice(0,7),canWrite=true,setupOpen=false,sstate=null,items=[];
let fbAuth=null,me=null,profile=null,hid=null,household=null,members={},hhUnsubs=[],joinInfo=null,joinDone=false,authState="init";
const myName=()=>(hid&&members[myId]&&members[myId].name)||(profile&&profile.name)||(me&&me.displayName)||"我";
const roleName=myName;
const hhName=()=>(household&&household.name)||"我的家";
const byFields=()=>curKey==="fam"?{by:myId,byName:myName()}:{};
const quoteOn=()=>!(curPrefs&&curPrefs.quote===false);
const cats=()=>settings&&settings.categories?settings.categories:[];
const EXTRA={"食物":"🍜","杂项":"📦","雜項":"📦","攀岩":"🧗","捐款":"💝"};
const emojiOf=n=>{const p=PRESETS.find(x=>x[0]===n);return p?p[1]:(EXTRA[n]||"🔖")};
const allowanceOf=m=>{const a=settings&&settings.allowance&&settings.allowance[m];return a!=null?a:(settings&&settings.defaultAllowance)||0};

function render(){
  $("tabbar").hidden=true;
  $("appTitle").hidden=!!(curKey&&loaded&&settings&&view!=="home");
  renderMonths();
  $("vHome").hidden=view!=="home";$("vMonth").hidden=view!=="month";$("vSet").hidden=view!=="set";$("vCal").hidden=view!=="cal";$("vBd").hidden=view!=="bd";$("vNote").hidden=view!=="note";
  $("backBtn").hidden=view!=="month"||!settings;
  {const [yy,mm]=cur.split("-").map(Number);$("monthTitle").textContent=`${yy} 年 ${mm} 月`}
  $("status").hidden=true;
  renderGate();renderAcct();renderLedgerSw();
  if(!curKey){closeViewer();closeCat();closeSheet();closeForm();$("musicPop").hidden=true;["wizard","app","quote","subline","datebar"].forEach(i=>{$(i).hidden=true});["backBtn","musicBtn"].forEach(i=>{$(i).hidden=true});return}
  $("quote").hidden=!quoteOn();$("subline").hidden=false;$("datebar").hidden=false;$("musicBtn").hidden=false;
  $("subline").textContent=curKey==="fam"?`${hhName()}・全家共同帳：家裡每個人都看得到、都可以記。`:"你的帳只有你自己看得到；要不要分享給家人、分享多少，都由你決定。";
  if(!loaded){$("status").hidden=false;$("status").textContent="載入中…";$("wizard").hidden=true;$("app").hidden=true;return}
  if(!settings){showWizard();$("app").hidden=true;$("backBtn").hidden=true;return}
  $("wizard").hidden=true;
  {const inSet=view==="set"||view==="cal"||view==="bd"||view==="note";$("quote").hidden=inSet||!quoteOn();$("subline").hidden=inSet;$("datebar").hidden=inSet}
  if(view==="set")renderSet();
  {const v=$("voice");if(view==="month"){if(v.parentElement!==$("vMonth"))$("vMonth").insertBefore(v,$("monthTitle").nextSibling)}else if(v.parentElement!==$("vHome"))$("vHome").insertBefore(v,$("vHome").firstChild)}
  {const hr=$("homeRemind"),vh=$("vHome");if(vh.firstChild!==hr)vh.insertBefore(hr,vh.firstChild)}
  $("tabbar").hidden=false;requestAnimationFrame(fitQuote);$("tabRec").classList.toggle("on",view!=="set"&&view!=="cal"&&view!=="bd"&&view!=="note");$("tabNote").classList.toggle("on",view==="note");if(view==="note")renderNotes();renderRemindCard($("homeRemind"),true);$("tabSet").classList.toggle("on",view==="set");$("tabCal").classList.toggle("on",view==="cal"||view==="bd");if(view==="cal")renderCal();if(view==="bd")renderBdList();
  $("app").hidden=false;
  const ex=expenses.filter(e=>e.month===cur).sort((a,b)=>b.date.localeCompare(a.date));
  const spent=ex.reduce((s,e)=>s+(+e.amount||0),0),incM=incomeSum(cur),allow=allowanceOf(cur)+incM;
  $("hAllow").textContent=allow?fmt(allow):"未設定";$("hInc").textContent=incM?"含收入 "+fmt(incM):(canWrite?"點一下可修改":"");
  {const [py,pm]=cur.split("-").map(Number),pk=pm===1?`${py-1}-12`:`${py}-${String(pm-1).padStart(2,"0")}`;
   const prev=expenses.filter(e=>e.month===pk).reduce((s2,e)=>s2+(+e.amount||0),0);
   const cmp=prev?(spent<=prev?`比上個月（${fmt(prev)}）少花 ${fmt(prev-spent)}`:`比上個月（${fmt(prev)}）多花 ${fmt(spent-prev)}`):"";
   const cum=netMonths().filter(x=>x<=cur).reduce((t,x)=>t+monthNet(x),0);
   $("hCmp").textContent=[cmp,"累計到這個月 "+fmtS(cum)].filter(Boolean).join("・");}
  $("hSpent").textContent=fmt(spent);
  $("hLeft").textContent=allow?fmtS(allow-spent):"–";
  $("hLeft").style.color=allow&&allow-spent<0?"var(--bad)":"";
  // categories + alerts
  const isCur=cur===today().slice(0,7);
  const [y,mo]=cur.split("-").map(Number),dim=new Date(y,mo,0).getDate(),day=isCur?+today().slice(8):dim;
  const timePct=day/dim*100,daysLeft=Math.max(1,dim-day+1);
  const cr=$("catRows");cr.innerHTML="";const al=$("alerts");al.innerHTML="";renderShare(ex,spent);
  const names=new Set(cats().map(c=>c.name));
  const rowsData=cats().map(c=>({name:c.name,budget:+c.budget||0,spent:ex.filter(e=>e.category===c.name).reduce((t,e)=>t+(+e.amount||0),0)}));
  const other=ex.filter(e=>!names.has(e.category));
  if(other.length)rowsData.push({name:"（已移除的類別）",removed:true,budget:0,spent:other.reduce((t,e)=>t+(+e.amount||0),0)});
  rowsData.forEach(c=>{
    const r=document.createElement("div");r.className="row tap";r.setAttribute("role","button");r.tabIndex=0;
    r.innerHTML='<div class="top"><span></span><span></span></div>'+(c.budget?'<div class="bar"><i></i></div>':'');
    const tp=r.querySelector(".top").children;tp[0].textContent=c.name;
    {const ch=document.createElement("i");ch.className="chev";ch.setAttribute("aria-hidden","true");ch.textContent="›";tp[0].appendChild(ch)}
    tp[1].textContent=c.budget?`${fmt(c.spent)} / ${fmt(c.budget)}　${c.spent>c.budget?"超支 "+fmt(c.spent-c.budget):"剩 "+fmt(c.budget-c.spent)}`:`${fmt(c.spent)}（未設預算）`;
    r.onclick=()=>openCat(ownCat(c.name,!!c.removed));
    r.onkeydown=e=>{if(e.key==="Enter"||e.key===" "){e.preventDefault();r.onclick()}};
    if(c.budget){
      const pct=c.spent/c.budget*100,i=r.querySelector(".bar i");i.style.width=Math.min(100,pct)+"%";
      if(pct>=100)i.className="bad";else if(pct>=80)i.className="warn";
      if(pct>=25){
        const left=c.budget-c.spent;let cls="ok",t;
        if(pct>=100){cls="bad";t=`${c.name}已用完，超支 ${fmt(-left)}`}
        else if(pct>=50){cls="warn";t=`${c.name}已用 ${Math.round(pct)}%，剩 ${fmt(left)}`}
        else t=`${c.name}已用 ${Math.round(pct)}%，剩 ${fmt(left)}`;
        if(isCur&&pct<100)t+=`，接下來每天約 ${fmt(left/daysLeft)}`;
        if(isCur&&pct-timePct>=15&&pct<100){cls="warn";t+=`。這個月才過 ${day} 天，花得有點快囉 😅 要省一點`}
        const a=document.createElement("div");a.className="alert "+cls;a.textContent=t;al.appendChild(a);
      }
    }
    cr.appendChild(r);
  });
  // list
  const tb=$("rows");tb.innerHTML="";
  const inc=incomes.filter(i=>i.month===cur);
  const rowsAll=ex.map(e=>({k:"exp",d:e})).concat(inc.map(i=>({k:"inc",d:i}))).sort((a,b)=>b.d.date.localeCompare(a.d.date));
  if(!rowsAll.length)tb.innerHTML='<tr><td class="empty">這個月還沒有記錄</td></tr>';
  rowsAll.forEach(({k,d:e})=>{
    const tr=document.createElement("tr");tr.innerHTML='<td class="d"></td><td></td><td></td><td class="n"></td>';
    const t=tr.children;t[0].textContent=e.date.slice(5);t[1].textContent=k==="inc"?"收入":e.category;t[2].textContent=(e.note||"")+(e.remark?"（"+e.remark+"）":"");
    t[3].textContent=(k==="inc"?"+":"")+fmt(e.amount);if(k==="inc"){t[1].className="inc";t[3].className="n inc"}
    if(k==="exp"&&phOf(e).length)t[2].prepend(thumbEl(e));
    if(curKey==="fam"&&e.byName){const w=document.createElement("small");w.className="byw";w.textContent=e.byName;t[2].appendChild(w)}
    if(canWrite)tr.onclick=()=>openSheet(k,e);
    tb.appendChild(tr);
  });
  renderPhotoWall(ex);
  if(csCtx&&csCtx.own&&!$("csheet").hidden)renderCat();
  const ac=$("addCat"),keep=ac.value;ac.innerHTML="";
  cats().forEach(c=>{const o=document.createElement("option");o.textContent=c.name;ac.appendChild(o)});if(keep)ac.value=keep;
  $("add").hidden=true;$("voice").hidden=!canWrite;$("expAdd").hidden=!canWrite;
  $("privacy").hidden=!canWrite;$("shareLevel").value=settings.share||"none";renderFam();renderReminder();renderGoal();renderCoupons();$("incAdd").hidden=!canWrite;
}

// ---- setup ----
function openSetup(){
  if(!canWrite)return;
  if(!sstate){
    const have=cats();
    const list=PRESETS.map(([n,e])=>{const c=have.find(x=>x.name===n);return{name:n,emoji:e,on:settings?!!c:DEFAULT_ON.includes(n),budget:c&&c.budget?c.budget:""}});
    have.filter(c=>!PRESETS.some(p=>p[0]===c.name)).forEach(c=>list.push({name:c.name,emoji:"🔖",on:true,budget:c.budget||""}));
    sstate={list,allow:allowanceOf(cur)||"",role:roleName()};
  }
  setupOpen=true;renderSetup();
}
function renderSetup(){
  $("allow").value=sstate.allow;
  $("roleSel").parentElement.hidden=true;
  const box=$("catSetup");box.innerHTML="";
  sstate.list.forEach(c=>{
    const r=document.createElement("div");r.className="sr";
    const lb=document.createElement("label"),cb=document.createElement("input");cb.type="checkbox";cb.checked=c.on;cb.onchange=()=>{c.on=cb.checked};
    const sp=document.createElement("span");sp.textContent=c.name;lb.append(cb,sp);
    const bu=document.createElement("input");bu.type="number";bu.min="0";bu.placeholder="預算";bu.value=c.budget;bu.oninput=()=>{c.budget=bu.value};
    r.append(lb,bu);box.appendChild(r);
  });
}
function setupEvents(){
  $("allow").oninput=e=>{sstate.allow=e.target.value};
  $("addCustom").onclick=()=>{
    const n=$("customName").value.trim();if(!n)return;
    if(sstate.list.some(c=>c.name===n)){$("setupMsg").textContent="已經有這個類別了";return}
    sstate.list.push({name:n,emoji:"🔖",on:true,budget:""});$("customName").value="";$("setupMsg").textContent="";renderSetup();
  };
  $("cancelSetup").onclick=()=>{if(!settings)return;setupOpen=false;sstate=null;view="home";render();window.scrollTo(0,0)};
  $("saveSetup").onclick=async()=>{
    const chosen=sstate.list.filter(c=>c.on);
    if(!chosen.length){$("setupMsg").textContent="請至少選一個類別";return}
    const allow=Math.max(0,+sstate.allow||0);
    const data={...(settings||{}),categories:chosen.map(c=>({name:c.name,budget:Math.max(0,+c.budget||0)})),allowance:{...((settings&&settings.allowance)||{}),[cur]:allow},defaultAllowance:allow,share:(settings&&settings.share)||"none",role:roleName()};
    $("saveSetup").disabled=true;
    try{await base.set(data);sstate=null;$("setupMsg").textContent="已儲存 ✅"}
    catch(e){$("setupMsg").textContent="儲存失敗，請稍後再試"}
    $("saveSetup").disabled=false;
  };
}

// ---- parsing ----
function guess(s){
  const cs=cats();
  for(const c of cs){if(KEYS[c.name]&&KEYS[c.name].test(s))return c.name}
  for(const c of cs){if(s.includes(c.name))return c.name}
  const o=cs.find(c=>["其他","杂项","雜項"].includes(c.name));return o?o.name:(cs[cs.length-1]||{name:"其他"}).name;
}
function findDate(t){
  const base=new Date(today()+"T00:00:00Z");
  let m=t.match(/(\d{1,2})\s*[\/月.]\s*(\d{1,2})\s*[日號号]?/);
  if(m){const mo=+m[1],dd=+m[2];if(mo>=1&&mo<=12&&dd>=1&&dd<=31)return{date:`${base.getUTCFullYear()}-${String(mo).padStart(2,"0")}-${String(dd).padStart(2,"0")}`,rest:t.replace(m[0]," ")}}
  if(/前天/.test(t)){base.setUTCDate(base.getUTCDate()-2);return{date:iso(base),rest:t.replace("前天"," ")}}
  if(/昨天/.test(t)){base.setUTCDate(base.getUTCDate()-1);return{date:iso(base),rest:t.replace("昨天"," ")}}
  if(/今天/.test(t))return{date:iso(base),rest:t.replace("今天"," ")};
  return{date:"",rest:t};
}
// ---- rule-based parsing helpers ----
function cn2num(x){
  const D={"零":0,"〇":0,"一":1,"二":2,"兩":2,"两":2,"三":3,"四":4,"五":5,"六":6,"七":7,"八":8,"九":9},U={"十":10,"百":100,"千":1000,"萬":10000,"万":10000};
  let total=0,sec=0,num=0;
  for(const ch of x){
    if(ch in D)num=D[ch];
    else if(ch in U){const u=U[ch];if(u===10000){total+=(sec+num)*u;sec=0}else sec+=(num||(u===10?1:0))*u;num=0}
    else return 0;
  }
  const L=x.length,pu=x[L-2];if(num&&L>=2&&(pu==="百"||pu==="千"||pu==="萬"||pu==="万"))num*=U[pu]/10;
  return total+sec+num;
}
const BRANDS=[/7-?11|7-?eleven|seven-?eleven/ig,/85度C/ig,/50嵐/g,/21世紀/g,/3Q脆皮雞排/g,/Mr\.?\s?Brown/ig];
function preNorm(t){
  t=String(t||"").replace(/[０-９]/g,c=>String.fromCharCode(c.charCodeAt(0)-65248)).replace(/[＄$]\s*(?=\d)/g,"").replace(/(\d),(?=\d{3}\b)/g,"$1");
  t=t.replace(/([零〇一二兩两三四五六七八九十百千萬万]+)\s*(元|塊|块|圓)/g,(m,n,u)=>{const v=cn2num(n);return v?v+u:m});
  const keep=[];BRANDS.forEach(re=>{t=t.replace(re,m=>{keep.push(m);return"\uE000"+String.fromCharCode(0xE100+keep.length-1)})});
  return{t,keep};
}
const unBrand=(x,keep)=>String(x||"").replace(/\uE000([\uE100-\uE1FF])/g,(m,c)=>keep[c.charCodeAt(0)-0xE100]||"");
const CNUM={"一":1,"二":2,"兩":2,"两":2,"三":3,"四":4,"五":5,"六":6,"七":7,"八":8,"九":9,"十":10};
function localParse(t0){
  const pn=preNorm(t0),t=pn.t,ub=x=>unBrand(x,pn.keep);
  const out=[],f=findDate(t);
  if(/新增|拿到|收到|加入|多了/.test(f.rest)&&/券|禮物卡/.test(f.rest)){
    const nums=[...f.rest.matchAll(/(\d+)/g)].map(x=>+x[1]);const cm=f.rest.match(/(\d+|[一二兩两三四五六七八九十])\s*[張张]/);
    const count=cm?(CNUM[cm[1]]||+cm[1]):1,face=nums.find(n=>!cm||n!==+cm[1])||nums[0]||0;
    const store=f.rest.replace(/新增|拿到|收到|加入|多了|了|面額|一共|共/g,"").replace(/\d+\s*(元|塊|块)?/g,"").replace(/[一二兩两三四五六七八九十]?\s*[張张]/g,"").replace(/[,，、。\s]/g,"");
    if(face)return[{category:"cpadd:"+ub(store),face,count,amount:face*count,date:f.date,note:"",remark:""}];
  }
  const rest=f.rest.replace(/備註|備考|备注|备註/g,"備注");
  const re=/([^\d]*?)(\d+)\s*(?:元|塊|块)?\s*(?:備注\s*([^\d\s,，、;；。\n]*))?/g;let m;
  const clean=s=>s.replace(/^[\s元塊块,，、;；。.]+/,"").replace(/NT\$?|花了|花|共|買了|買|還有|然後|以及|和|跟|加上/gi," ").replace(/[,，、;；。.]/g," ").replace(/\s+/g," ").trim();
  const raw=x=>x.replace(/^[\s,，、;；。.]+|[\s,，、;；。.]+$/g,"");
  while((m=re.exec(rest))){
    const pre=m[1]||"";let desc="",remark="";const k=pre.indexOf("備注");
    const raw=x=>x.replace(/^[\s,，、;；。.]+|[\s,，、;；。.]+$/g,"");
    if(k>=0){
      const after=pre.slice(k+2).replace(/^\s+/,""),sp=after.search(/\s/);
      remark=raw(sp<0?after:after.slice(0,sp));
      desc=clean(pre.slice(0,k)+" "+(sp<0?"":after.slice(sp)));
    }else desc=clean(pre);
    if(m[3]!==undefined&&m[3].trim())remark=raw(m[3]);
    desc=ub(desc);remark=ub(remark);
    let cat=guess(desc+" "+remark),nd=desc;
    if(/券|劵|禮物卡/.test(desc+remark)){const st=desc.replace(/用|使用|付了|付|買了|買/g,"");cat="coupon:"+st;nd=toT(st).replace(CPW,"").trim()||desc}
    out.push({category:cat,amount:+m[2],date:f.date,note:nd,remark});
  }
  return out;
}
function renderPreview(){
  const box=$("preview");box.innerHTML="";
  items.forEach((it,i)=>{
    const r=document.createElement("div");r.className="pv";
    const dt=document.createElement("input");dt.type="date";dt.value=it.date;dt.onchange=()=>it.date=dt.value;
    const sel=document.createElement("select");
    cats().forEach(c=>{const o=document.createElement("option");o.value=o.textContent=c.name;if(c.name===it.category)o.selected=true;sel.appendChild(o)});
    {const all=wallets(),opts=all.filter(w=>w.balance>0||("coupon:"+w.store)===it.category).map(w=>["coupon:"+w.store,`用${w.store}優惠券（剩 ${fmt(w.balance)}）`]);
     const cs=String(it.category);
     if(cs.startsWith("coupon:")&&!all.some(w=>"coupon:"+w.store===cs))opts.push([cs,`用${cs.slice(7)}優惠券（還沒新增）`]);
     if(cs.startsWith("cpadd:"))opts.push([cs,`新增${cs.slice(6)}優惠券`+(it.count>1?`（${fmt(it.face)}×${it.count}）`:"")]);
     if(opts.length){const g=document.createElement("optgroup");g.label="優惠券（不算進每月收支）";opts.forEach(([v,l])=>{const o=document.createElement("option");o.value=v;o.textContent=l;if(v===cs)o.selected=true;g.appendChild(o)});sel.appendChild(g)}}
    sel.onchange=()=>{const was=isCp(it.category);it.category=sel.value;if(was!==isCp(it.category))renderPreview()};
    const am=document.createElement("input");am.type="number";am.min="1";am.value=it.amount;am.oninput=()=>{it.amount=+am.value;if(String(it.category).startsWith("cpadd:")){it.face=it.amount;it.count=1}};
    const nt=document.createElement("input");nt.className="nt";nt.value=it.note||"";nt.placeholder=String(it.category).startsWith("cp")?"店家／描述（可空）":"描述";nt.oninput=()=>it.note=nt.value;
    const x=document.createElement("button");x.type="button";x.className="x";x.textContent="×";x.onclick=()=>{items.splice(i,1);renderPreview()};
    const rm=document.createElement("input");rm.className="nt";rm.value=it.remark||"";rm.placeholder="備註";rm.oninput=()=>it.remark=rm.value;
    r.append(dt,sel,am,nt,rm,x);
    if(!isCp(it.category)){it.ph=it.ph||[];const ps=document.createElement("div");ps.className="phs";
      phStrip(ps,it.ph,{ent:()=>it,onAdd:arr=>placeFromPhotos(arr,it.place,v=>{it.place=v}),onChange:renderPreview,msg:t=>{$("vmsg").textContent=t}});r.appendChild(ps);
      if(it.ph.length){const pl=document.createElement("input");pl.className="nt pl";pl.value=it.place||"";pl.placeholder="地點：店名或地址，或貼 Google 地圖連結（可空）";pl.oninput=()=>{it.place=pl.value};r.insertBefore(pl,ps)}}
    box.appendChild(r);
  });
  $("confirmRow").hidden=!items.length;
}
function setupVoice(){
  const SR=window.SpeechRecognition||window.webkitSpeechRecognition;
  if(SR){
    $("mic").hidden=false;let rec=null,on=false;
    $("mic").onclick=()=>{
      if(on){rec&&rec.stop();return}
      try{
        rec=new SR();rec.lang="zh-TW";rec.interimResults=true;rec.continuous=false;
        rec.onresult=e=>{let t="";for(const r of e.results)t+=r[0].transcript;$("vtext").value=t};
        rec.onerror=()=>{$("vmsg").textContent="這裡無法使用麥克風，可改用鍵盤上的 🎤 聽寫";on=false;$("mic").textContent="🎤 語音"};
        rec.onend=()=>{on=false;$("mic").textContent="🎤 語音"};
        rec.start();on=true;$("mic").textContent="⏹ 停止";$("vmsg").textContent="";
      }catch(err){$("vmsg").textContent="這裡無法使用麥克風，可改用鍵盤上的 🎤 聽寫"}
    };
  }
  $("parse").onclick=()=>{
    const text=$("vtext").value.trim();if(!text)return;
    const arr=localParse(text);$("vmsg").textContent="";
    items=normItems(arr);
    if(vPh.length){const t=items.find(x=>!isCp(x.category));if(t){placeFromPhotos(vPh,t.place,v=>{t.place=v});t.ph=vPh;vPh=[];renderVPh()}}
    if(!items.length)$("vmsg").textContent="沒有聽出金額，請再說一次或手動輸入";
    else{const miss=items.filter(x=>String(x.category).startsWith("coupon:")&&!wallets().some(w=>"coupon:"+w.store===x.category)).map(x=>x.category.slice(7));
      if(miss.length)$("vmsg").textContent=`還沒有${miss[0]}的優惠券。可以先說「新增${miss[0]}禮券 500 三張」，或在優惠券卡片按＋新增`}
    renderPreview();
  };
  $("cancel").onclick=()=>{items=[];vPh=[];renderVPh();renderPreview()};
  $("confirm").onclick=async()=>{
    $("confirm").disabled=true;if(items.some(x=>!isCp(x.category)&&(x.ph||[]).length))$("vmsg").textContent="上傳照片中…";
    try{
      const bal={};wallets().forEach(w=>bal[w.store]=w.balance);const keep=[],probs=[];let done=0;
      const list=items.filter(a=>a.amount>0),order=list.filter(a=>String(a.category).startsWith("cpadd:")).concat(list.filter(a=>!String(a.category).startsWith("cpadd:")));
      for(const it of order){const d=it.date||$("vdate").value||today(),c=String(it.category),nt=[(it.note||"").trim(),(it.remark||"").trim()].filter(Boolean).join("・");
        if(c.startsWith("cpadd:")){const st=c.slice(6);if(!st){keep.push(it);probs.push("新增優惠券要寫店家");continue}
          const count=Math.max(1,Math.round(+it.count||1)),face=Math.round(+it.face||0)||Math.round(it.amount/count);
          await cpCol.add({...byFields(),store:st,type:"add",face,count,amount:face*count,date:d,month:d.slice(0,7),note:nt,ts:Date.now()});bal[st]=(bal[st]||0)+face*count;it.done=true;done++}
        else if(c.startsWith("coupon:")){const st=c.slice(7);
          if(!st||!(st in bal)){keep.push(it);probs.push(`還沒有${st||"這家"}的優惠券，可以說「新增${st||"全聯"}禮券 500 三張」，或在優惠券卡片按＋新增`);continue}
          if(bal[st]<it.amount){keep.push(it);probs.push(`${st}優惠券只剩 ${fmt(bal[st])}，不夠扣 ${fmt(it.amount)}`);continue}
          await cpCol.add({...byFields(),store:st,type:"use",amount:it.amount,date:d,month:d.slice(0,7),note:nt,ts:Date.now()});bal[st]-=it.amount;it.done=true;done++}
        else{const ref=col.doc(),ph=(it.ph||[]).length?await uploadPhotos(ref.id,d,it.ph):[];
          await ref.set({...byFields(),date:d,month:d.slice(0,7),category:c,amount:it.amount,note:(it.note||"").trim(),remark:(it.remark||"").trim(),...(ph.length?{ph}:{}),...((it.place||"").trim()?{place:it.place.trim()}:{})});it.done=true;done++}
      }
      items=keep;renderPreview();if(!keep.length)$("vtext").value="";
      $("vmsg").textContent=probs.length?(done?`已記 ${done} 筆。`:"")+probs.join("；"):"已記帳 ✅";
    }catch(e){items=items.filter(x=>!x.done);renderPreview();$("vmsg").textContent=saveErr(e,"寫入失敗，請稍後再試")}
    $("confirm").disabled=false;
  };
}

// ---- ledgers: 我的帳 (users/{uid}/ledgers/main) and 全家的帳 (households/{hid}/ledgers/main) ----
function stopSubs(){unsubs.forEach(f=>{try{f()}catch(e){}});unsubs=[]}
function ledgerBase(kind){return kind==="fam"&&hid?DB.doc(`households/${hid}/ledgers/main`):DB.doc(`users/${myId}/ledgers/main`)}
const shareRef=()=>hid&&curKey==="me"&&myId?DB.doc(`households/${hid}/shares/${myId}`):null;
function enterLedger(kind){
  if(kind==="fam"&&!hid)kind="me";
  stopSubs();clearTimeout(pubTimer);
  wz=null;$("wizard").hidden=true;curKey=kind;loaded=false;settings=null;expenses=[];incomes=[];coupons=[];lastPub="";view="home";cur=today().slice(0,7);setupOpen=false;sstate=null;items=[];famSel="";setSub=null;
  closePage();$("preview").innerHTML="";$("confirmRow").hidden=true;$("vtext").value="";$("vmsg").textContent="";vPh=[];$("vPhs").hidden=true;
  closeCat();closeSheet();closeForm();closeViewer();
  base=ledgerBase(kind);col=base.collection("expenses");phCol=base.collection("photos");incCol=base.collection("incomes");cpCol=base.collection("coupons");
  bdRef=DB.doc(`users/${myId}/prefs/bdays`);prefsRef=DB.doc(`users/${myId}/prefs/ui`);recurTried=new Set();
  let gotS=false,gotE=false;const go=()=>{if(gotS&&gotE&&!loaded){loaded=true;render()}};
  const failed=()=>{$("status").hidden=false;$("status").textContent="讀取失敗，請重新整理。"};
  unsubs.push(base.onSnapshot(sn=>{settings=sn.exists?sn.data():null;gotS=true;if(loaded)render();else go();schedulePublish();applyRecurring()},failed));
  unsubs.push(col.onSnapshot(sn=>{expenses=sn.docs.map(d=>({id:d.id,...d.data()}));gotE=true;if(loaded)render();else go();schedulePublish();applyRecurring()},failed));
  unsubs.push(bdRef.onSnapshot(sn=>{const d=sn.exists?sn.data():null;bdays=(d&&Array.isArray(d.list))?d.list:[];if(loaded&&(view==="cal"||view==="bd"))render()},()=>{}));
  unsubs.push(cpCol.onSnapshot(sn=>{coupons=sn.docs.map(d=>({id:d.id,...d.data()}));if(loaded)renderCoupons()},()=>{}));
  unsubs.push(incCol.onSnapshot(sn=>{incomes=sn.docs.map(d=>({id:d.id,...d.data()}));if(loaded)render();schedulePublish()},()=>{}));
  notesSub();
  unsubs.push(prefsRef.onSnapshot(sn=>{const d=sn.exists?sn.data():null;curPrefs=d;applyBg(d&&d.bg);if(loaded)render()},()=>{}));
  render();window.scrollTo(0,0);
}
function renderLedgerSw(){
  const sw=$("ledgerSw");sw.hidden=!(curKey&&hid);if(sw.hidden)return;
  [...sw.children].forEach(b=>{b.classList.toggle("on",b.dataset.k===curKey);b.setAttribute("aria-pressed",String(b.dataset.k===curKey))});
}
function renderAcct(){
  const b=$("acctBtn");b.hidden=!me||!curKey;if(b.hidden)return;
  const im=$("acctImg"),ph=(me&&me.photoURL)||"";im.hidden=!ph;if(ph&&im.getAttribute("src")!==ph)im.src=ph;
  $("acctIni").hidden=!!ph;$("acctIni").textContent=myName().slice(0,1);
}

// ---- wizard ----
function showWizard(){
  const fam=curKey==="fam";
  if(!wz)wz={step:0,allow:"",list:PRESETS.map(([n,e])=>({name:n,emoji:e,on:DEFAULT_ON.includes(n),budget:""})),remind:null,time:"21:00"};
  const N=fam?3:4,b=$("wzBody");$("wizard").hidden=false;b.innerHTML="";$("wzMsg").textContent="";
  $("wzStep").textContent=`第 ${wz.step+1} 題 / 共 ${N} 題`;$("wzDots").textContent=Array.from({length:N},(_,i)=>i<=wz.step?"●":"○").join(" ");
  const el=(tag,cls,txt)=>{const x=document.createElement(tag);if(cls)x.className=cls;if(txt!=null)x.textContent=txt;return x};
  const add=x=>{b.appendChild(x);return x};
  if(wz.step===0){
    add(el("h2","",fam?`來設定「${hhName()}」的共同帳：每個月的家用預算大概多少？`:`嗨 ${myName()}！這個月你的額度（零用錢／預算）是多少？`));
    const i=add(el("input"));i.type="number";i.min="0";i.inputMode="numeric";i.placeholder=fam?"例如 30000":"例如 12000";i.value=wz.allow;i.oninput=()=>{wz.allow=i.value};
    add(el("p","sub",fam?"像是伙食、日用品、水電這些全家一起花的錢。不確定可以先空著，之後在「設定」裡改。":"不確定可以先空著，之後在「設定」裡改。"));
  }else if(wz.step===1){
    add(el("h2","",fam?"全家的帳要記哪些類別？":"你想記哪些類別？"));add(el("p","sub","點一下選取或取消，也可以自己新增。"));
    const box=add(el("div"));
    wz.list.forEach(c=>{const x=el("button","chip"+(c.on?" on":""),c.name);x.type="button";x.setAttribute("aria-pressed",String(c.on));x.onclick=()=>{c.on=!c.on;showWizard()};box.appendChild(x)});
    const row=add(el("div","bt"));const ci=el("input");ci.placeholder="自訂類別";const cb=el("button","ghost","新增");cb.type="button";
    cb.onclick=()=>{const n=ci.value.trim();if(!n||wz.list.some(c=>c.name===n))return;wz.list.push({name:n,emoji:"🔖",on:true,budget:""});showWizard()};row.append(ci,cb);
  }else if(wz.step===2){
    add(el("h2","","每個類別每月想花多少？"));add(el("p","sub","不想設預算的就留空。"));
    wz.list.filter(c=>c.on).forEach(c=>{const r=add(el("div","sr"));const l=el("label","",c.name);const i=el("input");i.type="number";i.min="0";i.inputMode="numeric";i.placeholder="預算";i.value=c.budget;i.oninput=()=>{c.budget=i.value};r.append(l,i)});
  }else{
    add(el("h2","","要不要每天固定時間提醒你記帳？"));
    add(el("p","sub","會下載一個行事曆檔，加到手機的行事曆以後，每天時間到就會跳通知。"));
    const t=add(el("input"));t.type="time";t.value=wz.time;t.oninput=()=>{wz.time=t.value||"21:00"};t.style.marginBottom="10px";
    [[true,"好，加到行事曆"],[false,"先不用"]].forEach(([v,lab])=>{const x=add(el("button","opt"+(wz.remind===v?" on":""),lab));x.type="button";x.onclick=()=>{wz.remind=v;if(v)downloadICS(wz.time);showWizard()}});
    if(wz.remind)add(el("p","sub","已下載行事曆檔。打開它、選「加入」就設定好了。"));
  }
  const nav=add(el("div","bt"));nav.style.marginTop="16px";
  if(wz.step>0){const x=el("button","ghost","← 上一題");x.type="button";x.onclick=()=>{wz.step--;showWizard()};nav.appendChild(x)}
  const nx=el("button","",wz.step<N-1?"下一題 →":"完成，開始記帳");nx.type="button";
  nx.onclick=async()=>{
    if(wz.step===1&&!wz.list.some(c=>c.on)){$("wzMsg").textContent="請至少選一個類別";return}
    if(wz.step===3&&wz.remind===null){$("wzMsg").textContent="請選一個";return}
    if(wz.step<N-1){wz.step++;showWizard();window.scrollTo(0,0);return}
    nx.disabled=true;
    const chosen=wz.list.filter(c=>c.on),allow=Math.max(0,+wz.allow||0);
    const data={categories:chosen.map(c=>({name:c.name,budget:Math.max(0,+c.budget||0)})),allowance:{[cur]:allow},defaultAllowance:allow,...(fam?{createdBy:myId}:{share:"none"})};
    try{await base.set(data);wz=null;view="home"}
    catch(e){$("wzMsg").textContent="儲存失敗，請稍後再試";nx.disabled=false}
  };
  nav.appendChild(nx);
}

// ---- helpers: income, share chart ----
const incomeSum=m=>incomes.filter(i=>i.month===m).reduce((t,i)=>t+(+i.amount||0),0);
function renderShare(ex,spent){
  const box=$("share");box.innerHTML="";if(!spent)return;
  const list=cats().map((c,i)=>({name:c.name,color:i<8?`var(--s${i+1})`:"var(--muted)",v:ex.filter(e=>e.category===c.name).reduce((t,e)=>t+(+e.amount||0),0)}));
  const known=new Set(cats().map(c=>c.name)),ov=ex.filter(e=>!known.has(e.category)).reduce((t,e)=>t+(+e.amount||0),0);
  if(ov)list.push({name:"其他",removed:true,color:"var(--muted)",v:ov});
  const bar=document.createElement("div");bar.className="sbar";const lg=document.createElement("div");lg.className="legend";
  list.filter(x=>x.v>0).forEach(x=>{
    const pct=x.v/spent*100,seg=document.createElement("i");seg.style.flex=String(x.v);seg.style.background=x.color;seg.title=`${x.name} ${fmt(x.v)}（${Math.round(pct)}%）`;bar.appendChild(seg);
    const it=document.createElement("span"),sw=document.createElement("i");sw.style.background=x.color;const b=document.createElement("b");b.textContent=x.name;
    it.className="lt";it.onclick=()=>openCat(ownCat(x.name,!!x.removed));
    it.append(sw,b,document.createTextNode(` ${fmt(x.v)}・${Math.round(pct)}%`));lg.appendChild(it);
  });
  const cap=document.createElement("div");cap.className="sub";cap.style.margin="0 0 4px";cap.textContent="錢花在哪";
  box.append(cap,bar,lg);
}

// ---- edit sheet ----
let shCtx=null,delArmed=false;
function openSheet(kind,item){
  shCtx={kind,item};delArmed=false;$("shMsg").textContent="";$("shDel").textContent="刪除";
  const isInc=kind==="inc"||kind==="newInc";
  $("shTitle").textContent=kind==="newInc"?"新增收入":kind==="newExp"?"新增支出":isInc?"修改收入":"修改這一筆";
  $("shCatL").hidden=isInc;$("shRemL").hidden=isInc;$("shDel").hidden=kind==="newInc"||kind==="newExp";
  const sc=$("shCat");sc.innerHTML="";cats().forEach(c=>{const o=document.createElement("option");o.textContent=c.name;sc.appendChild(o)});
  if(item&&item.category&&!cats().some(c=>c.name===item.category)){const o=document.createElement("option");o.textContent=item.category;sc.appendChild(o)}
  const defDate=cur===today().slice(0,7)?today():cur+"-01";
  $("shDate").value=item?item.date:defDate;$("shAmt").value=item?item.amount:"";$("shNote").value=item?(item.note||""):"";$("shRem").value=item?(item.remark||""):"";
  if(item&&item.category)sc.value=item.category;
  $("shNote").placeholder=isInc?"例如 紅包、打工":"";
  shPh=(!isInc&&item)?phOf(item).map(p=>({id:p.id,t:p.t})):[];$("shPhL").hidden=isInc;$("shPlaceL").hidden=isInc;$("shPlace").value=(!isInc&&item&&item.place)||"";
  if(!isInc){renderShPh();updShMap()}
  $("shSave").disabled=false;
  $("sheetBg").hidden=false;$("sheet").hidden=false;
}
function closeSheet(){
  shCtx=null;$("sheet").hidden=true;
  if(csBack&&csCtx){csBack=false;$("csheet").hidden=false;renderCat()}
  else{csBack=false;if($("csheet").hidden)$("sheetBg").hidden=true}
}
$("shCancel").onclick=closeSheet;$("sheetBg").onclick=()=>{if(!$("sheet").hidden||!$("fsheet").hidden){closeSheet();closeForm()}else closeCat()};

// ---- category detail ----
function catColor(name){const i=cats().findIndex(c=>c.name===name);return i>=0&&i<8?`var(--s${i+1})`:"var(--muted)"}
function ownCat(name,removed){
  return{own:true,title:removed?"已移除的類別":name,color:removed?"var(--muted)":catColor(name),edit:canWrite,
    budget:()=>{const c=cats().find(x=>x.name===name);return removed||!c?0:(+c.budget||0)},
    total:()=>expenses.filter(e=>e.month===cur).reduce((t,e)=>t+(+e.amount||0),0),
    items:()=>{const k=new Set(cats().map(c=>c.name));return expenses.filter(e=>e.month===cur&&(removed?!k.has(e.category):e.category===name)).map(e=>({date:e.date,note:e.note,remark:e.remark,amount:+e.amount||0,cat:removed?e.category:"",src:e}))}};
}
function openCat(ctx){csCtx=ctx;csSort="date";csBack=false;renderCat();$("sheetBg").hidden=false;$("csheet").hidden=false;$("csList").scrollTop=0}
function closeCat(){csCtx=null;csBack=false;$("csheet").hidden=true;if($("sheet").hidden&&$("fsheet").hidden)$("sheetBg").hidden=true}
function renderCat(){
  if(!csCtx)return;
  const c=csCtx,items=c.items(),sum=items.reduce((t,x)=>t+x.amount,0),bud=c.budget(),tot=c.total(),mm=+cur.slice(5);
  const tt=$("csTitle");tt.textContent="";
  {const dot=document.createElement("i");dot.style.background=c.color;const sm=document.createElement("small");sm.textContent=mm+" 月";tt.append(dot,document.createTextNode(c.title),sm)}
  const s=$("csSum");s.innerHTML='<div class="cstop"><b></b><span></span></div>';
  s.querySelector("b").textContent=fmt(sum);s.querySelector(".cstop span").textContent=bud?"預算 "+fmt(bud):"";
  if(bud){const bar=document.createElement("div");bar.className="bar";const i=document.createElement("i"),pct=sum/bud*100;i.style.width=Math.min(100,pct)+"%";if(pct>=100)i.className="bad";else if(pct>=80)i.className="warn";bar.appendChild(i);s.appendChild(bar)}
  const meta=document.createElement("div");meta.className="csmeta";
  meta.textContent=[`共 ${items.length} 筆`,tot&&sum?`佔本月支出 ${Math.round(sum/tot*100)}%`:""].filter(Boolean).join("・");
  if(bud){const left=bud-sum,sp=document.createElement("span");if(left<0)sp.className="neg";sp.textContent="・"+(left<0?"超支 "+fmt(-left):"剩 "+fmt(left));meta.appendChild(sp)}
  s.appendChild(meta);
  $("csSort").hidden=items.length<2;
  [...$("csSort").children].forEach(b=>b.classList.toggle("on",b.dataset.k===csSort));
  const list=$("csList");list.innerHTML="";
  if(!items.length){const p=document.createElement("div");p.className="empty";p.style.padding="14px 0 8px";p.textContent="這個月還沒有這個類別的支出";list.appendChild(p);return}
  items.sort(csSort==="amt"?(a,b)=>b.amount-a.amount||b.date.localeCompare(a.date):(a,b)=>b.date.localeCompare(a.date)||b.amount-a.amount);
  items.forEach(x=>{
    const ed=c.edit&&x.src,el=document.createElement(ed?"button":"div");if(ed)el.type="button";el.className="ci";
    const d=document.createElement("span");d.className="d";d.textContent=x.date.slice(5);
    const t=document.createElement("span");t.className="t";t.textContent=x.note||"（沒有描述）";
    const sub=[x.remark,x.cat].filter(Boolean).join("・");if(sub){const sm=document.createElement("small");sm.textContent=sub;t.appendChild(sm)}
    const a=document.createElement("span");a.className="a";a.textContent=fmt(x.amount);
    el.append(d,t);if(x.src&&phOf(x.src).length)el.appendChild(thumbEl(x.src));el.appendChild(a);
    if(ed)el.onclick=()=>{csBack=true;$("csheet").hidden=true;openSheet("exp",x.src)};
    list.appendChild(el);
  });
}
$("csClose").onclick=closeCat;

// ---- photos on expenses ----
// full image: data/users/<uid>/<key>/photos/<pid> {exp,month,date,full,ts}; the expense keeps ph:[{id,t}] (t = small square thumbnail)
const isCp=c=>/^(coupon|cpadd):/.test(String(c||""));
const phOf=e=>Array.isArray(e&&e.ph)?e.ph.filter(p=>p&&p.id&&p.t):[];
const PIN_SVG='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 21s-6.5-5.6-6.5-11a6.5 6.5 0 0 1 13 0C18.5 15.4 12 21 12 21z"/><circle cx="12" cy="10" r="2.4"/></svg>';
function mapsUrl(e){
  const p=String((e&&e.place)||"").trim(),m=p.match(/https?:\/\/[^\s<>"]+/i);if(m)return m[0];
  const n=String((e&&e.note)||"").trim(),q=p?(n&&!p.includes(n)?n+" "+p:p):n;return q?"https://www.google.com/maps/search/?api=1&query="+encodeURIComponent(q):"";
}
function mapsLabel(e){
  const p=String((e&&e.place)||"").replace(/https?:\/\/[^\s<>"]+/ig,"").replace(/\s+/g," ").trim();
  if(p)return p;if(isGeoUrl(e&&e.place))return"拍照的地點";if(String((e&&e.place)||"").trim())return"在 Google 地圖打開";
  const n=String((e&&e.note)||"").trim();return n?`在 Google 地圖找「${n}」`:"";
}
const capOf=e=>[e.date?e.date.slice(5):"",(e.note||e.category||"")+(e.remark?"（"+e.remark+"）":""),e.amount?fmt(e.amount):""].filter(Boolean).join("・");
function loadImg(file){return new Promise((res,rej)=>{const u=URL.createObjectURL(file),im=new Image();im.onload=()=>res(im);im.onerror=()=>{URL.revokeObjectURL(u);rej(new Error("img"))};im.src=u})}
function toJpeg(im,max,q,square){
  const W=im.naturalWidth||im.width,H=im.naturalHeight||im.height;let sx=0,sy=0,sw=W,sh=H;
  if(square){const s=Math.min(W,H);sx=(W-s)/2;sy=(H-s)/2;sw=sh=s}
  const k=Math.min(1,max/Math.max(sw,sh)),w=Math.max(1,Math.round(sw*k)),h=Math.max(1,Math.round(sh*k));
  const c=document.createElement("canvas");c.width=w;c.height=h;const g=c.getContext("2d");g.fillStyle="#fff";g.fillRect(0,0,w,h);g.drawImage(im,sx,sy,sw,sh,0,0,w,h);
  return c.toDataURL("image/jpeg",q);
}
// read the GPS position a phone camera stores in the photo (JPEG, and HEIC's embedded Exif block)
function tiffGeo(dv,t){
  const bo=dv.getUint16(t),le=bo===0x4949;if(!le&&bo!==0x4d4d)return null;
  const u16=o=>dv.getUint16(t+o,le),u32=o=>dv.getUint32(t+o,le);if(u16(2)!==42)return null;
  const ifd0=u32(4),cnt=u16(ifd0);let gps=0;
  for(let k=0;k<cnt;k++){const e=ifd0+2+k*12;if(u16(e)===0x8825){gps=u32(e+8);break}}
  if(!gps)return null;
  const gc=u16(gps),v={};
  for(let k=0;k<gc;k++){const e=gps+2+k*12,tag=u16(e),type=u16(e+2),count=u32(e+4);
    if(tag===1||tag===3)v[tag]=String.fromCharCode(dv.getUint8(t+e+8));
    else if((tag===2||tag===4)&&type===5&&count===3){const off=u32(e+8),r=j=>{const a=u32(off+j*8),b=u32(off+j*8+4);return b?a/b:0};v[tag]=r(0)+r(1)/60+r(2)/3600}}
  if(v[2]==null||v[4]==null)return null;
  let lat=v[2],lng=v[4];if(v[1]==="S")lat=-lat;if(v[3]==="W")lng=-lng;
  if(!isFinite(lat)||!isFinite(lng)||(!lat&&!lng)||Math.abs(lat)>90||Math.abs(lng)>180)return null;
  return{lat:+lat.toFixed(6),lng:+lng.toFixed(6)};
}
async function photoGeo(file){
  try{
    if(!file||file.size>40e6)return null;
    const buf=file.arrayBuffer?await file.arrayBuffer():await new Response(file).arrayBuffer(),u=new Uint8Array(buf),dv=new DataView(buf);
    for(let i=0;i<u.length-16;i++){
      if(u[i]===0x45&&u[i+1]===0x78&&u[i+2]===0x69&&u[i+3]===0x66&&u[i+4]===0&&u[i+5]===0){try{const g=tiffGeo(dv,i+6);if(g)return g}catch(e){}}
    }
  }catch(e){}
  return null;
}
const geoUrl=g=>`https://www.google.com/maps/search/?api=1&query=${g.lat},${g.lng}`;
const isGeoUrl=p=>/google\.com\/maps\/search\/\?api=1&query=-?\d+(\.\d+)?,-?\d+(\.\d+)?$/.test(String(p||"").trim());
// fill an empty place from the first photo that knows where it was taken; returns "filled" | "none" | ""
function placeFromPhotos(arr,cur,set){
  if(!arr.length)return"";const g=arr.find(p=>p.geo);
  if(!g)return arr.every(p=>p.fresh)?"none":"";
  if(String(cur||"").trim())return"";set(geoUrl(g.geo));return"filled";
}
const GEO_MSG={filled:"已從照片帶入拍照地點",none:"這張照片沒有位置資訊，地點可以自己填"};
async function makePhoto(file){
  const geo=await photoGeo(file);
  const im=await loadImg(file);let max=1280,q=.8,full="";
  for(;;){full=toJpeg(im,max,q);if(full.length<=190000||max<=480)break;if(q>.6)q=Math.round((q-.1)*100)/100;else{max=Math.round(max*.8);q=.74}}
  const t=toJpeg(im,160,.62,true);URL.revokeObjectURL(im.src);
  return{id:"p"+Date.now().toString(36)+Math.random().toString(36).slice(2,7),t,full,fresh:true,...(geo?{geo}:{})};
}
function pickPhotos(cb){phPickCb=cb;$("phFile").click()}
$("phFile").onchange=async e=>{
  const fs=[...(e.target.files||[])];e.target.value="";const cb=phPickCb;phPickCb=null;if(!fs.length||!cb)return;
  const out=[];for(const f of fs){try{out.push(await makePhoto(f))}catch(err){}}
  cb(out,fs.length-out.length);
};
function phStrip(box,list,o){
  box.innerHTML="";
  list.forEach((p,i)=>{
    const w=document.createElement("div");w.className="ph";
    const v=document.createElement("button");v.type="button";v.className="phv";v.setAttribute("aria-label","看照片");
    const im=document.createElement("img");im.src=p.t;im.alt="";v.appendChild(im);
    v.onclick=()=>{const en=typeof o.ent==="function"?o.ent():o.ent;openViewer(list.map(x=>({id:x.id,t:x.t,full:x.full,e:en||null,cap:en?capOf(en):"還沒記帳的照片"})),i)};
    const x=document.createElement("button");x.type="button";x.className="rm";x.setAttribute("aria-label","移除這張照片");x.textContent="✕";
    x.onclick=()=>{list.splice(i,1);o.onChange()};
    w.append(v,x);box.appendChild(w);
  });
  if(list.length<PH_MAX){
    const a=document.createElement("button");a.type="button";a.className="phadd";a.innerHTML="<b>＋</b><span>照片</span>";
    a.onclick=()=>pickPhotos((arr,bad)=>{const add=arr.slice(0,PH_MAX-list.length);list.push(...add);const r=o.onAdd?o.onAdd(add):"";o.onChange();if(o.msg)o.msg(bad?"有照片讀不出來，換一張試試":(GEO_MSG[r]||""))});
    box.appendChild(a);
  }
}
async function uploadPhotos(expId,d,list){
  for(const p of list)if(p.fresh){await phCol.doc(p.id).set({exp:expId,month:d.slice(0,7),date:d,full:p.full,ts:Date.now()});phCache.set(p.id,p.full);delete p.fresh;delete p.full}
  return list.map(p=>({id:p.id,t:p.t}));
}
async function dropPhotos(prev,keep){
  const k=new Set((keep||[]).map(p=>p.id));
  for(const p of prev||[])if(p&&p.id&&!k.has(p.id)){try{await phCol.doc(p.id).delete()}catch(e){}phCache.delete(p.id)}
}
function saveErr(e,def){const c=e&&e.code;return c==="quota_exceeded"?"儲存空間滿了，照片存不進去。可以刪掉一些舊照片再試":c==="invalid_argument"?"這張照片太大存不進去，換一張試試":def}
function thumbEl(e){
  const ph=phOf(e),im=document.createElement("img");im.className="tn";im.src=ph[0].t;im.alt="照片";
  im.onclick=ev=>{ev.stopPropagation();openViewer(ph.map(p=>({id:p.id,t:p.t,cap:capOf(e),e})),0)};
  return im;
}
function renderPhotoWall(ex){
  const card=$("phCard"),g=$("phGrid");g.innerHTML="";
  const list=[];ex.forEach(e=>phOf(e).forEach(p=>list.push({id:p.id,t:p.t,cap:capOf(e),e})));
  card.hidden=!list.length;if(!list.length)return;
  $("phTitle").textContent=`這個月的照片・${list.length} 張`;
  list.forEach((p,i)=>{
    const b=document.createElement("button");b.type="button";b.setAttribute("aria-label",p.cap);
    const im=document.createElement("img");im.src=p.t;im.alt="";im.loading="lazy";
    const s=document.createElement("span");s.textContent=p.e.date.slice(5)+" "+(p.e.note||p.e.category);
    b.append(im,s);b.onclick=()=>openViewer(list,i);g.appendChild(b);
  });
}
function openViewer(list,i){if(!list.length)return;vw={list,i};$("viewer").hidden=false;showVw()}
function closeViewer(){vw=null;$("viewer").hidden=true;$("vwImg").removeAttribute("src")}
async function showVw(){
  if(!vw)return;const p=vw.list[vw.i],img=$("vwImg");
  img.src=p.full||phCache.get(p.id)||p.t;
  $("vwCap").textContent=p.cap||"";
  {const a=$("vwMap"),u=p.e?mapsUrl(p.e):"";a.hidden=!u;if(u){a.href=u;a.innerHTML=PIN_SVG;a.appendChild(document.createTextNode(mapsLabel(p.e)))}else a.removeAttribute("href")}$("vwCount").textContent=vw.list.length>1?`${vw.i+1} / ${vw.list.length}`:"";
  $("vwPrev").hidden=$("vwNext").hidden=vw.list.length<2;
  if(!p.full&&!phCache.has(p.id)&&phCol){
    try{const sn=await phCol.doc(p.id).get(),d=sn.exists?sn.data():null;
      if(d&&d.full){phCache.set(p.id,d.full);if(phCache.size>24)phCache.delete(phCache.keys().next().value);if(vw&&vw.list[vw.i]===p)img.src=d.full}}catch(e){}
  }
}
function stepVw(n){if(!vw||vw.list.length<2)return;vw.i=(vw.i+n+vw.list.length)%vw.list.length;showVw()}
$("vwClose").onclick=closeViewer;
$("vwPrev").onclick=e=>{e.stopPropagation();stepVw(-1)};$("vwNext").onclick=e=>{e.stopPropagation();stepVw(1)};
$("vwMap").addEventListener("click",e=>e.stopPropagation());
$("viewer").onclick=e=>{if(e.target===$("viewer")||e.target.classList.contains("vwimg"))closeViewer()};
{let tx=null,ty=null;
 $("viewer").addEventListener("touchstart",e=>{tx=e.touches[0].clientX;ty=e.touches[0].clientY},{passive:true});
 $("viewer").addEventListener("touchend",e=>{if(tx==null)return;const dx=e.changedTouches[0].clientX-tx,dy=e.changedTouches[0].clientY-ty;tx=null;if(Math.abs(dx)>50&&Math.abs(dx)>Math.abs(dy))stepVw(dx<0?1:-1);else if(dy>90&&Math.abs(dy)>Math.abs(dx))closeViewer()});}
document.addEventListener("keydown",e=>{if(!vw)return;if(e.key==="Escape")closeViewer();else if(e.key==="ArrowLeft")stepVw(-1);else if(e.key==="ArrowRight")stepVw(1)});
function shEnt(){return{date:$("shDate").value,note:$("shNote").value,remark:$("shRem").value,amount:+$("shAmt").value,category:$("shCat").value,place:$("shPlace").value}}
function updShMap(){const a=$("shMap"),u=mapsUrl(shEnt());a.hidden=!u;if(u)a.href=u;else a.removeAttribute("href")}
$("shPlace").oninput=updShMap;$("shNote").addEventListener("input",updShMap);
function renderShPh(){phStrip($("shPhs"),shPh,{ent:shEnt,onAdd:arr=>placeFromPhotos(arr,$("shPlace").value,v=>{$("shPlace").value=v;updShMap()}),onChange:renderShPh,msg:t=>{$("shMsg").textContent=t}})}
function renderVPh(){const b=$("vPhs");b.hidden=!vPh.length;phStrip(b,vPh,{ent:null,onChange:renderVPh,msg:t=>{$("vmsg").textContent=t}})}
$("attachBtn").onclick=()=>pickPhotos((arr,bad)=>{
  if(!arr.length){$("vmsg").textContent=bad?"這張照片讀不出來，換一張試試":"";return}
  const t=items.find(x=>!isCp(x.category));
  if(t){const add=arr.slice(0,PH_MAX-(t.ph||[]).length);t.ph=(t.ph||[]).concat(add);const r=placeFromPhotos(add,t.place,v=>{t.place=v});renderPreview();
    $("vmsg").textContent=[items.length>1?"照片加在第一筆；要換到別筆，按照片右上的 ✕，再到那一筆按「＋ 照片」":"",GEO_MSG[r]||""].filter(Boolean).join("。")}
  else{vPh=vPh.concat(arr).slice(0,PH_MAX);renderVPh();const g=vPh.some(p=>p.geo);$("vmsg").textContent="按「解析」後，照片會附在那一筆"+(g?"，拍照地點也會自動帶入":"。"+GEO_MSG.none)}
});
[...$("csSort").children].forEach(b=>{b.onclick=()=>{csSort=b.dataset.k;renderCat()}});
$("shSave").onclick=async()=>{
  if(!shCtx)return;const d=$("shDate").value||today(),amt=Math.round(+$("shAmt").value||0);
  if(amt<=0){$("shMsg").textContent="請輸入金額";return}
  const base2={date:d,month:d.slice(0,7),amount:amt,note:$("shNote").value.trim()};
  const ctx=shCtx;$("shSave").disabled=true;$("shMsg").textContent=shPh.some(p=>p.fresh)?"上傳照片中…":"";
  try{
    if(ctx.kind==="exp"){
      const prev=phOf(ctx.item),ph=await uploadPhotos(ctx.item.id,d,shPh);
      const pl=$("shPlace").value.trim();
      await col.doc(ctx.item.id).update({...base2,category:$("shCat").value,remark:$("shRem").value.trim(),...((ph.length||prev.length)?{ph}:{}),...((pl||ctx.item.place)?{place:pl}:{})});
      await dropPhotos(prev,ph);
    }
    else if(ctx.kind==="newExp"){const ref=col.doc(),ph=await uploadPhotos(ref.id,d,shPh),pl=$("shPlace").value.trim();await ref.set({...byFields(),...base2,category:$("shCat").value,remark:$("shRem").value.trim(),...(ph.length?{ph}:{}),...(pl?{place:pl}:{})})}
    else if(ctx.kind==="inc")await incCol.doc(ctx.item.id).update(base2);
    else await incCol.add({...byFields(),...base2});
    if(shCtx===ctx)closeSheet();
  }catch(e){$("shMsg").textContent=saveErr(e,"儲存失敗，請稍後再試")}
  $("shSave").disabled=false;
};
$("shDel").onclick=async()=>{
  if(!shCtx||!shCtx.item)return;
  if(!delArmed){delArmed=true;$("shDel").textContent="確定刪除？";return}
  const it=shCtx.item;
  try{
    if(shCtx.kind==="exp"){await col.doc(it.id).delete();await dropPhotos(phOf(it),[]);if(String(it.id).startsWith("r-")){const sk=((settings&&settings.recurSkip)||[]).concat([it.id]);await base.update({recurSkip:sk})}}
    else await incCol.doc(it.id).delete();
    closeSheet();
  }catch(e){$("shMsg").textContent="刪除失敗，請稍後再試"}
};
$("incAdd").onclick=()=>openSheet("newInc",null);
$("expAdd").onclick=()=>openSheet("newExp",null);

// ---- recurring ----
function applyRecurring(){
  if(!loaded||!settings||!canWrite||!col)return;
  const list=settings.recurring||[];if(!list.length)return;
  const m=today().slice(0,7),day=+today().slice(8),skip=new Set(settings.recurSkip||[]);
  const [y,mo]=m.split("-").map(Number),dim=new Date(y,mo,0).getDate();
  list.forEach(r=>{
    const id=`r-${r.id}-${m.replace("-","")}`;
    if(day<Math.min(r.day,dim)||skip.has(id)||recurTried.has(id)||expenses.some(e=>e.id===id))return;
    recurTried.add(id);
    col.doc(id).set({date:`${m}-${String(Math.min(r.day,dim)).padStart(2,"0")}`,month:m,category:r.category,amount:r.amount,note:r.name,remark:"固定支出"}).catch(()=>recurTried.delete(id));
  });
}
function renderRecur(){
  const box=$("recurList");box.innerHTML="";const list=(settings&&settings.recurring)||[];
  if(!list.length){const p=document.createElement("div");p.className="sub";p.textContent="還沒有固定支出。";box.appendChild(p)}
  list.forEach((r,i)=>{const row=document.createElement("div");row.className="rc";const t=document.createElement("span");t.textContent=`${r.name}・每月 ${r.day} 號・${r.category} ${fmt(r.amount)}`;
    const x=document.createElement("button");x.type="button";x.className="x";x.textContent="×";x.setAttribute("aria-label","刪除");
    x.onclick=async()=>{const nl=list.slice();nl.splice(i,1);try{await base.update({recurring:nl})}catch(e){}};row.append(t,x);box.appendChild(row)});
  const sc=$("rcCat"),keep=sc.value;sc.innerHTML="";cats().forEach(c=>{const o=document.createElement("option");o.textContent=c.name;sc.appendChild(o)});if(keep)sc.value=keep;
}
$("rcAdd").onclick=async()=>{
  const name=$("rcName").value.trim(),amount=Math.round(+$("rcAmt").value||0),day=Math.min(28,Math.max(1,Math.round(+$("rcDay").value||1)));
  if(!name||amount<=0){$("rcMsg").textContent="請填名稱和金額";return}
  const list=((settings&&settings.recurring)||[]).concat([{id:Date.now().toString(36),name,amount,category:$("rcCat").value,day}]);
  try{await base.update({recurring:list});$("rcName").value="";$("rcAmt").value="";$("rcMsg").textContent="已加入，到了日期會自動記"}catch(e){$("rcMsg").textContent="加入失敗，請稍後再試"}
};

// ---- settings menu ----
const SETS=[["cat","額度與類別"],["recur","固定支出"],["family","家庭成員與邀請"],["share","分享給家人"],["goal","家庭存錢目標"],["remind","每日記帳提醒"],["look","背景與每日一句"],["export","匯出與備份"],["feedback","意見回饋"],["account","帳號"]];
const setsFor=()=>SETS.filter(([k])=>!(curKey==="fam"&&k==="share"));
function setTitle(k){if(curKey==="fam"&&k==="cat")return"共同帳的預算與類別";return(SETS.find(x=>x[0]===k)||["",""])[1]}
function setValue(k){
  if(k==="family")return hid?hhName():"還沒有";
  if(k==="account")return(me&&me.email)||"";
  if(k==="look")return(curPrefs&&curPrefs.bg?"有背景":"無背景")+"・"+(quoteOn()?"每日一句開":"每日一句關");
  if(k==="remind"){const t=curPrefs&&curPrefs.remindTime;return t?"每天 "+t:"未設定"}
  if(k==="goal")return goal?goal.name:(hid?"未設定":"需先加入家庭");
  if(!settings)return"";
  if(k==="cat"){const a=allowanceOf(today().slice(0,7));return(a?fmt(a)+"・":"")+cats().length+" 類"}
  if(k==="recur"){const n=(settings.recurring||[]).length;return n?n+" 項":"無"}
  if(k==="share")return hid?({none:"不公開",total:"總支出",cats:"類別合計",full:"完整明細"})[settings.share||"none"]:"需先加入家庭";
  return"";
}
function renderSet(){
  const menu=$("setMenu");menu.hidden=!!setSub;
  document.querySelectorAll(".subpg").forEach(d=>{d.hidden=d.dataset.sub!==setSub});
  $("setBack").hidden=!setSub;$("setTitle").textContent=setSub?setTitle(setSub):(curKey==="fam"?"設定（全家的帳）":"設定");
  if(!setSub){
    menu.innerHTML="";
    setsFor().forEach(([k])=>{const b=document.createElement("button");b.type="button";b.className="mi";const a=document.createElement("span");a.textContent=setTitle(k);const v=document.createElement("span");v.textContent=(setValue(k)?setValue(k)+"  ":"")+"›";b.append(a,v);
      b.onclick=()=>{setSub=k;sstate=null;["setupMsg","rcMsg","goalMsg","bgMsg","expMsg","shareMsg","bkMsg","fbMsg","remindMsg"].forEach(i=>{const e=$(i);if(e)e.textContent=""});render();window.scrollTo(0,0)};menu.appendChild(b)});
    return;
  }
  if(setSub==="cat"&&!sstate)openSetup();
  if(setSub==="recur")renderRecur();
  if(setSub==="feedback")openFeedback();
  if(setSub==="family")renderFamilyPage();
  if(setSub==="account")renderAccount();
  if(setSub==="look")renderLook();
  if(setSub==="remind")renderReminder();
  if(setSub==="share"){$("privacy").hidden=false;$("shareNoHH").hidden=!!hid;$("shareLevel").disabled=!hid;$("shareLevel").value=(settings&&settings.share)||"none"}
  if(setSub==="export"){$("bkScope").textContent=curKey==="fam"?`目前在「全家的帳」，匯出和備份的是「${hhName()}」的共同帳。`:"目前在「我的帳」，匯出和備份的是你自己的帳（含生日名單）。"}
  if(setSub==="goal"){$("goalNoHH").hidden=!!hid;$("goalForm").hidden=!hid;
    if(document.activeElement!==$("goalName")&&document.activeElement!==$("goalTarget")){$("goalName").value=goal?goal.name:"";$("goalTarget").value=goal?goal.target:"";$("goalDel").hidden=!goal}}
}
$("setBack").onclick=()=>{setSub=null;sstate=null;render();window.scrollTo(0,0)};

// ---- family goal (stored on the household) ----
function renderGoal(){
  const c=$("goalCard");if(!goal||!hid){c.hidden=true;return}
  c.hidden=false;c.innerHTML="";
  const saved=contribs.reduce((t,x)=>t+(+x.amount||0),0),tg=+goal.target||0,pct=tg?Math.min(100,saved/tg*100):0;
  const h=document.createElement("div");h.className="lhead";const t=document.createElement("h2");t.textContent=goal.name;const btn=document.createElement("button");btn.type="button";btn.className="ghost sm";btn.textContent="＋ 存一筆";h.append(t,btn);
  const bar=document.createElement("div");bar.className="gbar";const fill=document.createElement("i");fill.style.width=pct+"%";bar.appendChild(fill);
  const line=document.createElement("div");line.className="sub";line.textContent=`${fmt(saved)} / ${fmt(tg)}（${Math.round(pct)}%）`+(pct>=100?"　達成了！":"");
  const by={};contribs.forEach(x=>{const n=(members[x.uid]&&members[x.uid].name)||x.name||"家人";by[n]=(by[n]||0)+(+x.amount||0)});
  const who=document.createElement("div");who.className="sub";who.style.marginTop="2px";who.textContent=Object.keys(by).map(r=>`${r} ${fmt(by[r])}`).join("・");
  const form=document.createElement("div");form.className="bt";form.hidden=true;
  const inp=document.createElement("input");inp.type="number";inp.min="1";inp.inputMode="numeric";inp.placeholder="金額";inp.style.width="120px";
  const ok=document.createElement("button");ok.type="button";ok.textContent="存入";const msg=document.createElement("small");msg.className="m";
  ok.onclick=async()=>{const a=Math.round(+inp.value||0);if(a<=0)return;ok.disabled=true;try{await DB.collection(`households/${hid}/contrib`).add({uid:myId,name:myName(),amount:a,date:today(),ts:Date.now()});inp.value="";form.hidden=true}catch(e){msg.textContent="存入失敗"}ok.disabled=false};
  form.append(inp,ok,msg);btn.onclick=()=>{form.hidden=!form.hidden;if(!form.hidden)inp.focus()};
  c.append(h,bar,line);if(who.textContent)c.appendChild(who);c.appendChild(form);
}
$("goalSave").onclick=async()=>{
  if(!hid){$("goalMsg").textContent="要先建立或加入家庭";return}
  const name=$("goalName").value.trim(),target=Math.round(+$("goalTarget").value||0);
  if(!name||target<=0){$("goalMsg").textContent="請填目標名稱和金額";return}
  try{await DB.doc(`households/${hid}`).update({goal:{name,target,by:myName(),updatedAt:Date.now()}});$("goalMsg").textContent="已儲存，全家首頁都看得到"}catch(e){$("goalMsg").textContent="儲存失敗，請稍後再試"}
};
let goalDelArmed=false;
$("goalDel").onclick=async()=>{
  if(!goalDelArmed){goalDelArmed=true;$("goalDel").textContent="確定刪除？";return}
  goalDelArmed=false;$("goalDel").textContent="刪除目標";
  try{await DB.doc(`households/${hid}`).update({goal:null});$("goalMsg").textContent="已刪除"}catch(e){$("goalMsg").textContent="刪除失敗"}
};

// ---- feedback (write-only; read in the Firebase console) ----
let fbRating=0;
function renderStars(){
  const box=$("fbStars");box.innerHTML="";
  for(let i=1;i<=5;i++){const b=document.createElement("button");b.type="button";b.textContent="★";b.className=i<=fbRating?"on":"";b.setAttribute("role","radio");b.setAttribute("aria-checked",String(i===fbRating));b.setAttribute("aria-label",i+" 顆星");
    b.onclick=()=>{fbRating=fbRating===i?0:i;renderStars()};box.appendChild(b)}
}
function openFeedback(){renderStars()}
$("fbSend").onclick=async()=>{
  const text=$("fbText").value.trim().slice(0,2000);
  if(!text&&!fbRating){$("fbMsg").textContent="請給個星星或寫幾句話";return}
  $("fbSend").disabled=true;
  try{await DB.collection("feedback").add({uid:myId,rating:fbRating,text,date:today(),ts:Date.now()});$("fbText").value="";fbRating=0;renderStars();$("fbMsg").textContent="謝謝你的回饋！"}
  catch(e){$("fbMsg").textContent="送出失敗，請稍後再試"}
  $("fbSend").disabled=false;
};

// ---- generic form sheet ----
let fsCfg=null,fsDelArmed=false;
function openForm(cfg){
  fsCfg=cfg;fsDelArmed=false;$("fsTitle").textContent=cfg.title;$("fsSave").textContent=cfg.okLabel||"儲存";$("fsMsg").textContent="";
  $("fsSub").hidden=!cfg.sub;$("fsSub").textContent=cfg.sub||"";
  const box=$("fsFields");box.innerHTML="";
  cfg.fields.forEach(f=>{
    const l=document.createElement("label");if(f.full)l.className="full";l.append(document.createTextNode(f.label));
    let inp;
    if(f.options){inp=document.createElement("select");f.options.forEach(([v,t])=>{const o=document.createElement("option");o.value=v;o.textContent=t;inp.appendChild(o)})}
    else{inp=document.createElement("input");inp.type=f.type||"text";if(f.type==="number"){inp.min="0";inp.inputMode="numeric"}if(f.placeholder)inp.placeholder=f.placeholder}
    inp.id="fs_"+f.key;inp.value=f.value==null?"":f.value;
    if(f.list){const dl=document.createElement("datalist");dl.id="dl_"+f.key;f.list.forEach(v=>{const o=document.createElement("option");o.value=v;dl.appendChild(o)});inp.setAttribute("list",dl.id);l.appendChild(dl)}
    l.appendChild(inp);box.appendChild(l);
  });
  $("fsDel").hidden=!cfg.onDelete;$("fsDel").textContent="刪除";
  $("sheetBg").hidden=false;$("fsheet").hidden=false;
}
function closeForm(){fsCfg=null;$("fsheet").hidden=true;if($("sheet").hidden&&$("csheet").hidden)$("sheetBg").hidden=true}
const fv=k=>{const e=$("fs_"+k);return e?e.value.trim():""};
$("fsCancel").onclick=closeForm;
$("fsSave").onclick=async()=>{
  if(!fsCfg)return;const r=fsCfg.validate?fsCfg.validate():"";if(r){$("fsMsg").textContent=r;return}
  $("fsSave").disabled=true;try{await fsCfg.onSave();closeForm()}catch(e){$("fsMsg").textContent="儲存失敗，請稍後再試"}$("fsSave").disabled=false;
};
$("fsDel").onclick=async()=>{
  if(!fsCfg||!fsCfg.onDelete)return;
  if(!fsDelArmed){fsDelArmed=true;$("fsDel").textContent="確定刪除？";return}
  try{await fsCfg.onDelete();closeForm()}catch(e){$("fsMsg").textContent="刪除失敗"}
};
function editAllowance(){
  if(!canWrite||!base)return;const [y,m]=cur.split("-").map(Number);
  openForm({title:`${y} 年 ${m} 月的額度`,sub:"這個月的零用錢或預算，會用來算結餘和累計結餘。",fields:[{key:"a",label:"金額",type:"number",value:allowanceOf(cur),full:true}],
    validate:()=>fv("a")===""?"請輸入金額":"",onSave:()=>base.update({allowance:{[cur]:Math.max(0,Math.round(+fv("a")||0))}})});
}

// ---- coupons (separate from monthly money) ----
function wallets(){
  const w={};
  coupons.forEach(c=>{const k=c.store||"優惠券";(w[k]=w[k]||{store:k,added:0,used:0,logs:[]});if(c.type==="add")w[k].added+=(+c.amount||0);else w[k].used+=(+c.amount||0);w[k].logs.push(c)});
  return Object.values(w).map(x=>({...x,balance:x.added-x.used,logs:x.logs.sort((a,b)=>String(b.date).localeCompare(String(a.date))||(b.ts||0)-(a.ts||0))})).sort((a,b)=>b.balance-a.balance);
}
let cpOpen=null;
function renderCoupons(){
  const c=$("cpCard");if(!c)return;c.hidden=false;c.innerHTML="";
  const h=document.createElement("div");h.className="lhead";const t=document.createElement("h2");t.textContent="優惠券";h.appendChild(t);
  if(canWrite){const a=document.createElement("button");a.type="button";a.className="ghost sm";a.textContent="＋ 新增";a.onclick=()=>addCoupon("");h.appendChild(a)}
  c.appendChild(h);
  const ws=wallets();
  if(!ws.length){const p=document.createElement("p");p.className="sub";p.style.margin="0";p.textContent="禮券、折價券可以記在這裡。用券付的錢從券裡扣，不算進每月收支。";c.appendChild(p);return}
  ws.forEach(w=>{
    const row=document.createElement("div");row.className="cpw";
    const top=document.createElement("div");top.className="top";
    const nm=document.createElement("button");nm.type="button";nm.className="nm";nm.textContent=w.store;nm.setAttribute("aria-expanded",String(cpOpen===w.store));nm.onclick=()=>{cpOpen=cpOpen===w.store?null:w.store;renderCoupons()};
    const right=document.createElement("span");right.style.cssText="display:flex;gap:6px;align-items:center";
    const bal=document.createElement("b");bal.textContent="剩 "+fmt(w.balance);bal.style.fontVariantNumeric="tabular-nums";right.appendChild(bal);
    if(canWrite&&w.balance>0){const u=document.createElement("button");u.type="button";u.className="ghost sm";u.textContent="使用";u.onclick=()=>useCoupon(w.store);right.appendChild(u)}
    top.append(nm,right);
    const bar=document.createElement("div");bar.className="gbar";const fill=document.createElement("i");fill.style.width=(w.added?Math.max(0,Math.min(100,w.balance/w.added*100)):0)+"%";bar.appendChild(fill);
    const meta=document.createElement("div");meta.className="meta";meta.textContent=`共 ${fmt(w.added)}・已用 ${fmt(w.used)}`+(cpOpen===w.store?"":"　點店名看紀錄");
    row.append(top,bar,meta);
    if(cpOpen===w.store){
      const lg=document.createElement("div");lg.className="cplog";
      w.logs.forEach(x=>{const r=document.createElement("div");r.className="rc";const s1=document.createElement("span");
        s1.textContent=`${String(x.date||"").slice(5).replace("-","/")}　${x.type==="add"?("新增"+(x.count>1?` ${fmt(x.face)}×${x.count}`:"")):(x.note||"使用")}`;
        const s2=document.createElement("span");s2.textContent=(x.type==="add"?"+":"−")+fmt(x.amount);s2.className=x.type==="add"?"pos":"";
        r.append(s1,s2);if(canWrite){r.style.cursor="pointer";r.onclick=()=>editCouponLog(x)}lg.appendChild(r)});
      if(canWrite){const hint=document.createElement("div");hint.className="meta";hint.style.marginTop="4px";hint.textContent="點一筆可以修改或刪除";lg.appendChild(hint)}
      row.appendChild(lg);
    }
    c.appendChild(row);
  });
}
function addCoupon(store){
  openForm({title:"新增優惠券",sub:"例如全聯禮券 500 元 3 張，就填面額 500、張數 3。",fields:[
    {key:"store",label:"店家／名稱",value:store,placeholder:"例如 全聯",list:wallets().map(w=>w.store),full:true},
    {key:"face",label:"面額",type:"number",placeholder:"500"},{key:"count",label:"張數",type:"number",value:1},
    {key:"date",label:"日期",type:"date",value:today()},{key:"note",label:"備註",placeholder:"可空，例如 生日禮物"}],
    validate:()=>!fv("store")?"請填店家":(+fv("face")>0&&+fv("count")>0?"":"請填面額和張數"),
    onSave:()=>{const face=Math.round(+fv("face")),count=Math.round(+fv("count")),d=fv("date")||today();return cpCol.add({...byFields(),store:fv("store"),type:"add",face,count,amount:face*count,date:d,month:d.slice(0,7),note:fv("note"),ts:Date.now()})}});
}
function useCoupon(store){
  const w=wallets().find(x=>x.store===store),bal=w?w.balance:0;
  openForm({title:`使用${store}優惠券`,sub:`目前剩 ${fmt(bal)}。這筆從券裡扣，不算進每月支出。`,fields:[
    {key:"amount",label:"金額",type:"number"},{key:"date",label:"日期",type:"date",value:today()},{key:"note",label:"買了什麼",placeholder:"例如 日用品",full:true}],
    validate:()=>{const a=Math.round(+fv("amount")||0);return a<=0?"請輸入金額":(a>bal?`超過餘額（剩 ${fmt(bal)}）`:"")},
    onSave:()=>{const d=fv("date")||today();return cpCol.add({...byFields(),store,type:"use",amount:Math.round(+fv("amount")),date:d,month:d.slice(0,7),note:fv("note"),ts:Date.now()})}});
}
function editCouponLog(x){
  const isAdd=x.type==="add";
  const fields=isAdd?[{key:"face",label:"面額",type:"number",value:x.face||x.amount},{key:"count",label:"張數",type:"number",value:x.count||1},{key:"date",label:"日期",type:"date",value:x.date},{key:"note",label:"備註",value:x.note||""}]
    :[{key:"amount",label:"金額",type:"number",value:x.amount},{key:"date",label:"日期",type:"date",value:x.date},{key:"note",label:"買了什麼",value:x.note||"",full:true}];
  openForm({title:(isAdd?"修改新增的":"修改使用的")+x.store+"優惠券",fields,
    validate:()=>isAdd?(+fv("face")>0&&+fv("count")>0?"":"請填面額和張數"):(+fv("amount")>0?"":"請輸入金額"),
    onSave:()=>{const d=fv("date")||x.date;if(isAdd){const face=Math.round(+fv("face")),count=Math.round(+fv("count"));return cpCol.doc(x.id).update({face,count,amount:face*count,date:d,month:d.slice(0,7),note:fv("note")})}
      return cpCol.doc(x.id).update({amount:Math.round(+fv("amount")),date:d,month:d.slice(0,7),note:fv("note")})},
    onDelete:()=>cpCol.doc(x.id).delete()});
}

// ---- photo → entries ----
const S2T=(()=>{const p="联聯优優礼禮价價张張买買卖賣乐樂华華发發电電点點东東门門书書饭飯鸡雞汤湯面麵车車风風广廣场場万萬爱愛时時网網购購号號们們鲜鮮农農银銀无無尔爾来來丽麗宁寧兴興国國际際达達汉漢龙龍凤鳳云雲丰豐园園圆圓统統杂雜项項补補贴貼务務业業艺藝术術馆館宝寶贝貝灯燈药藥医醫学學习習体體养養鱼魚虾蝦猪豬卤滷咸鹹酱醬饮飲记記账帳钱錢两兩劵券惠惠";const m={};for(let k=0;k<p.length;k+=2)m[p[k]]=p[k+1];return m})();
const toT=x=>String(x||"").replace(/./g,c=>S2T[c]||c);
const CPW=/優惠券|禮券|折價券|商品券|提貨券|抵用券|現金券|禮物卡|點數卡|券/g;
function matchWallet(name){
  const n=toT(name).replace(CPW,"").replace(/\s/g,"");if(!n)return"";
  const ws=wallets().map(w=>w.store);
  return ws.find(w=>toT(w)===n)||ws.find(w=>n.includes(toT(w))||toT(w).includes(n))||n;
}
const MEALRE=/早午餐|下午茶|宵夜|消夜|早餐|午餐|晚餐|早飯|午飯|晚飯|早饭|午饭|晚饭/g;
const MEALN={"早飯":"早餐","午飯":"午餐","晚飯":"晚餐","早饭":"早餐","午饭":"午餐","晚饭":"晚餐","消夜":"宵夜"};
function splitMeal(note,remark){
  const found=[];let n=String(note||"").replace(MEALRE,m=>{found.push(MEALN[m]||m);return" "});
  n=n.replace(/\s+/g," ").replace(/^[\s,，、。的吃]+|[\s,，、。的吃]+$/g,"").trim();
  if(/^(店|館|屋|坊|吧)$/.test(n))n=String(note||"").trim();
  let r=String(remark||"").trim();
  found.reverse().forEach(m=>{if(!r.includes(m))r=r?m+"・"+r:m});
  return[n,r,found.length>0];
}
function normItems(arr){
  const ok=new Set(cats().map(c=>c.name));
  return(arr||[]).map(a=>{
    let cat=String(a.category||"");const note=String(a.note||""),remark=String(a.remark||"");
    let face=Math.round(+a.face||0),count=Math.round(+a.count||0);
    if(/^(coupon|cpadd):/.test(cat)){const kind=cat.slice(0,cat.indexOf(":"));cat=kind+":"+matchWallet(cat.slice(kind.length+1)||note)}
    else if(!ok.has(cat))cat=guess(note+" "+remark);
    let amount=Math.round(+a.amount)||0;
    if(cat.startsWith("cpadd:")){if(!count)count=1;if(!face)face=amount&&count?Math.round(amount/count):0;if(!amount)amount=face*count}
    let nNote=note,nRem=remark;
    if(!cat.startsWith("cpadd:")){const sm=splitMeal(note,remark);nNote=sm[0];nRem=sm[1];
      if(sm[2]&&!/^(coupon|cpadd):/.test(cat)&&["杂项","雜項","其他"].includes(cat)){const f=cats().find(c=>/食物|餐飲|餐饮/.test(c.name));if(f)cat=f.name}}
    const note2=nNote,remark2=nRem;
    return{category:cat,amount,face,count,note:note2,remark:remark2,date:/^\d{4}-\d{2}-\d{2}$/.test(a.date||"")?a.date:($("vdate").value||today())}
  }).filter(a=>a.amount>0);
}
$("photoBtn").onclick=()=>{$("photoTip").hidden=!$("photoTip").hidden;$("vmsg").textContent=""};
$("photoTipClose").onclick=()=>{$("photoTip").hidden=true};

// ---- export ----
function csvOf(month){
  const q=v=>{const t=String(v==null?"":v);return/[",\n]/.test(t)?'"'+t.replace(/"/g,'""')+'"':t};
  const rows=[["日期","類型","類別","描述","備註","金額"]];
  const ex=expenses.filter(e=>!month||e.month===month).map(e=>[e.date,"支出",e.category,e.note||"",e.remark||"",e.amount]);
  const inc=incomes.filter(i=>!month||i.month===month).map(i=>[i.date,"收入","",i.note||"","",i.amount]);
  const cp=coupons.filter(c=>!month||c.month===month).map(c=>[c.date,c.type==="add"?"優惠券新增":"優惠券使用",c.store,c.note||"","",c.amount]);
  ex.concat(inc,cp).sort((a,b)=>String(a[0]).localeCompare(String(b[0]))).forEach(r=>rows.push(r));
  return"﻿"+rows.map(r=>r.map(q).join(",")).join("\r\n");
}
function saveFile(name,data,type){
  const b=data instanceof Blob?data:new Blob([data],{type:type||"application/octet-stream"}),u=URL.createObjectURL(b),a=document.createElement("a");
  a.href=u;a.download=name;a.rel="noopener";document.body.appendChild(a);a.click();setTimeout(()=>{URL.revokeObjectURL(u);a.remove()},4000);
}
function doExport(month){
  const m=$("expMsg");
  try{saveFile(`ledger-${curKey==="fam"?"family":"me"}-${month||"all"}.csv`,csvOf(month),"text/csv;charset=utf-8");m.textContent="已下載"}catch(e){m.textContent="下載失敗，請稍後再試"}
}
$("expMonth").onclick=()=>doExport(today().slice(0,7));
$("expAll").onclick=()=>doExport("");

// ---- backup / restore (JSON) ----
async function buildBackup(){
  const ph=[];
  for(const e of expenses)for(const p of phOf(e)){try{const sn=await phCol.doc(p.id).get();if(sn.exists)ph.push({id:p.id,...sn.data()})}catch(err){}}
  return{app:"family-ledger",version:1,exportedAt:new Date().toISOString(),kind:curKey,ledger:settings||{},
    expenses:expenses.map(e=>({...e})),incomes:incomes.map(e=>({...e})),coupons:coupons.map(e=>({...e})),photos:ph,
    ...(curKey==="me"?{bdays:bdays.slice(),prefs:{bg:(curPrefs&&curPrefs.bg)||""}}:{}),...(goal?{goal:{name:goal.name,target:goal.target}}:{})};
}
$("bkExport").onclick=async()=>{
  const m=$("bkMsg");m.textContent="準備中…";$("bkExport").disabled=true;
  try{const b=await buildBackup();saveFile(`family-ledger-backup-${today()}.json`,JSON.stringify(b),"application/json");m.textContent="已下載備份檔"}
  catch(e){m.textContent="備份失敗，請稍後再試"}
  $("bkExport").disabled=false;
};
let bkPending=null;
$("bkImport").onclick=()=>$("bkFile").click();
$("bkFile").onchange=async e=>{
  const f=e.target.files&&e.target.files[0];e.target.value="";if(!f)return;
  const box=$("bkConfirm"),m=$("bkMsg");box.innerHTML="";box.hidden=true;bkPending=null;
  let obj=null;try{obj=JSON.parse(await f.text())}catch(err){}
  if(!obj||obj.app!=="family-ledger"){m.textContent="這不是家庭記帳本的備份檔";return}
  bkPending=obj;m.textContent="";
  const n=k=>(obj[k]||[]).length;
  const p=document.createElement("p");p.className="sub";p.style.margin="0 0 8px";
  p.textContent=`備份裡有 ${n("expenses")} 筆支出、${n("incomes")} 筆收入、${n("coupons")} 筆優惠券紀錄、${n("photos")} 張照片`+(obj.bdays?`、${obj.bdays.length} 位生日`:"")+`。要匯入「${curKey==="fam"?"全家的帳":"我的帳"}」嗎？已經有的同一筆不會重複。`;
  const row=document.createElement("div");row.className="bt";
  const ok=document.createElement("button");ok.type="button";ok.textContent="匯入";
  const no=document.createElement("button");no.type="button";no.className="ghost";no.textContent="取消";
  no.onclick=()=>{bkPending=null;box.hidden=true};
  ok.onclick=async()=>{ok.disabled=true;no.disabled=true;try{await importBackup(bkPending);box.hidden=true}catch(err){m.textContent=saveErr(err,"匯入失敗，請稍後再試")}ok.disabled=false;no.disabled=false};
  row.append(ok,no);box.append(p,row);box.hidden=false;
};
async function importBackup(obj){
  const msg=t=>{$("bkMsg").textContent=t};
  const strip=o=>{const r={...o};delete r.id;return r};
  const L=obj.ledger||{};
  if(!settings)await base.set({...L,share:"none"});
  else{const cs=cats().slice();(L.categories||[]).forEach(c=>{if(c&&c.name&&!cs.some(x=>x.name===c.name))cs.push(c)});
    await base.set({...settings,categories:cs,allowance:{...(L.allowance||{}),...(settings.allowance||{})},recurring:settings.recurring||L.recurring||[]})}
  const groups=[["expenses",col],["incomes",incCol],["coupons",cpCol]],photos=(obj.photos||[]).filter(p=>p&&p.id&&p.full);
  const total=groups.reduce((t,[k])=>t+(obj[k]||[]).length,0)+photos.length;let done=0;
  for(const[k,c]of groups){
    const arr=(obj[k]||[]).filter(x=>x&&x.id);
    for(let i=0;i<arr.length;i+=300){const b=DB.batch();arr.slice(i,i+300).forEach(x=>b.set(c.doc(String(x.id)),strip(x)));await b.commit();done+=Math.min(300,arr.length-i);msg(`匯入中… ${done} / ${total}`)}
  }
  for(const p of photos){await phCol.doc(String(p.id)).set(strip(p));done++;msg(`匯入中… ${done} / ${total}`)}
  if(curKey==="me"){
    if(Array.isArray(obj.bdays)&&obj.bdays.length){const mp=new Map(bdays.map(b=>[b.id,b]));obj.bdays.forEach(b=>{if(b&&b.id&&!mp.has(b.id))mp.set(b.id,b)});await bdRef.set({list:[...mp.values()]})}
    if(obj.prefs&&obj.prefs.bg&&!(curPrefs&&curPrefs.bg))await prefsRef.set({bg:obj.prefs.bg},{merge:true});
  }
  if(obj.goal&&obj.goal.name&&hid&&!goal)await DB.doc(`households/${hid}`).update({goal:{name:obj.goal.name,target:+obj.goal.target||0,by:myName(),updatedAt:Date.now()}});
  msg(`匯入完成 ✅ 共 ${done} 筆`);
}

// ---- daily reminder: a calendar file with a daily alarm ----
function icsText(time){
  const [h,m]=String(time||"21:00").split(":").map(Number),p=n=>String(n).padStart(2,"0"),d=today().replace(/-/g,"");
  const st=new Date().toISOString().replace(/[-:]/g,"").replace(/\.\d+Z$/,"Z");
  return["BEGIN:VCALENDAR","VERSION:2.0","PRODID:-//family-ledger//zh-TW","CALSCALE:GREGORIAN","METHOD:PUBLISH",
    "BEGIN:VTIMEZONE","TZID:Asia/Taipei","BEGIN:STANDARD","DTSTART:19700101T000000","TZOFFSETFROM:+0800","TZOFFSETTO:+0800","TZNAME:CST","END:STANDARD","END:VTIMEZONE",
    "BEGIN:VEVENT","UID:ledger-"+Date.now().toString(36)+"@family-ledger","DTSTAMP:"+st,`DTSTART;TZID=Asia/Taipei:${d}T${p(h||0)}${p(m||0)}00`,"DURATION:PT10M","RRULE:FREQ=DAILY",
    "SUMMARY:記帳時間 💸","DESCRIPTION:打開家庭記帳本，記下今天的花費："+SITE_URL,"URL:"+SITE_URL,
    "BEGIN:VALARM","ACTION:DISPLAY","DESCRIPTION:記帳時間 💸","TRIGGER:PT0M","END:VALARM","END:VEVENT","END:VCALENDAR"].join("\r\n")+"\r\n";
}
function downloadICS(time){saveFile("ledger-reminder.ics",icsText(time),"text/calendar;charset=utf-8");if(prefsRef)prefsRef.set({remindTime:time},{merge:true}).catch(()=>{})}
function renderReminder(){
  const body=$("remindBody");if(!body)return;body.innerHTML="";
  const last=curPrefs&&curPrefs.remindTime;
  const p=document.createElement("p");p.className="sub";p.style.margin="0 0 10px";
  p.textContent="選一個時間，按「下載行事曆提醒」。iPhone 打開檔案後按「加入」；Android 用 Google 日曆打開。之後每天時間到，手機行事曆就會提醒你記帳。";
  const row=document.createElement("div");row.className="bt";
  const ti=document.createElement("input");ti.type="time";ti.value=last||"21:00";
  const b=document.createElement("button");b.type="button";b.textContent="下載行事曆提醒";
  b.onclick=()=>{downloadICS(ti.value||"21:00");$("remindMsg").textContent="已下載，打開檔案加入行事曆就好了"};
  row.append(ti,b);body.append(p,row);
  if(last){const q=document.createElement("p");q.className="sub";q.style.margin="10px 0 0";q.textContent=`上次設定：每天 ${last}。要改時間，先到手機行事曆刪掉舊的「記帳時間」，再下載新的。`;body.appendChild(q)}
}

// ---- look: background + daily quote ----
function renderLook(){$("quoteOn").checked=quoteOn()}
$("quoteOn").onchange=async e=>{try{await prefsRef.set({quote:e.target.checked},{merge:true})}catch(err){}};
$("bgFile").onchange=async e=>{
  const f=e.target.files&&e.target.files[0];if(!f||!prefsRef)return;
  $("bgMsg").textContent="處理中…";
  try{const url=await shrink(f);await prefsRef.set({bg:url},{merge:true});$("bgMsg").textContent="已換好 ✅"}
  catch(err){$("bgMsg").textContent="換背景失敗，請換一張照片試試"}
  e.target.value="";
};
$("bgClear").onclick=async()=>{if(!prefsRef)return;try{await prefsRef.set({bg:""},{merge:true});$("bgMsg").textContent="已清除"}catch(e){}};

// ---- music (original, generated in the browser) ----
const MOODS=[
  {name:"午後散步",bpm:76,root:60,wave:"triangle",scale:[0,2,4,7,9],prog:[[0,4,7,11],[-3,0,4,7],[-7,-3,0,4],[-5,-1,2,5]]},
  {name:"雨天窗邊",bpm:60,root:57,wave:"sine",scale:[0,3,5,7,10],prog:[[0,3,7,10],[-4,0,3,7],[3,7,10,14],[-2,2,5,10]]},
  {name:"星空晚安",bpm:52,root:55,wave:"sine",scale:[0,2,4,7,9],prog:[[0,4,7,11],[5,9,12,16],[-3,0,4,7],[2,6,9,12]]}
];
let AC=null,mOut=null,mIn=null,mTimer=null,mPlaying=false,mIdx=0,nextT=0,stepN=0;
const mf=m=>440*Math.pow(2,(m-69)/12);
function mInit(){
  AC=new (window.AudioContext||window.webkitAudioContext)();
  mOut=AC.createGain();mOut.gain.value=+$("mVol").value;
  mIn=AC.createBiquadFilter();mIn.type="lowpass";mIn.frequency.value=2600;
  const conv=AC.createConvolver(),len=Math.floor(AC.sampleRate*2.8),buf=AC.createBuffer(2,len,AC.sampleRate);
  for(let c=0;c<2;c++){const d=buf.getChannelData(c);for(let i=0;i<len;i++)d[i]=(Math.random()*2-1)*Math.pow(1-i/len,2.6)}
  conv.buffer=buf;const wet=AC.createGain();wet.gain.value=.4;
  mIn.connect(mOut);mIn.connect(conv);conv.connect(wet);wet.connect(mOut);mOut.connect(AC.destination);
}
function mNote(m,t,dur,vel,wave){
  const o=AC.createOscillator(),o2=AC.createOscillator(),g=AC.createGain(),g2=AC.createGain();
  o.type=wave;o.frequency.value=mf(m);o2.type="sine";o2.frequency.value=mf(m+12);g2.gain.value=.15;
  o.connect(g);o2.connect(g2);g2.connect(g);g.connect(mIn);
  g.gain.setValueAtTime(0,t);g.gain.linearRampToValueAtTime(vel,t+.02);g.gain.exponentialRampToValueAtTime(.0005,t+dur);
  o.start(t);o2.start(t);o.stop(t+dur+.05);o2.stop(t+dur+.05);
}
function mSchedule(){
  const M=MOODS[mIdx],e8=60/M.bpm/2,pat=[0,1,2,3,2,1,2,1];
  while(nextT<AC.currentTime+.5){
    const bar=Math.floor(stepN/8)%M.prog.length,pos=stepN%8,ch=M.prog[bar];
    if(pos===0)ch.forEach(iv=>mNote(M.root-12+iv,nextT,e8*9,.035,"sine"));
    mNote(M.root+ch[pat[pos]],nextT,1.8,.08,M.wave);
    if(pos%2===0&&Math.random()<.3){const sc=M.scale;mNote(M.root+12+sc[Math.floor(Math.random()*sc.length)],nextT+.01,2.4,.055,"sine")}
    nextT+=e8*(1+(Math.random()-.5)*.05);stepN++;
  }
}
let mSilent=null;
function silentWav(){
  const n=4000,b=new ArrayBuffer(44+n),v=new DataView(b),w=(o,t)=>{for(let k=0;k<t.length;k++)v.setUint8(o+k,t.charCodeAt(k))};
  w(0,"RIFF");v.setUint32(4,36+n,true);w(8,"WAVE");w(12,"fmt ");v.setUint32(16,16,true);v.setUint16(20,1,true);v.setUint16(22,1,true);
  v.setUint32(24,8000,true);v.setUint32(28,8000,true);v.setUint16(32,1,true);v.setUint16(34,8,true);w(36,"data");v.setUint32(40,n,true);
  for(let k=0;k<n;k++)v.setUint8(44+k,128);
  let bin="";const u8=new Uint8Array(b);for(let k=0;k<u8.length;k++)bin+=String.fromCharCode(u8[k]);return "data:audio/wav;base64,"+btoa(bin);
}
function mUI(){
  $("mAsk").hidden=mPlaying;$("mCtl").hidden=!mPlaying;
  $("mQ").textContent=mPlaying?"正在播放："+MOODS[mIdx].name:"要播放輕音樂嗎？";
  $("musicBtn").classList.toggle("on",mPlaying);
}
function mPlay(){
  try{
    if(navigator.audioSession)try{navigator.audioSession.type="playback"}catch(e){}
    if(!mSilent){mSilent=new Audio(silentWav());mSilent.loop=true}
    const pr=mSilent.play();if(pr&&pr.catch)pr.catch(()=>{});
    if(!AC)mInit();AC.resume();nextT=AC.currentTime+.1;stepN=0;clearInterval(mTimer);
    mTimer=setInterval(()=>{mSchedule();if(stepN>=8*40){mIdx=(mIdx+1)%MOODS.length;stepN=0;mUI()}},100);mPlaying=true;
  }catch(e){$("mQ").textContent="這台裝置沒辦法播放"}
  mUI();
}
function mStop(){clearInterval(mTimer);mPlaying=false;if(AC)AC.suspend();if(mSilent)mSilent.pause();mUI()}
$("musicBtn").onclick=()=>{$("musicPop").hidden=!$("musicPop").hidden;mUI()};
$("mYes").onclick=()=>mPlay();
$("mNo").onclick=()=>{$("musicPop").hidden=true};
$("mClose").onclick=()=>{mStop();$("musicPop").hidden=true};
$("mStopBtn").onclick=()=>mStop();
$("mNext").onclick=()=>{mIdx=(mIdx+1)%MOODS.length;stepN=0;if(AC)nextT=AC.currentTime+.15;mUI()};
$("mVol").oninput=e=>{if(mOut)mOut.gain.value=+e.target.value};


// ---- calendar: 國曆 + 農曆 ----
const LINFO=[0x04bd8,0x04ae0,0x0a570,0x054d5,0x0d260,0x0d950,0x16554,0x056a0,0x09ad0,0x055d2,0x04ae0,0x0a5b6,0x0a4d0,0x0d250,0x1d255,0x0b540,0x0d6a0,0x0ada2,0x095b0,0x14977,0x04970,0x0a4b0,0x0b4b5,0x06a50,0x06d40,0x1ab54,0x02b60,0x09570,0x052f2,0x04970,0x06566,0x0d4a0,0x0ea50,0x16a95,0x05ad0,0x02b60,0x186e3,0x092e0,0x1c8d7,0x0c950,0x0d4a0,0x1d8a6,0x0b550,0x056a0,0x1a5b4,0x025d0,0x092d0,0x0d2b2,0x0a950,0x0b557,0x06ca0,0x0b550,0x15355,0x04da0,0x0a5b0,0x14573,0x052b0,0x0a9a8,0x0e950,0x06aa0,0x0aea6,0x0ab50,0x04b60,0x0aae4,0x0a570,0x05260,0x0f263,0x0d950,0x05b57,0x056a0,0x096d0,0x04dd5,0x04ad0,0x0a4d0,0x0d4d4,0x0d250,0x0d558,0x0b540,0x0b6a0,0x195a6,0x095b0,0x049b0,0x0a974,0x0a4b0,0x0b27a,0x06a50,0x06d40,0x0af46,0x0ab60,0x09570,0x04af5,0x04970,0x064b0,0x074a3,0x0ea50,0x06b58,0x05ac0,0x0ab60,0x096d5,0x092e0,0x0c960,0x0d954,0x0d4a0,0x0da50,0x07552,0x056a0,0x0abb7,0x025d0,0x092d0,0x0cab5,0x0a950,0x0b4a0,0x0baa4,0x0ad50,0x055d9,0x04ba0,0x0a5b0,0x15176,0x052b0,0x0a930,0x07954,0x06aa0,0x0ad50,0x05b52,0x04b60,0x0a6e6,0x0a4e0,0x0d260,0x0ea65,0x0d530,0x05aa0,0x076a3,0x096d0,0x04afb,0x04ad0,0x0a4d0,0x1d0b6,0x0d250,0x0d520,0x0dd45];
const lLeap=y=>LINFO[y-1900]&0xf,lLeapDays=y=>lLeap(y)?(LINFO[y-1900]&0x10000?30:29):0,lMonDays=(y,m)=>LINFO[y-1900]&(0x10000>>m)?30:29;
const lYearDays=y=>{let s=lLeapDays(y);for(let m=1;m<=12;m++)s+=lMonDays(y,m);return s};
const LBASE=Date.UTC(1900,0,31);
function toLunar(y,m,d){
  let off=Math.round((Date.UTC(y,m-1,d)-LBASE)/864e5),ly=1900;
  if(off<0)return null;
  while(ly<2040&&off>=lYearDays(ly)){off-=lYearDays(ly);ly++}
  if(ly>=2040)return null;
  let lm=1,leap=false;const lp=lLeap(ly);
  while(true){const md=lMonDays(ly,lm);if(off<md)break;off-=md;
    if(lm===lp){if(off<lLeapDays(ly)){leap=true;break}off-=lLeapDays(ly)}lm++}
  return{y:ly,m:lm,d:off+1,leap,monLen:leap?lLeapDays(ly):lMonDays(ly,lm)};
}
const LMN=["正","二","三","四","五","六","七","八","九","十","十一","十二"];
const lMonName=l=>(l.leap?"閏":"")+LMN[l.m-1]+"月";
const lDayName=d=>d===10?"初十":d===20?"二十":d===30?"三十":(["初","十","廿","三"][Math.floor((d-1)/10)]+"一二三四五六七八九十"[(d-1)%10]);
const GAN="甲乙丙丁戊己庚辛壬癸",ZHI="子丑寅卯辰巳午未申酉戌亥",SX="鼠牛虎兔龍蛇馬羊猴雞狗豬";
const ganzhi=y=>GAN[(y-4)%10]+ZHI[(y-4)%12]+"年",shengxiao=y=>SX[(y-4)%12];
const TERMS=[["小寒",5.4055],["大寒",20.12],["立春",3.87],["雨水",18.73],["驚蟄",5.63],["春分",20.646],["清明",4.81],["穀雨",20.1],["立夏",5.52],["小滿",21.04],["芒種",5.678],["夏至",21.37],["小暑",7.108],["大暑",22.83],["立秋",7.5],["處暑",23.13],["白露",7.646],["秋分",23.042],["寒露",8.318],["霜降",23.438],["立冬",7.438],["小雪",22.36],["大雪",7.18],["冬至",21.94]];
const TEXC={"2019-0":-1,"2082-1":1,"2026-3":-1,"2084-5":1,"2008-9":1,"2016-12":1,"2002-14":1,"2089-19":1,"2089-20":1,"2021-23":-1};
function termOn(y,m,d){
  if(y<2001||y>2099)return"";const Y=y%100;
  for(const i of[(m-1)*2,(m-1)*2+1]){const L=i<4?Math.floor((Y-1)/4):Math.floor(Y/4);
    if(Math.floor(Y*0.2422+TERMS[i][1])-L+(TEXC[y+"-"+i]||0)===d)return TERMS[i][0]}
  return"";
}
const SFEST={"1-1":"元旦","2-14":"情人節","2-28":"和平紀念日","3-8":"婦女節","3-12":"植樹節","4-4":"兒童節","5-1":"勞動節","8-8":"父親節","9-28":"教師節","10-10":"國慶日","10-25":"光復節","12-25":"聖誕節"};
const LFEST={"1-1":"春節","1-15":"元宵節","2-2":"土地公生","5-5":"端午節","7-7":"七夕","7-15":"中元節","8-15":"中秋節","9-9":"重陽節","12-8":"臘八","12-16":"尾牙"};
function dayInfo(y,m,d){
  const l=toLunar(y,m,d),fest=[];
  if(SFEST[m+"-"+d])fest.push(SFEST[m+"-"+d]);
  if(m===5&&new Date(Date.UTC(y,4,d)).getUTCDay()===0&&d>7&&d<=14)fest.push("母親節");
  if(l&&!l.leap){if(LFEST[l.m+"-"+l.d])fest.push(LFEST[l.m+"-"+l.d]);if(l.m===12&&l.d===l.monLen)fest.push("除夕")}
  return{l,term:termOn(y,m,d),fest};
}

// ---- birthdays ----
const LCUM=(()=>{const a=[0];for(let y=1900;y<2040;y++)a.push(a[a.length-1]+lYearDays(y));return a})();
function lunarToSolar(ly,lm,ld){
  if(ly<1900||ly>2039)return null;let off=LCUM[ly-1900];
  for(let m=1;m<lm;m++){off+=lMonDays(ly,m);if(m===lLeap(ly))off+=lLeapDays(ly)}
  return new Date(LBASE+(off+Math.min(ld,lMonDays(ly,lm))-1)*864e5);
}
const isoD=dt=>dt.toISOString().slice(0,10);
const GRPS=["家人","朋友","同學","其他"];
function bdayOcc(b,from,to){
  const out=[],y0=from.getUTCFullYear()-1,y1=to.getUTCFullYear()+1;
  if(b.s&&b.s[1]){for(let y=y0;y<=y1;y++){let d=b.s[1];if(b.s[0]===2&&d===29&&new Date(Date.UTC(y,1,29)).getUTCMonth()!==1)d=28;
    const dt=new Date(Date.UTC(y,b.s[0]-1,d));if(dt>=from&&dt<=to)out.push({date:isoD(dt),kind:"國曆",age:b.y?y-b.y:0})}}
  if(b.l&&b.l[1]){for(let y=y0-1;y<=y1;y++){const dt=lunarToSolar(y,b.l[0],b.l[1]);if(dt&&dt>=from&&dt<=to)out.push({date:isoD(dt),kind:"農曆",age:0})}}
  if(b.s&&!b.s[1]){for(let y=y0;y<=y1;y++){const dt=new Date(Date.UTC(y,b.s[0]-1,1));if(dt>=from&&dt<=to)out.push({date:isoD(dt),kind:"國曆",age:0,monthOnly:true})}}
  return out;
}
function bdayMap(from,to){const m={};bdays.forEach(b=>bdayOcc(b,from,to).forEach(o=>{if(o.monthOnly)return;(m[o.date]=m[o.date]||[]).push({name:b.name,kind:o.kind,age:o.age})}));return m}
function bdDesc(b){const p=[];if(b.s)p.push(b.s[1]?`國曆 ${b.s[0]}/${b.s[1]}`:`國曆 ${b.s[0]} 月（日期未定）`);if(b.l)p.push(`農曆 ${LMN[b.l[0]-1]}月${lDayName(b.l[1])}`);return p.join("・")}
function upcoming(days){
  const t=new Date(today()+"T00:00:00Z"),end=new Date(t.getTime()+days*864e5),list=[];
  bdays.forEach(b=>bdayOcc(b,t,end).forEach(o=>list.push({b,...o,left:Math.round((new Date(o.date+"T00:00:00Z")-t)/864e5)})));
  return list.sort((a,b)=>a.date.localeCompare(b.date)||a.b.name.localeCompare(b.b.name));
}
function bdRow(x){
  const r=document.createElement("button");r.type="button";r.className="bdrow";
  const [,mm,dd]=x.date.split("-").map(Number),dow="日一二三四五六"[new Date(x.date+"T00:00:00Z").getUTCDay()];
  const w=document.createElement("div");w.className="when"+(x.left<=14?" soon":"");const wb=document.createElement("b");wb.textContent=x.monthOnly?`${mm} 月`:`${mm}/${dd}`;const ws=document.createElement("small");ws.textContent=x.monthOnly?"日期未定":`星期${dow}`;w.append(wb,ws);
  const who=document.createElement("div");who.className="who";const nb=document.createElement("b");nb.textContent=x.b.name+(x.kind==="農曆"?"（農曆）":"");
  const ns=document.createElement("small");ns.textContent=[x.b.g||"",x.kind==="農曆"?`農曆${LMN[x.b.l[0]-1]}月${lDayName(x.b.l[1])}`:"",x.age?`滿 ${x.age} 歲`:""].filter(Boolean).join("・");who.append(nb,ns);
  const lf=document.createElement("span");lf.className="left";lf.textContent=x.monthOnly?"":x.left===0?"今天！":x.left===1?"明天":`還有 ${x.left} 天`;
  r.append(w,who,lf);
  r.onclick=()=>{if(x.monthOnly){editBday(x.b);return}const [yy,m2]=x.date.split("-").map(Number);calY=yy;calM=m2;calSel=x.date;view="cal";render();setTimeout(()=>$("calDay").scrollIntoView({behavior:"smooth",block:"center"}),50)};
  return r;
}
function renderBdCard(){
  const c=$("bdCard");c.innerHTML="";
  const h=document.createElement("div");h.className="lhead";const t=document.createElement("h2");t.textContent="近期生日";const a=document.createElement("button");a.type="button";a.className="ghost sm";a.textContent="生日名單";a.onclick=()=>{view="bd";render();window.scrollTo(0,0)};h.append(t,a);c.appendChild(h);
  if(!bdays.length){const p=document.createElement("p");p.className="sub";p.style.margin="6px 0 0";p.textContent="還沒有生日名單。按「生日名單」新增家人、朋友、同學的生日（國曆、農曆都可以）。";c.appendChild(p);return}
  let up=upcoming(30);const more=upcoming(366);
  if(up.length<3)up=more.slice(0,3);
  up.slice(0,5).forEach(x=>c.appendChild(bdRow(x)));
  if(up.length>5){const m=document.createElement("div");m.className="sub";m.style.marginTop="6px";m.textContent=`30 天內還有 ${up.length-5} 位，看「生日名單」`;c.appendChild(m)}
}
function renderBdList(){
  const box=$("bdList");box.innerHTML="";
  const top=document.createElement("div");top.className="lhead";const p=document.createElement("p");p.className="sub";p.style.margin="0";p.textContent=`共 ${bdays.length} 位・照下一次生日排序，點一位可以修改`;
  const a=document.createElement("button");a.type="button";a.className="ghost sm";a.textContent="＋ 新增";a.onclick=()=>editBday(null);top.append(p,a);box.appendChild(top);
  const nexts=upcoming(400),seen=new Set();
  GRPS.forEach(g=>{
    const rows=nexts.filter(x=>(x.b.g||"其他")===g&&!seen.has(x.b.id+x.kind)&&seen.add(x.b.id+x.kind));
    if(!rows.length)return;const gh=document.createElement("div");gh.className="bdgrp";gh.textContent=g;box.appendChild(gh);
    rows.forEach(x=>{const r=bdRow(x);r.onclick=()=>editBday(x.b);box.appendChild(r)});
  });
}
function editBday(b){
  const isNew=!b;b=b||{id:Date.now().toString(36),name:"",g:"朋友",s:null,l:null,y:0};
  openForm({title:isNew?"新增生日":`修改${b.name}的生日`,sub:"國曆、農曆至少填一個；只知道月份的話，日期留空。",fields:[
    {key:"name",label:"名字",value:b.name,full:true},
    {key:"g",label:"分類",options:GRPS.map(x=>[x,x]),value:b.g||"朋友"},
    {key:"y",label:"出生年（西元，可空）",type:"number",value:b.y||"",placeholder:"例如 2004"},
    {key:"sm",label:"國曆 月",type:"number",value:b.s?b.s[0]:"",placeholder:"1–12"},{key:"sd",label:"國曆 日",type:"number",value:b.s&&b.s[1]?b.s[1]:"",placeholder:"可空"},
    {key:"lm",label:"農曆 月",type:"number",value:b.l?b.l[0]:"",placeholder:"可空"},{key:"ld",label:"農曆 日",type:"number",value:b.l?b.l[1]:"",placeholder:"可空"}],
    validate:()=>{if(!fv("name"))return"請填名字";const sm=+fv("sm"),sd=+fv("sd"),lm=+fv("lm"),ld=+fv("ld");
      if(!sm&&!lm)return"國曆或農曆至少填一個";if(sm&&(sm<1||sm>12||sd<0||sd>31))return"國曆日期不對";if((lm||ld)&&(lm<1||lm>12||ld<1||ld>30))return"農曆月要 1–12、日要 1–30";return""},
    onSave:()=>{const sm=+fv("sm"),sd=+fv("sd"),lm=+fv("lm"),ld=+fv("ld");
      const nb={id:b.id,name:fv("name"),g:fv("g")||"朋友",s:sm?[sm,sd||0]:null,l:lm&&ld?[lm,ld]:null,y:+fv("y")||0};
      const list=bdays.filter(x=>x.id!==b.id).concat([nb]);return bdRef.set({list})},
    onDelete:isNew?null:()=>bdRef.set({list:bdays.filter(x=>x.id!==b.id)})});
}
$("bdBack").onclick=()=>{view="cal";render();window.scrollTo(0,0)};

let calY=0,calM=0,calSel="";
const pad2=n=>String(n).padStart(2,"0");
function renderCal(){
  if(!calY){const t=today();calY=+t.slice(0,4);calM=+t.slice(5,7);calSel=t}
  const first=new Date(Date.UTC(calY,calM-1,1)),startDow=first.getUTCDay(),dim=new Date(Date.UTC(calY,calM,0)).getUTCDate();
  const mid=toLunar(calY,calM,15);
  $("calTitle").textContent=`${calY} 年 ${calM} 月`;
  $("calSub").textContent=mid?`${ganzhi(mid.y)}（${shengxiao(mid.y)}年）・民國 ${calY-1911} 年`:`民國 ${calY-1911} 年`;
  const spent={};expenses.forEach(e=>{spent[e.date]=(spent[e.date]||0)+(+e.amount||0)});
  const g=$("calGrid");g.innerHTML="";const tdy=today();
  const cells=Math.ceil((startDow+dim)/7)*7;
  const bmap=bdayMap(new Date(Date.UTC(calY,calM-1,1-startDow)),new Date(Date.UTC(calY,calM-1,cells-startDow)));
  for(let k=0;k<cells;k++){
    const dt=new Date(Date.UTC(calY,calM-1,1-startDow+k)),y=dt.getUTCFullYear(),m=dt.getUTCMonth()+1,d=dt.getUTCDate(),key=`${y}-${pad2(m)}-${pad2(d)}`;
    const inf=dayInfo(y,m,d),dow=dt.getUTCDay();
    const b=document.createElement("button");b.type="button";b.className="cday"+(m!==calM?" out":"")+(dow===0||dow===6?" we":"")+(key===tdy?" today":"")+(key===calSel?" sel":"");
    const n=document.createElement("span");n.className="n";n.textContent=d;
    const l=document.createElement("span");l.className="l";
    const bd=bmap[key]||[];
    if(bd.length){l.textContent=bd[0].name.slice(0,3)+(bd.length>1?"等":"");l.classList.add("bday")}
    else if(inf.fest.length){l.textContent=inf.fest[0].replace(/節$/,"").slice(0,4);l.classList.add("fest")}
    else if(inf.term){l.textContent=inf.term;l.classList.add("term")}
    else if(inf.l){if(inf.l.d===1){l.textContent=lMonName(inf.l);l.classList.add("m1")}else l.textContent=lDayName(inf.l.d)}
    b.append(n,l);
    if(spent[key]){const dot=document.createElement("i");dot.className="dot";b.appendChild(dot)}
    b.setAttribute("aria-label",`${m}月${d}日`+(inf.l?`，農曆${lMonName(inf.l)}${lDayName(inf.l.d)}`:"")+(inf.term?`，${inf.term}`:"")+(inf.fest.length?`，${inf.fest.join("、")}`:"")+(bd.length?`，${bd.map(x=>x.name+x.kind+"生日").join("、")}`:"")+(spent[key]?`，花了${spent[key]}元`:""));
    b.onclick=()=>{calSel=key;if(m!==calM){calY=y;calM=m}renderCal()};
    g.appendChild(b);
  }
  renderCalDay();renderBdCard();
}
function renderCalDay(){
  const box=$("calDay");box.innerHTML="";if(!calSel)return;
  const [y,m,d]=calSel.split("-").map(Number),inf=dayInfo(y,m,d),dow="日一二三四五六"[new Date(Date.UTC(y,m-1,d)).getUTCDay()];
  const h=document.createElement("h2");h.textContent=`${m} 月 ${d} 日　星期${dow}`;box.appendChild(h);
  const lu=document.createElement("div");lu.className="lun";
  lu.textContent=inf.l?`農曆 ${lMonName(inf.l)}${lDayName(inf.l.d)}・${ganzhi(inf.l.y)}・屬${shengxiao(inf.l.y)}`:"";box.appendChild(lu);
  const bdl=(bdayMap(new Date(Date.UTC(y,m-1,d)),new Date(Date.UTC(y,m-1,d)))[calSel]||[]);
  if(inf.term||inf.fest.length||bdl.length){const tg=document.createElement("div");tg.className="tags";
    bdl.forEach(x=>{const t=document.createElement("span");t.className="tag bday";t.textContent=`🎂 ${x.name}${x.kind==="農曆"?"農曆":""}生日`+(x.age?`（${x.age} 歲）`:"");tg.appendChild(t)});
    if(inf.term){const t=document.createElement("span");t.className="tag term";t.textContent="節氣・"+inf.term;tg.appendChild(t)}
    inf.fest.forEach(f=>{const t=document.createElement("span");t.className="tag fest";t.textContent=f;tg.appendChild(t)});box.appendChild(tg)}
  const ex=expenses.filter(e=>e.date===calSel),inc=incomes.filter(i=>i.date===calSel),cu=coupons.filter(c=>c.date===calSel&&c.type==="use");
  const sub=document.createElement("div");sub.className="sub";sub.style.margin="4px 0 2px";
  const tot=ex.reduce((t,e)=>t+(+e.amount||0),0);
  {const parts=[];if(ex.length)parts.push(`花了 ${fmt(tot)}`);if(inc.length)parts.push(`收入 ${fmt(inc.reduce((t,i)=>t+(+i.amount||0),0))}`);if(cu.length)parts.push(`用券 ${fmt(cu.reduce((t,c)=>t+(+c.amount||0),0))}`);
   sub.textContent=parts.length?"這天"+parts.join("，"):"這天沒有記帳";}box.appendChild(sub);
  ex.forEach(e=>{const r=document.createElement("div");r.className="rc";const a=document.createElement("span");a.textContent=`${e.category}　${e.note||""}${e.remark?"（"+e.remark+"）":""}`;if(phOf(e).length)a.appendChild(thumbEl(e));const b=document.createElement("span");b.textContent=fmt(e.amount);r.append(a,b);if(canWrite){r.style.cursor="pointer";r.onclick=()=>openSheet("exp",e)}box.appendChild(r)});
  inc.forEach(i=>{const r=document.createElement("div");r.className="rc";const a=document.createElement("span");a.textContent=`收入　${i.note||""}`;const b=document.createElement("span");b.className="pos";b.textContent="+"+fmt(i.amount);r.append(a,b);box.appendChild(r)});
  cu.forEach(c=>{const r=document.createElement("div");r.className="rc";const a=document.createElement("span");a.textContent=`${c.store}優惠券　${(c.note||"").slice(0,24)}${(c.note||"").length>24?"…":""}`;const b=document.createElement("span");b.style.color="var(--muted)";b.textContent="券 "+fmt(c.amount);r.append(a,b);box.appendChild(r)});
  if(canWrite){const bt=document.createElement("div");bt.className="bt";const add=document.createElement("button");add.type="button";add.className="ghost sm";add.textContent="＋ 記一筆在這天";
    add.onclick=()=>{openSheet("newExp",null);$("shDate").value=calSel};bt.appendChild(add);box.appendChild(bt)}
}
$("calPrev").onclick=()=>{calM--;if(calM<1){calM=12;calY--}if(calY<1901){calY=1901;calM=1}renderCal()};
$("calNext").onclick=()=>{calM++;if(calM>12){calM=1;calY++}if(calY>2039){calY=2039;calM=12}renderCal()};
$("calToday").onclick=()=>{const t=today();calY=+t.slice(0,4);calM=+t.slice(5,7);calSel=t;renderCal()};

const MEMO=["⛄","💝","🌸","🌷","🌻","🍉","🏖️","🎐","🍂","🎃","🍁","🎄"];
function netMonths(){
  const nowM=today().slice(0,7);
  return[...new Set([nowM,...expenses.map(e=>e.month),...incomes.map(i=>i.month),...Object.keys((settings&&settings.allowance)||{})])].filter(m=>m&&m<=nowM).sort();
}
function monthNet(m){return allowanceOf(m)+incomeSum(m)-expenses.filter(e=>e.month===m).reduce((t,e)=>t+(+e.amount||0),0)}
const fmtS=n=>(n<0?"−":"+")+fmt(Math.abs(n));
function renderMonths(){
  const box=$("monthList");if(!box)return;box.innerHTML="";
  const nowM=today().slice(0,7),ms=netMonths();
  const ns=$("netSum");ns.innerHTML="";
  if(ms.length&&settings){
    const tot=ms.reduce((t,m)=>t+monthNet(m),0),[fy,fm]=ms[0].split("-").map(Number);
    const l=document.createElement("div"),lb=document.createElement("span"),sm=document.createElement("small"),v=document.createElement("b");
    lb.textContent="累計結餘";sm.textContent=`${fy} 年 ${fm} 月到現在，每個月「額度＋收入−支出」加總`;l.append(lb,sm);
    v.textContent=fmtS(tot);v.className=tot<0?"neg":"pos";
    const w=document.createElement("div");w.className="net";w.append(l,v);ns.appendChild(w);
  }
  ms.slice().reverse().forEach(m=>{
    const sp=expenses.filter(e=>e.month===m).reduce((t,e)=>t+(+e.amount||0),0),al=allowanceOf(m)+incomeSum(m),net=al-sp;
    const [y,mo]=m.split("-").map(Number);
    const b=document.createElement("button");b.type="button";b.className="mrow";
    const l=document.createElement("span"),r=document.createElement("span");r.className="r";
    l.textContent=`${y} 年 ${mo} 月`+(m===nowM?"（本月）":"");
    const a1=document.createElement("span");a1.textContent="花 "+fmt(sp);r.appendChild(a1);
    if(al){const a2=document.createElement("span");a2.textContent=(m===nowM?"目前結餘 ":"結餘 ")+fmtS(net);a2.className=net<0?"neg":"pos";r.appendChild(a2)}
    b.append(l,r);b.onclick=()=>{view="month";cur=m;$("vdate").value=m===nowM?today():m+"-01";sstate=null;setupOpen=false;render()};
    box.appendChild(b);
  });
}
function setDate(){
  const d=new Date(today()+"T00:00:00Z");
  $("datebar").textContent=d.toLocaleDateString("zh-TW",{year:"numeric",month:"long",day:"numeric",weekday:"long",timeZone:"UTC"});
}

// ---- quotes / background / reminder ----
const QSRC="太上感應篇彙編-卷一\n太上曰：禍福無門，惟人自召。";
// 每日一句：依序每天一則，從 2026-10-03 的第 1 則開始；之後新增的接在最後
const QUOTES=[
  {t:"《書》云：『天難諶，命靡常。』又云：『惟命不於常。』皆非誑語。吾於是而知：凡稱禍福，無不自己求之者，乃聖賢之言；若謂禍福惟天所命，則世俗之論矣。",src:QSRC},
  {t:"汝之命未知若何。即命當榮顯，常作落寞想；即時當順利，常作拂逆想；即眼前足食，常作貧窶想；即人相愛敬，常作恐懼想；即家世望重，常作卑下想；即學問頗優，常作淺陋想。",src:QSRC},
  {t:"遠思揚祖宗之德，近思蓋父母之愆。上思報國之恩，下思造家之福；外思濟人之急，內思閑己之邪。",src:QSRC},
  {t:"日日知非，日日改過。一日不知非，即一日安於自是；一日無過可改，即一日無步可進。天下聰明俊秀不少，所以德不加修、業不加廣者，只為『因循』二字耽擱一生。",src:QSRC},
  {t:"然行義未純，檢身多誤：或見善而行之不勇，或救人而心常自疑，或身勉為善而口有過言，或醒時操持而醉後放逸。以過折功，日常虛度。自己巳歲發願，直至己卯歲，歷十餘年，而三千善行始完。",src:QSRC},
  {t:"余初號學海，是日改號了凡，蓋悟立命之說，而欲不落凡夫窠臼也。從此而後，終日兢兢，便覺與前不同。前日只是悠悠放任，到此自有戰兢惕勵景象。在暗室屋漏中，常恐得罪天地鬼神。遇人憎我毀我，自能恬然容受。",src:QSRC},
  {t:"凡祈天立命，都要從無思無慮處感格。孟子論立命之學，而曰夭壽不貳。細分之，豐歉不貳，然後可立貧富之命；窮通不貳，然後可立貴賤之命；夭壽不貳，然後可立生死之命。",src:QSRC},
  {t:"汝今既知非，將向來不登科第、不生子之相盡情改刷，務要積德，務要包荒，務要和愛，務要惜精神。從前種種，譬如昨日死；從後種種，譬如今日生。",src:QSRC},
  {t:"《易》為君子謀，趨吉避凶。若言天命有常，吉何可趨，凶何可避？開章第一義，便說：「積善之家，必有餘慶；積不善之家，必有餘殃。」汝信得及否？",src:QSRC},
  {t:"汝不見六祖說：「一切福田，不離方寸。從心而覓，感無不通。」求在我，不獨得道德仁義，亦得功名富貴。內外雙得，是求有益於得也。若不返躬內省，徒向外馳求，則求之有道，得之有命矣。內外雙失，故無益。",src:QSRC},
  {t:"雲谷曰：『汝自揣應得科第否？應生子否？』余追省良久，曰：『不應也。科第中人，類有福相，余福薄。又不能積功累行，以基厚福；兼不耐煩劇，不能容人。時或以才智蓋人，直心直行，輕言妄談。凡此皆薄福之相也，豈宜科第哉！地之穢者多生物，水之清者常無魚，余好潔；和氣能育萬物，余善怒；愛為生生之本，忍為不育之根，余矜惜名節，常不能捨己救人。又多言耗氣，喜飲爍精，好徹夜長坐，而不知葆元毓神，皆宜無子。其餘過惡尚多，不能悉數。』",src:QSRC},
  {t:"雲谷曰：『豈惟科第哉！世間享千金之產者，定是千金人物；享百金之產者，定是百金人物；應餓死者，定是餓死人物。天不過因材而篤，幾曾加纖毫意思。即如生子，有百世之德者，定有百世子孫保之……』",src:QSRC},
  {t:"余問曰：『然則數可逃乎？』曰：『命自我作，福自己求。《詩》《書》所稱，的為明訓。我教典中說，求功名得功名，求富貴得富貴，求男女得男女，求長壽得長壽。夫誑語乃釋迦大戒。諸佛菩薩，豈誑語欺人？』",src:QSRC}
];
const QSTART=Date.UTC(2026,9,3);
function setQuote(){
  const d=new Date(today()+"T00:00:00Z"),n=Math.floor((d-QSTART)/864e5),k=((n%QUOTES.length)+QUOTES.length)%QUOTES.length,item=QUOTES[k];
  const q=$("quote");q.textContent="";q.classList.add("clamp");q.dataset.open="0";
  const t=document.createElement("div");t.className="qt";t.textContent=item.t;
  const more=document.createElement("div");more.className="qmore";more.textContent="展開全文";more.hidden=true;
  const src=document.createElement("div");src.className="qsrc";src.textContent=item.src||"";
  q.append(t,more,src);
  q.onclick=()=>{const open=q.dataset.open!=="1";q.dataset.open=open?"1":"0";q.classList.toggle("clamp",!open);more.textContent=open?"收起":"展開全文";if(!open)fitQuote()};
  try{const l=document.createElement("link");l.rel="stylesheet";l.href="https://fonts.googleapis.com/css2?family=Noto+Serif+TC:wght@500&display=swap&text="+encodeURIComponent(item.t+(item.src||"")+"展開全文收起");document.head.appendChild(l)}catch(e){}
}
function fitQuote(){
  const q=$("quote");if(!q||q.hidden||q.dataset.open==="1")return;
  const t=q.querySelector(".qt"),m=q.querySelector(".qmore");if(!t||!m)return;
  m.hidden=!(t.scrollHeight>t.clientHeight+2);
}
function applyBg(url){$("bgLayer").style.backgroundImage=url?'url("'+url+'")':"";document.body.classList.toggle("hasbg",!!url)}
function shrink(file){
  return new Promise((res,rej)=>{
    const fr=new FileReader();fr.onerror=rej;
    fr.onload=()=>{const img=new Image();img.onerror=rej;img.onload=()=>{
      let max=1280,q=.82,out="";
      for(;;){
        const k=Math.min(1,max/Math.max(img.width,img.height)),w=Math.round(img.width*k),h=Math.round(img.height*k);
        const c=document.createElement("canvas");c.width=w;c.height=h;c.getContext("2d").drawImage(img,0,0,w,h);
        out=c.toDataURL("image/jpeg",q);
        if(out.length<=235000||(q<=.4&&max<=400))break;
        if(q>.55)q=Math.round((q-.08)*100)/100;else{max=Math.round(max*.85);q=.72}
      }
      res(out);
    };img.src=fr.result};
    fr.readAsDataURL(file);
  });
}
// ---- sharing my ledger with the household ----
function buildPayload(){
  const level=(settings&&settings.share)||"none";
  const role=myName();
  if(level==="none")return{level:"none",months:{},role};
  const by={};expenses.forEach(e=>{(by[e.month]=by[e.month]||[]).push(e)});
  const ms=Object.keys(by).sort().reverse().slice(0,12);
  const bud={};cats().forEach(c=>bud[c.name]=+c.budget||0);
  const months={};
  ms.forEach((m,i)=>{
    const list=by[m],o={total:list.reduce((s,e)=>s+(+e.amount||0),0)};
    if(level!=="total"){o.cats={};list.forEach(e=>{o.cats[e.category]=(o.cats[e.category]||0)+(+e.amount||0)});o.budgets=bud;o.allowance=allowanceOf(m)+incomeSum(m)}
    if(level==="full"&&i<3)o.entries=list.map(e=>({d:e.date,c:e.category,a:+e.amount,n:e.note||"",r:e.remark||""}));
    months[m]=o;
  });
  return{level,months,role};
}
function schedulePublish(){
  if(!canWrite||!settings||!shareRef())return;
  clearTimeout(pubTimer);pubTimer=setTimeout(doPublish,800);
}
async function doPublish(){
  const ref=shareRef();if(!settings||!loaded||!ref)return;
  const p=buildPayload(),key=hid+JSON.stringify(p);
  if(key===lastPub)return;
  try{await ref.set({...p,updatedAt:Date.now()});lastPub=key;$("shareMsg").textContent=""}
  catch(e){$("shareMsg").textContent="分享設定更新失敗，請稍後再試"}
}
function renderFam(){
  const card=$("fam");card.hidden=!(hid&&curKey==="me");if(card.hidden)return;
  const ids=Object.keys(others).filter(id=>id!==myId&&members[id]&&others[id]&&others[id].level&&others[id].level!=="none");
  const sel=$("famWho"),keep=famSel||sel.value,body=$("famBody");
  sel.innerHTML="";body.innerHTML="";
  const say=(t,cls)=>{const p=document.createElement("div");p.className=cls||"sub";p.textContent=t;body.appendChild(p)};
  const nameOf=id=>(members[id]&&members[id].name)||others[id].role||"家人";
  if(!ids.length){sel.hidden=true;say("還沒有家人分享帳目。家人可以在「設定 → 分享給家人」選擇要分享多少。");return}
  sel.hidden=false;
  ids.forEach(id=>{const o=document.createElement("option");o.value=id;o.textContent=nameOf(id);sel.appendChild(o)});
  if(ids.includes(keep))sel.value=keep;famSel=sel.value;
  const d=others[famSel],m=d.months&&d.months[cur];
  say(({total:"只分享總支出",cats:"分享各類別合計",full:"分享完整明細"}[d.level]||""));
  if(!m){say("這個月還沒有記錄");return}
  say("本月已支出 "+fmt(m.total)+(m.allowance?`（額度 ${fmt(m.allowance)}，剩 ${fmt(m.allowance-m.total)}）`:""),"alert ok");
  if(m.cats){
    Object.entries(m.cats).sort((a,b)=>b[1]-a[1]).forEach(([n,v])=>{
      const bd=(m.budgets&&m.budgets[n])||0,r=document.createElement("div");r.className="row";
      r.innerHTML='<div class="top"><span></span><span></span></div>'+(bd?'<div class="bar"><i></i></div>':'');
      r.querySelector(".top span").textContent=n;
      r.querySelector(".top span:last-child").textContent=bd?`${fmt(v)} / ${fmt(bd)}`:fmt(v);
      if(m.entries&&m.entries.length){
        r.classList.add("tap");r.setAttribute("role","button");r.tabIndex=0;
        const ch=document.createElement("i");ch.className="chev";ch.setAttribute("aria-hidden","true");ch.textContent="›";r.querySelector(".top span").appendChild(ch);
        const ent=m.entries,tot=m.total,who=nameOf(famSel);
        r.onclick=()=>openCat({title:who+"・"+n,color:"var(--accent)",edit:false,budget:()=>bd,total:()=>tot,items:()=>ent.filter(e=>e.c===n).map(e=>({date:e.d,note:e.n,remark:e.r,amount:+e.a||0}))});
        r.onkeydown=e=>{if(e.key==="Enter"||e.key===" "){e.preventDefault();r.onclick()}};
      }
      if(bd){const i=r.querySelector(".bar i"),pct=v/bd*100;i.style.width=Math.min(100,pct)+"%";if(pct>=100)i.className="bad";else if(pct>=80)i.className="warn"}
      body.appendChild(r);
    });
  }
  if(m.entries&&m.entries.length){
    const t=document.createElement("table"),tb=document.createElement("tbody");t.appendChild(tb);
    m.entries.slice().sort((a,b)=>b.d.localeCompare(a.d)).forEach(e=>{
      const tr=document.createElement("tr");tr.innerHTML='<td class="d"></td><td></td><td></td><td class="n"></td>';
      const c=tr.children;c[0].textContent=e.d.slice(5);c[1].textContent=e.c;c[2].textContent=(e.n||"")+(e.r?"（"+e.r+"）":"");c[3].textContent=fmt(e.a);tb.appendChild(tr);
    });
    body.appendChild(t);
  }
}
$("famWho").onchange=()=>{famSel=$("famWho").value;renderFam()};
$("shareLevel").onchange=async e=>{
  if(!settings||!base||!hid)return;
  try{await base.update({share:e.target.value});$("shareMsg").textContent="已更新 ✅"}catch(err){$("shareMsg").textContent="更新失敗，請稍後再試"}
};

// ---- households: members, invites ----
function hhStop(){hhUnsubs.forEach(f=>{try{f()}catch(e){}});hhUnsubs=[]}
function rerenderHH(){if(curKey)render()}
function pickHousehold(h){
  hhStop();hid=h||null;household=null;members={};others={};contribs=[];goal=null;lastPub="";
  if(!hid){rerenderHH();return}
  const id=hid;
  hhUnsubs.push(DB.doc(`households/${id}`).onSnapshot(sn=>{if(hid!==id)return;if(!sn.exists){dropHousehold(id);return}household=sn.data();goal=household.goal||null;rerenderHH()},()=>{if(hid===id)dropHousehold(id)}));
  hhUnsubs.push(DB.collection(`households/${id}/members`).onSnapshot(sn=>{if(hid!==id)return;members={};sn.docs.forEach(d=>{members[d.id]={id:d.id,...d.data()}});if(sn.docs.length&&!members[myId]){dropHousehold(id);return}rerenderHH();schedulePublish()},()=>{}));
  hhUnsubs.push(DB.collection(`households/${id}/shares`).onSnapshot(sn=>{if(hid!==id)return;others={};sn.docs.forEach(d=>{others[d.id]=d.data()});if(loaded)renderFam()},()=>{}));
  hhUnsubs.push(DB.collection(`households/${id}/contrib`).onSnapshot(sn=>{if(hid!==id)return;contribs=sn.docs.map(d=>({id:d.id,...d.data()}));if(loaded)renderGoal()},()=>{}));
  schedulePublish();
}
async function saveProfile(patch){Object.assign(profile,patch);try{await DB.doc(`users/${myId}`).set(patch,{merge:true})}catch(e){}}
let dropping=null,leaving=null;
async function dropHousehold(id){
  if(dropping===id||leaving===id)return;dropping=id;
  const was=hid===id,wasFam=curKey==="fam";if(was)hhStop();
  const hids=(profile.hids||[]).filter(x=>x!==id),next=hids[0]||"";
  try{await saveProfile({hids,cur:next})}finally{dropping=null}
  if(was){pickHousehold(next);if(wasFam)enterLedger("me");toast("你已經不在這個家了")}
}
async function switchHousehold(h){await saveProfile({cur:h});pickHousehold(h);if(curKey==="fam")enterLedger("fam");else render()}
function randToken(){const a=new Uint8Array(16);crypto.getRandomValues(a);return[...a].map(x=>x.toString(16).padStart(2,"0")).join("")}
const inviteUrl=(h,t)=>`${SITE_URL}?join=${h}.${t}&openExternalBrowser=1`;
async function createHousehold(name){
  const ref=DB.collection("households").doc(),b=DB.batch();
  b.set(ref,{name,owner:myId,createdAt:Date.now()});
  b.set(ref.collection("members").doc(myId),{name:myName(),photo:(me&&me.photoURL)||"",invite:"",joinedAt:Date.now()});
  await b.commit();
  await saveProfile({hids:[...new Set([...(profile.hids||[]),ref.id])],cur:ref.id});
  pickHousehold(ref.id);
}
let lastInvite=null;
async function createInvite(){
  const t=randToken();
  await DB.doc(`households/${hid}/invites/${t}`).set({by:myId,byName:myName(),hname:hhName(),createdAt:Date.now(),expiresAt:firebase.firestore.Timestamp.fromMillis(Date.now()+7*864e5)});
  lastInvite={h:hid,t,url:inviteUrl(hid,t)};return lastInvite;
}
let invites=[],invSub=null,invFor=null;
function watchInvites(){
  if(invFor===hid)return;if(invSub){try{invSub()}catch(e){}}invSub=null;invites=[];invFor=hid;if(!hid)return;
  invSub=DB.collection(`households/${hid}/invites`).onSnapshot(sn=>{invites=sn.docs.map(d=>({id:d.id,...d.data()}));if(view==="set"&&setSub==="family")renderFamilyPage()},()=>{});
  hhUnsubs.push(()=>{if(invSub)invSub();invSub=null;invFor=null});
}
async function copyText(t){try{await navigator.clipboard.writeText(t);return true}catch(e){const ta=document.createElement("textarea");ta.value=t;ta.style.position="fixed";ta.style.opacity="0";document.body.appendChild(ta);ta.select();let ok=false;try{ok=document.execCommand("copy")}catch(err){}ta.remove();return ok}}
function toast(t){const el=$("toast");el.textContent=t;el.hidden=false;clearTimeout(toast._t);toast._t=setTimeout(()=>{el.hidden=true},2600)}
function mkEl(tag,cls,txt){const x=document.createElement(tag);if(cls)x.className=cls;if(txt!=null)x.textContent=txt;return x}
function avatarEl(m){
  const a=mkEl("span","mav");
  if(m&&m.photo){const im=document.createElement("img");im.src=m.photo;im.alt="";im.referrerPolicy="no-referrer";im.onerror=()=>{im.remove();a.textContent=((m&&m.name)||"?").slice(0,1)};a.appendChild(im)}
  else a.textContent=((m&&m.name)||"?").slice(0,1);
  return a;
}
function renderFamilyPage(){
  const c=$("famCard");c.innerHTML="";
  if(!hid){
    c.append(mkEl("h2","","建立你的家"),mkEl("p","sub","建立以後，按「邀請家人」把連結傳給家人。家人用 Google 帳號登入就會加入，可以一起記「全家的帳」，也能互相分享自己的帳。"));
    const row=mkEl("div","bt"),inp=document.createElement("input");inp.value=`${myName()}的家`;inp.maxLength=30;inp.setAttribute("aria-label","家的名字");
    const b=mkEl("button","","建立");b.type="button";const msg=mkEl("small","m");
    b.onclick=async()=>{const n=inp.value.trim();if(!n){msg.textContent="請取個名字";return}b.disabled=true;try{await createHousehold(n);toast("家建立好了，可以邀請家人了")}catch(e){msg.textContent="建立失敗，請稍後再試";b.disabled=false}};
    row.append(inp,b,msg);c.appendChild(row);
    c.appendChild(mkEl("p","sub","要加入家人的家？請家人在這一頁按「邀請家人」，把連結傳給你，點開就能加入。")).style.marginTop="14px";
    return;
  }
  watchInvites();
  const owner=household&&household.owner===myId;
  const nh=mkEl("div","lhead"),h2=mkEl("h2","",hhName()),rn=mkEl("button","ghost sm","改名字");rn.type="button";
  rn.onclick=()=>openForm({title:"家的名字",fields:[{key:"n",label:"名字",value:hhName(),full:true}],validate:()=>fv("n")?"":"請填名字",onSave:()=>DB.doc(`households/${hid}`).update({name:fv("n").slice(0,30)})});
  nh.append(h2,rn);c.appendChild(nh);
  if((profile.hids||[]).length>1){
    const s=document.createElement("select");s.setAttribute("aria-label","切換家庭");
    (profile.hids||[]).forEach(x=>{const o=document.createElement("option");o.value=x;o.textContent=x===hid?hhName():"其他家庭（"+x.slice(0,5)+"）";s.appendChild(o)});
    s.value=hid;s.onchange=()=>switchHousehold(s.value);const r=mkEl("div","bt");r.style.margin="0 0 10px";r.append(mkEl("small","m","切換到："),s);c.appendChild(r);
  }
  c.appendChild(mkEl("div","bdgrp","成員"));
  Object.values(members).sort((a,b)=>(a.joinedAt||0)-(b.joinedAt||0)).forEach(m=>{
    const r=mkEl("div","mem");r.appendChild(avatarEl(m));
    const w=mkEl("div","mwho"),nb=mkEl("b","",m.name||"家人");w.appendChild(nb);
    const tags=[];if(household&&household.owner===m.id)tags.push("擁有者");if(m.id===myId)tags.push("你");
    if(tags.length)w.appendChild(mkEl("small","",tags.join("・")));r.appendChild(w);
    const act=mkEl("span","mact");
    if(m.id===myId){const b=mkEl("button","ghost sm","改稱呼");b.type="button";b.onclick=()=>openForm({title:"在這個家你叫什麼？",sub:"例如 媽媽、爸爸、姐姐、弟弟。家人會看到這個稱呼。",fields:[{key:"n",label:"稱呼",value:m.name||"",full:true}],validate:()=>fv("n")?"":"請填稱呼",onSave:()=>DB.doc(`households/${hid}/members/${myId}`).update({name:fv("n").slice(0,20)})});act.appendChild(b)}
    else if(owner){
      const b1=mkEl("button","ghost sm","設為擁有者");b1.type="button";b1.onclick=()=>openForm({title:`把擁有者轉給${m.name||"家人"}？`,sub:"擁有者可以移除成員。轉出以後，你還是這個家的成員。",fields:[],okLabel:"轉給他",onSave:()=>DB.doc(`households/${hid}`).update({owner:m.id})});
      const b2=mkEl("button","ghost sm","移除");b2.type="button";b2.onclick=()=>openForm({title:`把${m.name||"家人"}移出這個家？`,sub:"移除後對方看不到全家的帳，你也看不到他分享的帳。他自己的帳不會被刪掉。",fields:[],okLabel:"移除",onSave:async()=>{await DB.doc(`households/${hid}/shares/${m.id}`).delete().catch(()=>{});await DB.doc(`households/${hid}/members/${m.id}`).delete()}});
      act.append(b1,b2);
    }
    r.appendChild(act);c.appendChild(r);
  });
  c.appendChild(mkEl("div","bdgrp","邀請家人"));
  c.appendChild(mkEl("p","sub","產生一個邀請連結，用 LINE 或簡訊傳給家人。家人點開、用 Google 帳號登入就會加入。連結 7 天內有效。")).style.margin="0 0 8px";
  const ib=mkEl("button","","產生邀請連結");ib.type="button";const imsg=mkEl("small","m");
  const box=mkEl("div","invbox");box.hidden=!(lastInvite&&lastInvite.h===hid);
  const showLink=inv=>{box.innerHTML="";const u=mkEl("input","invurl");u.readOnly=true;u.value=inv.url;u.onclick=()=>u.select();
    const r=mkEl("div","bt"),cp=mkEl("button","ghost sm","複製連結");cp.type="button";cp.onclick=async()=>{toast(await copyText(inv.url)?"已複製，貼到 LINE 傳給家人":"請長按連結自己複製")};r.appendChild(cp);
    if(navigator.share){const sh=mkEl("button","ghost sm","分享…");sh.type="button";sh.onclick=()=>navigator.share({title:"家庭記帳本",text:`${myName()}邀請你加入「${hhName()}」的家庭記帳本`,url:inv.url}).catch(()=>{});r.appendChild(sh)}
    box.append(u,r);box.hidden=false};
  if(lastInvite&&lastInvite.h===hid)showLink(lastInvite);
  ib.onclick=async()=>{ib.disabled=true;imsg.textContent="";try{showLink(await createInvite())}catch(e){imsg.textContent="產生失敗，請稍後再試"}ib.disabled=false};
  const ir=mkEl("div","bt");ir.append(ib,imsg);c.append(ir,box);
  const act=invites.filter(v=>v.expiresAt&&v.expiresAt.toMillis&&v.expiresAt.toMillis()>Date.now()).sort((a,b)=>(b.createdAt||0)-(a.createdAt||0));
  if(act.length){
    const l=mkEl("div","cplog");
    act.forEach(v=>{const r=mkEl("div","rc"),d=new Date(v.expiresAt.toMillis()+8*3600e3);
      r.append(mkEl("span","",`${v.byName||"家人"} 產生的連結・${d.getUTCMonth()+1}/${d.getUTCDate()} 到期`));
      const x=mkEl("button","x","停用");x.type="button";x.onclick=()=>DB.doc(`households/${hid}/invites/${v.id}`).delete().catch(()=>{});r.appendChild(x);l.appendChild(r)});
    c.appendChild(l);
  }
  c.appendChild(mkEl("div","bdgrp","離開"));
  const others2=Object.keys(members).filter(x=>x!==myId);
  const lb=mkEl("button","ghost",owner&&!others2.length?"刪除這個家":"離開這個家");lb.type="button";
  if(owner&&others2.length){lb.disabled=true;c.appendChild(mkEl("p","sub","你是擁有者。要離開的話，先把擁有者轉給其他家人。"))}
  lb.onclick=()=>openForm({title:owner&&!others2.length?`刪除「${hhName()}」？`:`離開「${hhName()}」？`,sub:owner&&!others2.length?"全家的帳會一起刪除，不能復原。你自己的帳不受影響。":"離開後看不到全家的帳，家人也看不到你分享的帳。你自己的帳不受影響。",fields:[],okLabel:owner&&!others2.length?"刪除":"離開",onSave:()=>leaveHousehold(hid)});
  c.appendChild(lb);
}
async function wipeLedger(ref){
  for(const k of["expenses","incomes","coupons","photos"]){
    const sn=await ref.collection(k).get();const docs=sn.docs||[];
    for(let i=0;i<docs.length;i+=300){const b=DB.batch();docs.slice(i,i+300).forEach(d=>b.delete(ref.collection(k).doc(d.id)));await b.commit()}
  }
  await ref.delete();
}
async function hhInfo(id){
  let hd=null,ms=[];
  try{const s2=await DB.doc(`households/${id}`).get();hd=s2.exists?s2.data():null}catch(e){}
  try{const m=await DB.collection(`households/${id}/members`).get();ms=m.docs.map(d=>d.id)}catch(e){}
  return{owner:!!hd&&hd.owner===myId,alone:!ms.some(x=>x!==myId)};
}
async function leaveHousehold(id,silent){
  const {owner,alone}=await hhInfo(id);
  if(owner&&!alone)throw new Error("owner");
  leaving=id;if(hid===id)hhStop();
  try{await leaveSteps(id,owner,alone)}catch(e){leaving=null;if(hid===id)pickHousehold(id);throw e}
  leaving=null;
  const hids=(profile.hids||[]).filter(x=>x!==id);await saveProfile({hids,cur:hids[0]||""});
  if(silent)return;
  pickHousehold(hids[0]||"");if(curKey==="fam")enterLedger("me");else render();
  toast(owner&&alone?"已刪除":"已離開");
}
async function leaveSteps(id,owner,alone){
  if(owner&&alone){
    await wipeLedger(DB.doc(`households/${id}/ledgers/main`)).catch(()=>{});
    for(const k of["invites","contrib","shares"]){try{const sn=await DB.collection(`households/${id}/${k}`).get();for(const d of sn.docs)await DB.doc(`households/${id}/${k}/${d.id}`).delete()}catch(e){}}
    await DB.doc(`households/${id}/members/${myId}`).delete().catch(()=>{});
    await DB.doc(`households/${id}`).delete().catch(()=>{});
  }else{
    await DB.doc(`households/${id}/shares/${myId}`).delete().catch(()=>{});
    await DB.doc(`households/${id}/members/${myId}`).delete();
  }
}

// ---- join with an invite link ----
async function prepareJoin(){
  const [h,t]=JOIN.split(".");joinInfo={h,t,state:"loading"};render();
  if(!h||!t){joinInfo.state="bad";render();return}
  if((profile.hids||[]).includes(h)){finishJoin(h,"");return}
  try{
    const sn=await DB.doc(`households/${h}/invites/${t}`).get();
    if(!sn.exists)joinInfo.state="bad";
    else{const d=sn.data(),exp=d.expiresAt&&d.expiresAt.toMillis?d.expiresAt.toMillis():0;joinInfo={h,t,state:exp<Date.now()?"expired":"ready",hname:d.hname||"家人的家",byName:d.byName||"家人"}}
  }catch(e){joinInfo.state="bad"}
  render();
}
function renderJoinCard(){
  const c=$("joinCard");c.innerHTML="";const j=joinInfo;if(!j)return;
  if(j.state==="loading"){c.appendChild(mkEl("p","sub","讀取邀請中…"));return}
  if(j.state!=="ready"){
    c.append(mkEl("h2","",j.state==="expired"?"這個邀請連結過期了":"這個邀請連結不能用"),mkEl("p","sub","請家人在「設定 → 家庭成員與邀請」重新產生一個連結傳給你。"));
    const b=mkEl("button","","先進入我的帳");b.type="button";b.onclick=()=>{joinDone=true;joinInfo=null;history.replaceState(null,"",SITE_URL);startLedgers()};c.appendChild(b);return;
  }
  c.append(mkEl("h2","",`${j.byName}邀請你加入「${j.hname}」`),mkEl("p","sub","加入以後可以一起記「全家的帳」，也能選擇要不要分享自己的帳給家人看。你自己的帳只有你看得到。"));
  const l=mkEl("label","jl","在這個家你叫什麼？");const inp=document.createElement("input");inp.value=(profile&&profile.name)||"";inp.placeholder="例如 媽媽、姐姐、弟弟";inp.maxLength=20;l.appendChild(inp);c.appendChild(l);
  const r=mkEl("div","bt"),ok=mkEl("button","","加入"),no=mkEl("button","ghost","先不要");ok.type=no.type="button";const msg=mkEl("small","m");
  ok.onclick=async()=>{const n=inp.value.trim();if(!n){msg.textContent="請填一個稱呼";return}ok.disabled=true;try{await doJoin(n)}catch(e){msg.textContent="加入失敗，連結可能過期了，請家人再傳一次";ok.disabled=false}};
  no.onclick=()=>{joinDone=true;joinInfo=null;history.replaceState(null,"",SITE_URL);startLedgers()};
  r.append(ok,no,msg);c.appendChild(r);
}
async function doJoin(name){
  const {h,t,hname}=joinInfo;
  await DB.doc(`households/${h}/members/${myId}`).set({name,photo:(me&&me.photoURL)||"",invite:t,joinedAt:Date.now()});
  await saveProfile({hids:[...new Set([...(profile.hids||[]),h])],cur:h});
  finishJoin(h,hname);
}
function finishJoin(h,hname){
  joinDone=true;joinInfo=null;history.replaceState(null,"",SITE_URL);
  if(profile.cur!==h)saveProfile({cur:h});
  pickHousehold(h);enterLedger("me");toast(hname?`已加入「${hname}」🎉`:"你已經在這個家裡了");
}

// ---- account ----
function renderAccount(){
  const c=$("acctCard");c.innerHTML="";if(!me)return;
  const r=mkEl("div","mem");r.appendChild(avatarEl({photo:me.photoURL,name:me.displayName||myName()}));
  const w=mkEl("div","mwho");w.append(mkEl("b","",me.displayName||myName()),mkEl("small","",me.email||""));r.appendChild(w);c.appendChild(r);
  const lo=mkEl("button","ghost","登出");lo.type="button";lo.onclick=()=>fbAuth.signOut();
  const row=mkEl("div","bt");row.appendChild(lo);c.appendChild(row);
  c.appendChild(mkEl("div","bdgrp","刪除帳號"));
  c.appendChild(mkEl("p","sub","會刪除你的帳、照片、生日名單和設定，並離開所有家庭。刪除後不能復原；想留著資料，先到「匯出與備份」下載備份檔。")).style.margin="0 0 8px";
  const del=mkEl("button","ghost","刪除我的帳號和資料");del.type="button";const msg=mkEl("small","m");
  del.onclick=()=>openForm({title:"確定要刪除帳號和所有資料？",sub:"這個動作不能復原。",fields:[],okLabel:"刪除",onSave:async()=>{try{await deleteAccount()}catch(e){msg.textContent=e&&e.message==="owner"?"你是某個家的擁有者，請先把擁有者轉給其他家人":"刪除失敗，請重新登入後再試";throw e}}});
  const r2=mkEl("div","bt");r2.append(del,msg);c.appendChild(r2);
  const p=mkEl("p","sub");p.style.marginTop="14px";const a=document.createElement("a");a.href="privacy.html";a.textContent="隱私權說明";p.appendChild(a);c.appendChild(p);
}
async function deleteAccount(){
  for(const h of profile.hids||[]){const i=await hhInfo(h);if(i.owner&&!i.alone)throw new Error("owner")}
  stopSubs();hhStop();
  for(const h of(profile.hids||[]).slice()){try{await leaveHousehold(h,true)}catch(e){}}
  await wipeLedger(DB.doc(`users/${myId}/ledgers/main`)).catch(()=>{});
  {const nc=DB.collection(`users/${myId}/notes`),sn=await nc.get().catch(()=>({docs:[]}));
   for(const d of sn.docs||[]){const ic=nc.doc(d.id).collection("imgs"),si=await ic.get().catch(()=>({docs:[]}));for(const x of si.docs||[])await ic.doc(x.id).delete().catch(()=>{});await nc.doc(d.id).delete().catch(()=>{})}}
  for(const p of["prefs/bdays","prefs/ui","prefs/memo"])await DB.doc(`users/${myId}/${p}`).delete().catch(()=>{});
  await DB.doc(`users/${myId}`).delete().catch(()=>{});
  try{await me.delete()}catch(e){if(e&&e.code==="auth/requires-recent-login"){await me.reauthenticateWithPopup(new firebase.auth.GoogleAuthProvider());await me.delete()}else throw e}
}

// ---- landing / sign-in gate ----
function renderGate(){
  const out=authState==="out"||authState==="nocfg";
  $("landing").hidden=!out;
  $("joinHint").hidden=!(out&&JOIN);
  $("inapp").hidden=!(INAPP&&out);
  $("nocfg").hidden=authState!=="nocfg";
  document.querySelectorAll(".loginBtn").forEach(b=>{b.disabled=authState==="nocfg"});
  const jc=$("joinCard");jc.hidden=!(joinInfo&&!out);if(!jc.hidden)renderJoinCard();
  if(!out&&!curKey&&!joinInfo&&authState!=="init"){$("status").hidden=false;$("status").textContent="載入中…"}
  document.body.classList.toggle("signedout",out);
}
async function login(){
  $("loginMsg").textContent="";
  const p=new firebase.auth.GoogleAuthProvider();p.setCustomParameters({prompt:"select_account"});
  try{await fbAuth.signInWithPopup(p)}
  catch(e){
    if(e&&["auth/popup-blocked","auth/operation-not-supported-in-this-environment","auth/web-storage-unsupported"].includes(e.code)){try{await fbAuth.signInWithRedirect(p)}catch(e2){loginErr(e2)}}
    else loginErr(e);
  }
}
function loginErr(e){
  const c=(e&&e.code)||"";if(!c||c==="auth/popup-closed-by-user"||c==="auth/cancelled-popup-request")return;
  $("loginMsg").textContent=c==="auth/unauthorized-domain"?"這個網址還沒加到 Firebase 的授權網域。":c==="auth/network-request-failed"?"網路連線有問題，請再試一次。":c==="auth/disallowed-useragent"?"這個 App 內建的瀏覽器不能用 Google 登入，請改用 Safari 或 Chrome 打開。":"登入失敗（"+c+"），請再試一次。";
}
function stopAll(){stopSubs();notesReset();hhStop();clearTimeout(pubTimer);curKey=null;loaded=false;settings=null;expenses=[];incomes=[];coupons=[];bdays=[];curPrefs=null;hid=null;household=null;members={};others={};goal=null;contribs=[];view="home";setSub=null;applyBg("")}
async function onUser(u){
  stopAll();me=u||null;joinInfo=null;
  if(!u){myId=null;profile=null;authState="out";render();return}
  myId=u.uid;authState="loading";render();
  try{
    const ref=DB.doc(`users/${myId}`),sn=await ref.get();
    profile=sn.exists?sn.data():null;
    if(!profile){profile={name:u.displayName||"我",photo:u.photoURL||"",hids:[],cur:"",createdAt:Date.now()};await ref.set(profile)}
    else if(u.photoURL&&profile.photo!==u.photoURL)ref.update({photo:u.photoURL}).catch(()=>{});
  }catch(e){$("status").hidden=false;$("status").textContent="讀取帳號資料失敗，請重新整理。";return}
  authState="in";
  if(JOIN&&!joinDone){await prepareJoin();return}
  startLedgers();
}
function startLedgers(){
  const hids=profile.hids||[];pickHousehold(hids.includes(profile.cur)?profile.cur:(hids[0]||""));
  enterLedger("me");
}
function bootFirebase(){
  const cfg=window.FIREBASE_CONFIG||{};
  if(!window.firebase||!cfg.apiKey||/^YOUR_/.test(cfg.apiKey)){authState="nocfg";render();return}
  try{
    firebase.initializeApp(cfg);fbAuth=firebase.auth();DB=firebase.firestore();
    try{DB.settings({ignoreUndefinedProperties:true})}catch(e){}
    try{const pp=DB.enablePersistence&&DB.enablePersistence({synchronizeTabs:true});if(pp&&pp.catch)pp.catch(()=>{})}catch(e){}
    fbAuth.getRedirectResult().catch(loginErr);
    fbAuth.onAuthStateChanged(onUser);
  }catch(e){authState="nocfg";render()}
}

// ---- wiring ----
$("backBtn").onclick=()=>{view="home";cur=today().slice(0,7);$("vdate").value=today();sstate=null;setupOpen=false;render()};
document.querySelectorAll(".loginBtn").forEach(b=>{b.onclick=login});
$("copyUrl").onclick=async()=>{toast(await copyText(location.href)?"已複製網址，貼到 Safari 或 Chrome 打開":"請長按網址列複製")};
[...$("ledgerSw").children].forEach(b=>{b.onclick=()=>{if(b.dataset.k!==curKey)enterLedger(b.dataset.k)}});
$("acctBtn").onclick=()=>{view="set";setSub="account";sstate=null;render();window.scrollTo(0,0)};
$("hAllowBox").onclick=editAllowance;$("hAllowBox").onkeydown=e=>{if(e.key==="Enter")editAllowance()};
$("tabCal").onclick=()=>{view="cal";const t=today();calY=+t.slice(0,4);calM=+t.slice(5,7);calSel=t;render();window.scrollTo(0,0)};
initNotes();
$("tabSet").onclick=()=>{view="set";setSub=null;sstate=null;setupOpen=false;render();window.scrollTo(0,0)};
$("tabRec").onclick=()=>{view="home";cur=today().slice(0,7);$("vdate").value=today();sstate=null;setupOpen=false;render();window.scrollTo(0,0)};
$("add").date.value=today();$("vdate").value=today();
setupEvents();setupVoice();
$("add").onsubmit=async ev=>{ev.preventDefault();const f=ev.target;if(!col)return;
  try{await col.add({...byFields(),date:f.date.value,month:f.date.value.slice(0,7),category:f.category.value,amount:+f.amount.value,note:f.note.value.trim(),remark:f.remark.value.trim()});f.amount.value="";f.note.value="";f.remark.value=""}catch(e){}
};
setQuote();setDate();
render();
bootFirebase();
