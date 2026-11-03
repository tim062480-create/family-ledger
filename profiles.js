// ---- 選擇使用者（誰要記帳？）＋ 自訂頭像 ----
// 頭像：profile.avatar（自己上傳的小圖，data URL）、profile.avc（預設笑臉的顏色 0–5）。
// 同一個家的成員資料 households/{hid}/members/{uid} 也存一份 avatar／avc，家人才看得到。
// 待邀請：households/{hid}.pending = [{id,name,avatar,avc}]，邀請連結帶 pid，對方加入時直接變成那一格。
// 這台裝置記得的使用者：localStorage fl_devprof，登出後也能看到自己的格子，點了就登入。
const AV_COLORS=[["#2f7cf6","#5aa2ff"],["#0f3b4f","#3c6f86"],["#e0262d","#f45a5f"],["#e8a60c","#f5c84b"],["#22b36b","#5fd39a"],["#8a5cf6","#b292ff"]];
const DEV_KEY="fl_devprof";
let whoEdit=false,whoForceLanding=false;
const avcOf=(p,id)=>{if(p&&Number.isInteger(p.avc))return p.avc;let h=0;String(id||(p&&p.name)||"").split("").forEach(c=>{h=(h*31+c.charCodeAt(0))>>>0});return h%AV_COLORS.length};
function faceEl(p,id,cls){
  const a=mkEl("span",cls||"av");
  if(p&&p.avatar){const im=document.createElement("img");im.src=p.avatar;im.alt="";a.appendChild(im);return a}
  const [c1,c2]=AV_COLORS[avcOf(p,id)];a.style.background=`linear-gradient(160deg,${c1},${c2})`;
  a.innerHTML='<svg viewBox="0 0 100 100" aria-hidden="true" style="width:62%;height:62%"><circle cx="30" cy="38" r="7" fill="#fff"/><circle cx="70" cy="38" r="7" fill="#fff"/><path d="M26 62 Q50 80 74 62" stroke="#fff" stroke-width="7" fill="none" stroke-linecap="round"/></svg>';
  return a;
}
const myFace=()=>({name:myName(),avatar:(profile&&profile.avatar)||"",avc:profile&&profile.avc});
function devProfiles(){try{const v=JSON.parse(localStorage.getItem(DEV_KEY)||"[]");return Array.isArray(v)?v.filter(x=>x&&x.uid):[]}catch(e){return[]}}
function saveDevProfiles(list){try{localStorage.setItem(DEV_KEY,JSON.stringify(list.slice(0,6)))}catch(e){}}
function rememberMe(){if(!myId)return;const l=devProfiles().filter(x=>x.uid!==myId);l.unshift({uid:myId,name:myName(),avatar:(profile&&profile.avatar)||"",avc:profile&&profile.avc,email:(me&&me.email)||""});saveDevProfiles(l)}
const picked=()=>{try{return sessionStorage.getItem("fl_picked")===myId}catch(e){return true}};
function setPicked(v){if(v)whoAsk=false;try{if(v)sessionStorage.setItem("fl_picked",myId);else sessionStorage.removeItem("fl_picked")}catch(e){}}
const needWho=()=>!!(me&&curKey&&loaded&&(settings||whoAsk)&&!picked()&&!joinInfo);let whoAsk=false;

