// ---- 讀經：像小說 App 的書架、選集數、沉浸式閱讀 ----
// 經文文字在 books/（由下載的 PDF 轉出，只調整換行，不改任何字）；閱讀進度與版面設定存在 prefs/ui.read
let rdIdx=null,rdBook=null,rdRange=0,rdCur=null,rdBar=true,rdSaveT=null,rdRestoring=false;
const RD_COVER={gy:["#7a1f1f","#c0392b","太上感應篇"],dzg:["#1f5c55","#2f8f83","弟子規"],wls:["#2b3a67","#b08d3c","無量壽經"],sx:["#4a3a6b","#8a6fb5","十善業道經"]};
const RD_THEMES=[["paper","米黃"],["white","白"],["green","護眼綠"],["night","夜間"]];
const rdPref=()=>{const c=(curPrefs&&curPrefs.read)||{};let l={};try{l=JSON.parse(localStorage.getItem("fl_read_"+myId)||"{}")}catch(e){}
  const prog={...(c.prog||{})};for(const k in (l.prog||{}))if(!prog[k]||(l.prog[k].ts||0)>(prog[k].ts||0))prog[k]=l.prog[k];
  return Object.assign({size:19,lh:1.9,theme:"paper",font:"serif"},l,c,{prog})};
function rdFlush(){clearTimeout(rdSaveT);rdSaveT=null;const r=rdPref();try{localStorage.setItem("fl_read_"+myId,JSON.stringify(r))}catch(e){}if(prefsRef)prefsRef.set({read:r},{merge:true}).catch(()=>{})}
async function rdSet(patch){const r={...rdPref(),...patch};curPrefs={...(curPrefs||{}),read:r};try{localStorage.setItem("fl_read_"+myId,JSON.stringify(r))}catch(e){}clearTimeout(rdSaveT);rdSaveT=setTimeout(rdFlush,600)}
async function rdLoadIdx(){if(rdIdx)return rdIdx;const r=await fetch("books/index.json?v=2");rdIdx=await r.json();return rdIdx}
const rdWan=n=>n>=10000?(n/10000).toFixed(1)+" 萬字":n+" 字";
function rdCover(id,small){const c=RD_COVER[id]||["#555","#888",""];const d=mkEl("div","rdcover"+(small?" sm":""));d.style.background=`linear-gradient(160deg,${c[1]},${c[0]})`;d.appendChild(mkEl("span",null,c[2]));return d}
function goRead(){view="read";rdBook=null;render();window.scrollTo(0,0)}
async function renderRead(){
  const box=$("rdMain");
  if(!rdIdx){box.innerHTML="";box.appendChild(mkEl("p","sub","載入中…"));try{await rdLoadIdx()}catch(e){box.innerHTML="";box.appendChild(mkEl("p","sub","讀不到經文目錄，請檢查網路後再試一次。"));return}}
  $("rdHelp").hidden=!!rdBook;
  rdBook?renderBook():renderShelf();
}
function renderShelf(){
  const box=$("rdMain");box.innerHTML="";const pr=rdPref().prog||{};
  rdIdx.books.forEach(b=>{
    const words=b.eps.reduce((t,e)=>t+(e[2]||0),0),have=b.eps.length,done=!!b.total&&have>=b.total,p=pr[b.id];
    const r=mkEl("button","rdbook");r.type="button";r.dataset.id=b.id;
    const info=mkEl("div","rdinfo");
    info.append(mkEl("h3",null,b.name),mkEl("p","rdau","主講："+b.author));
    const tags=mkEl("div","rdtags");tags.append(mkEl("span","t1",rdWan(words)),mkEl("span","t2",done?"全集":"更新中"));info.appendChild(tags);
    info.appendChild(mkEl("p","rdlast",p&&p.n?`讀到：第 ${p.n} 集${p.pos>0.01?`・${Math.round(p.pos*100)}%`:""}`:(b.total?`共 ${b.total} 集${done?"":`・已收 ${have} 集`}`:`已收 ${have} 集`)));
    r.append(rdCover(b.id),info);r.onclick=()=>{rdBook=b.id;rdRange=p&&p.n?Math.floor((p.n-1)/20):0;renderRead();window.scrollTo(0,0)};box.appendChild(r);
  });
}
function renderBook(){
  const b0=rdIdx.books.find(x=>x.id===rdBook),box=$("rdMain");box.innerHTML="";if(!b0){rdBook=null;return renderShelf()}
  const b={...b0,total:b0.total||Math.max(0,...b0.eps.map(e=>e[0]))};
  const pr=(rdPref().prog||{})[b.id],have=new Set(b.eps.map(e=>e[0])),dates={};b.eps.forEach(e=>{dates[e[0]]=e[1]});
  const top=mkEl("div","rdbhead");const back=mkEl("button","ghost sm","‹ 書架");back.type="button";back.id="rdBack";back.onclick=()=>{rdBook=null;renderRead()};
  const hi=mkEl("div","rdinfo");hi.append(mkEl("h3",null,b.name),mkEl("p","rdau",`主講：${b.author}・${b0.total?"共":"已收"} ${b.total} 集`));
  top.append(rdCover(b.id,true),hi);box.append(back,top);
  const go=mkEl("button","rdgo",pr&&pr.n?`繼續閱讀　第 ${pr.n} 集${pr.pos>0.01?`（${Math.round(pr.pos*100)}%）`:""}`:"從第 1 集開始讀");go.type="button";go.id="rdContinue";go.onclick=()=>openEp(b.id,pr&&pr.n||b.eps[0][0]);box.appendChild(go);
  box.appendChild(mkEl("h2","rdsec","選集數"));
  const rg=mkEl("div","rdranges");const N=Math.ceil(b.total/20);
  for(let i=0;i<N;i++){const a=i*20+1,z=Math.min(b.total,a+19),c=mkEl("button","rdr"+(i===rdRange?" on":""),`${a}–${z}`);c.type="button";c.onclick=()=>{rdRange=i;renderBook()};rg.appendChild(c)}
  box.appendChild(rg);
  const g=mkEl("div","rdeps");const a=rdRange*20+1,z=Math.min(b.total,a+19);
  for(let n=a;n<=z;n++){const ok=have.has(n),c=mkEl("button","rdep"+(pr&&pr.n===n?" on":"")+(ok?"":" off"));c.type="button";c.dataset.n=n;
    c.append(mkEl("b",null,String(n)),mkEl("small",null,ok?(dates[n]||""):"還沒收錄"));c.disabled=!ok;c.onclick=()=>openEp(b.id,n);g.appendChild(c)}
  box.appendChild(g);
}
// ---- 閱讀畫面 ----
function rdApply(){const p=rdPref(),o=$("rdOver");o.dataset.theme=p.theme;o.style.setProperty("--rdsize",p.size+"px");o.style.setProperty("--rdlh",p.lh);o.dataset.font=p.font;
  $("rdSizeV").textContent=p.size;document.querySelectorAll("#rdThemes button").forEach(b=>b.classList.toggle("on",b.dataset.t===p.theme));
  document.querySelectorAll("#rdFonts button").forEach(b=>b.classList.toggle("on",b.dataset.f===p.font));document.querySelectorAll("#rdLh button").forEach(b=>b.classList.toggle("on",+b.dataset.l===p.lh))}