// 每次打開網站（這個分頁第一次）先選人；signedOut：這台裝置記得的人
function renderWho(mode){
  const c=$("who");c.innerHTML="";c.hidden=false;
  c.appendChild(mkEl("h2",null,mode==="out"?"選擇使用者":"誰要記帳？"));
  c.appendChild(mkEl("p","sub",mode==="out"?"點自己的頭像登入":whoEdit?"點一個人來修改；改完按「完成」":"點自己的頭像，開始記你的帳"));
  const g=mkEl("div",null);g.id="whoBtns";c.appendChild(g);
  const tile=(face,name,badge,fn,label)=>{const b=mkEl("button","tile"+(whoEdit?" edit":""));b.type="button";b.appendChild(face);b.appendChild(mkEl("span","nm",name));if(badge)b.appendChild(mkEl("span","bd",badge));b.setAttribute("aria-label",label||name);b.onclick=fn;g.appendChild(b);return b};
  if(mode==="out"){
    devProfiles().forEach(p=>tile(faceEl(p,p.uid),p.name||"我",whoEdit?"從這台裝置移除":"",()=>{if(whoEdit){saveDevProfiles(devProfiles().filter(x=>x.uid!==p.uid));render();return}try{sessionStorage.setItem("fl_picked",p.uid)}catch(e){}login()},`${p.name||"我"}，用 Google 登入`));
    if(!whoEdit)tile(addFace(),"其他帳號","",()=>login(),"用其他 Google 帳號登入");
    tile(editFace(),whoEdit?"完成":"編輯","",()=>{whoEdit=!whoEdit;render()});
    const a=mkEl("button","ghost sm whoLand","看看家庭記帳本是什麼");a.type="button";a.onclick=()=>{whoForceLanding=true;render()};c.appendChild(a);
    return;
  }
  // 自己
  tile(faceEl(myFace(),myId),myName(),whoEdit?"修改":(profile&&profile.pinHash?"🔒":""),()=>{if(whoEdit){editMe();return}askPin(()=>{setPicked(true);view="home";render();window.scrollTo(0,0);offerPin()})});
  // 已經加入的家人
  Object.values(members).filter(m=>m.id!==myId).sort((a,b)=>(a.joinedAt||0)-(b.joinedAt||0)).forEach(m=>{
    const lv=others[m.id]&&others[m.id].level;
    tile(faceEl(m,m.id),m.name||"家人",whoEdit?"":(lv&&lv!=="none"?"看他分享的帳":"還沒分享"),()=>{if(whoEdit){toast(`${m.name||"家人"}的頭像要他自己改`);return}
      setPicked(true);view="home";if(lv&&lv!=="none"){famSel=m.id;render();setTimeout(()=>{const f=$("fam");if(f)f.scrollIntoView({behavior:"smooth",block:"start"})},80)}else{render();toast(`${m.name||"家人"}還沒有分享帳給你`)}});
  });
  // 待邀請
  ((household&&household.pending)||[]).forEach(p=>tile(faceEl(p,p.id),p.name||"家人",whoEdit?"修改":"待邀請",()=>{if(whoEdit)editPending(p);else invitePending(p)},`${p.name||"家人"}，待邀請`));
  const locked=!!(profile&&profile.whoLocked);
  if(!locked){if(!whoEdit)tile(addFace(),"新增","",addPending,"新增家人");
    tile(editFace(),whoEdit?"完成":"編輯","",()=>{whoEdit=!whoEdit;render()})}
  const pend=(household&&household.pending)||[];
  if(!whoEdit&&pend.length){const b=mkEl("button","whoAll","📨 一鍵邀請");b.type="button";b.onclick=inviteAll;c.appendChild(b)}
  if(!locked&&!whoEdit){const h=mkEl("button","ghost sm whoLock","不用再新增了");h.type="button";h.onclick=lockWho;c.appendChild(h)}
}
// 一個連結邀請全家：傳到 LINE 群組，每個人點開後選「我是哪一位」
const lineShareUrl=text=>"https://line.me/R/share?text="+encodeURIComponent(text);
async function inviteAll(){
  const pend=((household&&household.pending)||[]).map(p=>({id:p.id,name:p.name,avatar:p.avatar||"",avc:p.avc}));
  let inv;try{inv=await createInvite({group:true,pend})}catch(e){toast("產生邀請失敗，請稍後再試");return}
  const text=`${myName()}邀請大家加入「${hhName()}」的家庭記帳本 🏠\n點開連結、用自己的 Google 帳號登入，選「我是誰」就好：\n${inv.url}`;
  openForm({title:"邀請全家",sub:`連結 7 天內有效，${pend.map(p=>p.name).join("、")}都可以用同一個連結加入。`,okLabel:"傳到 LINE",
    fields:[{key:"lnk",label:"邀請連結",full:true,custom:box=>{
      const u=mkEl("input","invurl");u.readOnly=true;u.value=inv.url;u.onclick=()=>u.select();
      const r=mkEl("div","bt"),cp=mkEl("button","ghost sm","複製邀請訊息");cp.type="button";cp.onclick=async()=>{toast(await copyText(text)?"已複製，貼到家人群組":"請長按連結自己複製")};r.appendChild(cp);
      if(navigator.share){const sh=mkEl("button","ghost sm","其他方式分享…");sh.type="button";sh.onclick=()=>navigator.share({title:"家庭記帳本",text}).catch(()=>{});r.appendChild(sh)}
      box.append(u,r)}}],
    onSave:()=>{window.location.href=lineShareUrl(text)}});
}
function addFace(){const a=mkEl("span","av add");a.textContent="＋";return a}
function editFace(){const a=mkEl("span","av add");a.innerHTML='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" style="width:40%;height:40%"><path d="M4 20h4L19 9a2.8 2.8 0 0 0-4-4L4 16v4z"/><path d="M13.5 6.5l4 4"/></svg>';return a}

// 頭像編輯（放在表單裡）：預覽、選照片、預設笑臉的顏色
function avatarField(init){
  const st={avatar:init.avatar||"",avc:Number.isInteger(init.avc)?init.avc:avcOf(init,init.id)};
  return{key:"av",label:"頭像",full:true,custom:box=>{
    const wrap=mkEl("div","avf"),pv=mkEl("div","avpv"),row=mkEl("div","avsw");
    const draw=()=>{pv.innerHTML="";pv.appendChild(faceEl({avatar:st.avatar,avc:st.avc},"", "av"));
      row.innerHTML="";AV_COLORS.forEach((c,i)=>{const s=mkEl("button","sw"+(!st.avatar&&st.avc===i?" on":""));s.type="button";s.style.background=`linear-gradient(160deg,${c[0]},${c[1]})`;s.setAttribute("aria-label",`笑臉顏色 ${i+1}`);s.onclick=()=>{st.avatar="";st.avc=i;draw()};row.appendChild(s)})};
    const pick=mkEl("button","ghost sm","選照片");pick.type="button";
    const fi=document.createElement("input");fi.type="file";fi.accept="image/*";fi.hidden=true;
    pick.onclick=()=>fi.click();
    fi.onchange=async()=>{const f=fi.files&&fi.files[0];fi.value="";if(!f)return;try{st.avatar=await squareThumb(f,256);draw()}catch(e){toast("這張照片讀不出來")}};
    const btns=mkEl("div","bt");btns.append(pick,fi);
    wrap.append(pv,mkEl("div",null),btns,mkEl("small","m","或選一個顏色的笑臉："),row);draw();box.appendChild(wrap)}, get:()=>({avatar:st.avatar,avc:st.avc})};
}
function squareThumb(file,size){
  return new Promise((res,rej)=>{const fr=new FileReader();fr.onerror=rej;fr.onload=()=>{const img=new Image();img.onerror=rej;img.onload=()=>{
    const s=Math.min(img.width,img.height),c=document.createElement("canvas");c.width=c.height=size;
    c.getContext("2d").drawImage(img,(img.width-s)/2,(img.height-s)/2,s,s,0,0,size,size);res(c.toDataURL("image/jpeg",.82))};img.src=fr.result};fr.readAsDataURL(file)});
}
function editMe(){
  const af=avatarField({...myFace(),id:myId});
  openForm({title:"修改我的頭像和稱呼",sub:hid?"家人會看到這個稱呼和頭像。":"",fields:[{key:"n",label:"稱呼",value:myName(),full:true,placeholder:"例如 弟弟"},af],
    validate:()=>fv("n")?"":"請填稱呼",
    onSave:async()=>{const v=af.get(),n=fv("n").slice(0,20);await saveProfile({avatar:v.avatar,avc:v.avc,name:n});
      for(const h of profile.hids||[])await DB.doc(`households/${h}/members/${myId}`).update({avatar:v.avatar,avc:v.avc,...(h===hid?{name:n}:{})}).catch(()=>{});
      rememberMe();render()}});
}
async function ensureHousehold(){if(hid)return true;await createHousehold(`${myName()}的家`);return !!hid}
function addPending(){
  const af=avatarField({});
  openForm({title:"新增家人",sub:"先幫家人建一格，再傳邀請連結給他；他加入時會直接變成這一格。",fields:[{key:"n",label:"稱呼",value:"",full:true,placeholder:"例如 媽媽、爸爸、姐姐"},af],
    validate:()=>fv("n")?"":"請填稱呼",
    onSave:async()=>{const v=af.get();await ensureHousehold();const p={id:"p"+Date.now().toString(36),name:fv("n").slice(0,20),avatar:v.avatar,avc:v.avc};
      await DB.doc(`households/${hid}`).update({pending:((household&&household.pending)||[]).concat([p])});toast(`已新增「${p.name}」，點他的格子傳邀請連結`)}});
}
function editPending(p){
  const af=avatarField(p);
  openForm({title:`修改「${p.name}」`,fields:[{key:"n",label:"稱呼",value:p.name||"",full:true},af],validate:()=>fv("n")?"":"請填稱呼",
    onSave:()=>{const v=af.get();return DB.doc(`households/${hid}`).update({pending:(household.pending||[]).map(x=>x.id===p.id?{...x,name:fv("n").slice(0,20),avatar:v.avatar,avc:v.avc}:x)})},
    onDelete:()=>DB.doc(`households/${hid}`).update({pending:(household.pending||[]).filter(x=>x.id!==p.id)})});
}
function invitePending(p){
  openForm({title:`邀請${p.name}加入`,sub:`產生一個邀請連結（7 天內有效），用 LINE 或簡訊傳給${p.name}。他點開、用自己的 Google 帳號登入，就會變成這一格。`,fields:[],okLabel:"產生並分享連結",
    onSave:async()=>{const inv=await createInvite({pid:p.id,pname:p.name});const text=`${myName()}邀請你加入「${hhName()}」的家庭記帳本`;
      let shared=false;if(navigator.share){try{await navigator.share({title:"家庭記帳本",text,url:inv.url});shared=true}catch(e){}}
      if(!shared)toast(await copyText(inv.url)?"已複製邀請連結，貼到 LINE 傳給家人":"請到「設定 → 家庭成員與邀請」複製連結")}});
}
// 加入時：邀請連結帶 pid，就把那一格的頭像接過來，並從待邀請拿掉
async function claimPending(h,pid){
  if(!pid)return;try{const sn=await DB.doc(`households/${h}`).get();const hd=sn.exists?sn.data():null;const p=hd&&(hd.pending||[]).find(x=>x.id===pid);if(!p)return;
    await DB.doc(`households/${h}/members/${myId}`).update({avatar:p.avatar||"",avc:Number.isInteger(p.avc)?p.avc:0});
    if(!(profile&&profile.avatar))await saveProfile({avatar:p.avatar||"",avc:p.avc});
    await DB.doc(`households/${h}`).update({pending:(hd.pending||[]).filter(x=>x.id!==pid)})}catch(e){}
}