async function openEp(id,n){
  const b0=rdIdx.books.find(x=>x.id===id),b={...b0,total:b0.total||Math.max(0,...b0.eps.map(e=>e[0]))};const o=$("rdOver"),tx=$("rdText");
  o.hidden=false;document.body.classList.add("rdlock");rdApply();rdBar=true;o.classList.add("rdui");$("rdSet").hidden=true;
  rdCur=null;$("rdTitle").textContent=`${b.name}・第 ${n} 集`;tx.innerHTML="";tx.appendChild(mkEl("p","rdload","載入中…"));
  let j;try{const r=await fetch(`books/${id}/${n}.json?v=1`);j=await r.json()}catch(e){tx.innerHTML="";tx.appendChild(mkEl("p","rdload","讀不到這一集，請檢查網路後再試一次。"));return}
  rdCur={id,n,b};tx.innerHTML="";
  const h=mkEl("header","rdhd");h.append(mkEl("h1",null,`第 ${n} 集`),mkEl("p",null,[b.name,j.date,j.place].filter(Boolean).join("・")));tx.appendChild(h);
  j.p.forEach(s=>tx.appendChild(mkEl("p",null,s)));
  const nav=mkEl("div","rdnav"),pv=mkEl("button","ghost",n>1?"‹ 上一集":"已是第一集"),nx=mkEl("button",null,n<b.total?"下一集 ›":"已經讀完了");pv.type=nx.type="button";
  const has=k=>b.eps.some(e=>e[0]===k);pv.disabled=!has(n-1);nx.disabled=!has(n+1);pv.id="rdPrev";nx.id="rdNext";
  pv.onclick=()=>openEp(id,n-1);nx.onclick=()=>openEp(id,n+1);nav.append(pv,nx);tx.appendChild(nav);
  tx.appendChild(mkEl("p","rdsrc",`文字來源：淨空老法師專集網 amtb.tw（${j.code}）`));
  const pr=rdPref().prog||{},last=pr[id];const pos=last&&last.n===n?last.pos||0:0;
  rdRestoring=true;o.scrollTop=0;
  const go=()=>{o.scrollTop=pos*(o.scrollHeight-o.clientHeight);rdProg()};
  requestAnimationFrame(()=>{go();setTimeout(()=>{go();rdRestoring=false;if(pos>0.01){const m=$("rdResume");m.textContent=`接著上次的地方（${Math.round(pos*100)}%）`;m.hidden=false;clearTimeout(m._t);m._t=setTimeout(()=>{m.hidden=true},2500)}},250)});
  rdSet({prog:{...pr,[id]:{n,pos,ts:Date.now()}}});
}
function rdProg(){const o=$("rdOver");const f=o.scrollHeight>o.clientHeight?o.scrollTop/(o.scrollHeight-o.clientHeight):1;$("rdBarFill").style.width=Math.round(f*100)+"%";$("rdPct").textContent=Math.round(f*100)+"%";return f}
function closeEp(){rdFlush();$("rdOver").hidden=true;document.body.classList.remove("rdlock");rdCur=null;if(view==="read")renderRead()}
function initRead(){
  $("tabRead").onclick=()=>{if(typeof flushText==="function")flushText();if(typeof flushDiary==="function")flushDiary();goRead()};
  const o=$("rdOver");
  o.addEventListener("scroll",()=>{const f=rdProg();if(rdCur&&!rdRestoring){const pr=rdPref().prog||{};rdSet({prog:{...pr,[rdCur.id]:{n:rdCur.n,pos:Math.round(f*1000)/1000,ts:Date.now()}}})}if(rdBar&&!$("rdSet").hidden)return;if(rdBar){rdBar=false;o.classList.remove("rdui")}},{passive:true});
  $("rdText").onclick=e=>{if(e.target.closest("button"))return;rdBar=!rdBar;o.classList.toggle("rdui",rdBar);if(!rdBar)$("rdSet").hidden=true};
  $("rdClose").onclick=closeEp;
  $("rdSetBtn").onclick=()=>{$("rdSet").hidden=!$("rdSet").hidden};
  $("rdSmaller").onclick=()=>{rdSet({size:Math.max(14,rdPref().size-1)});rdApply()};
  $("rdBigger").onclick=()=>{rdSet({size:Math.min(30,rdPref().size+1)});rdApply()};
  document.querySelectorAll("#rdThemes button").forEach(b=>b.onclick=()=>{rdSet({theme:b.dataset.t});rdApply()});
  document.querySelectorAll("#rdFonts button").forEach(b=>b.onclick=()=>{rdSet({font:b.dataset.f});rdApply()});
  document.querySelectorAll("#rdLh button").forEach(b=>b.onclick=()=>{rdSet({lh:+b.dataset.l});rdApply()});
  document.addEventListener("keydown",e=>{if(!$("rdOver").hidden&&e.key==="Escape")closeEp()});
  // 跳出 App、關掉分頁前，馬上把讀到的位置存起來
  document.addEventListener("visibilitychange",()=>{if(document.visibilityState==="hidden"&&rdSaveT)rdFlush()});
  window.addEventListener("pagehide",()=>{if(rdSaveT)rdFlush()});
}