// ---- 密碼鎖：點自己的頭像時要輸入 4–6 位數字（只存雜湊，不存密碼本身）----
async function pinHash(pin){const b=await crypto.subtle.digest("SHA-256",new TextEncoder().encode(myId+":"+pin));return [...new Uint8Array(b)].map(x=>x.toString(16).padStart(2,"0")).join("")}
function askPin(ok){
  if(!(profile&&profile.pinHash)){ok();return}
  openForm({title:`${myName()}，請輸入密碼`,sub:"",fields:[{key:"pin",label:"密碼",type:"password",inputmode:"numeric",full:true,placeholder:"4–6 位數字"}],okLabel:"進入",
    validate:()=>fv("pin")?"":"請輸入密碼",
    onSave:async()=>{if(await pinHash(fv("pin"))!==profile.pinHash){const e=new Error("pin");e.userMsg="密碼不對，再試一次";$("fs_pin").value="";throw e}ok()}});
  const f=$("fsMsg");if(f){const a=mkEl("button","ghost sm","忘記密碼");a.type="button";a.style.marginLeft="8px";a.onclick=()=>{closeForm();setPicked(false);fbAuth.signOut().then(()=>setTimeout(login,200))};$("fsSub").appendChild(document.createElement("br"));$("fsSub").appendChild(a)}
}
function editPin(){
  const has=!!(profile&&profile.pinHash);
  openForm({title:has?"更改密碼":"設定密碼",sub:"之後在「選擇使用者」點你的頭像，要輸入這組密碼才能進入。這是防止別人用你的手機偷看；忘記的話可以用 Google 重新登入。",
    fields:[{key:"p1",label:"新密碼（4–6 位數字）",type:"password",inputmode:"numeric",full:true},{key:"p2",label:"再輸入一次",type:"password",inputmode:"numeric",full:true}],
    validate:()=>!/^\d{4,6}$/.test(fv("p1"))?"請輸入 4–6 位數字":(fv("p1")!==fv("p2")?"兩次輸入的不一樣":""),
    onSave:async()=>{await saveProfile({pinHash:await pinHash(fv("p1"))});toast("密碼設定好了 🔒");renderAccount()},
    onDelete:has?async()=>{await saveProfile({pinHash:""});toast("已取消密碼");renderAccount()}:null});
  if(has)$("fsDel").textContent="取消密碼";
}

// 家人都加好了：把「新增」「編輯」從選人畫面拿掉，之後到設定再打開
function lockWho(){
  openForm({title:"把「新增」和「編輯」收起來？",sub:"選人畫面會只留下家人的頭像。之後想新增或修改，請到「設定 → 帳號 → 選人畫面」重新打開。",fields:[],okLabel:"收起來",
    onSave:async()=>{await saveProfile({whoLocked:true});whoEdit=false;render();toast("已收起來，之後想修改請到「設定 → 帳號」")}});
}
async function unlockWho(){await saveProfile({whoLocked:false});toast("選人畫面又會顯示「新增」和「編輯」了");renderAccount()}

// 第一次進來（還沒設過密碼、也沒問過）：問一次要不要設密碼
function offerPin(){
  if(!profile||profile.pinHash||profile.pinAsked)return;
  saveProfile({pinAsked:true});
  setTimeout(()=>openForm({title:"要幫你的帳設密碼嗎？",sub:"設了以後，在「誰要記帳？」點你的頭像要輸入密碼，別人拿到你的手機也點不進你的帳。之後也可以到「設定 → 帳號 → 密碼鎖」再設定。",fields:[],okLabel:"好，設定密碼",
    cancelLabel:"先不用",onSave:()=>{setTimeout(editPin,50)}}),300);
}
