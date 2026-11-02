// A tiny in-browser stand-in for the Firebase compat SDK, used only by tests/run.js.
// Data lives in localStorage so a reload (e.g. opening an invite link) keeps it.
(function(){
  const LS="__mockstore",LU="__mockuser";
  let store={};try{store=JSON.parse(localStorage.getItem(LS)||"{}")}catch(e){}
  window.__store=store;
  const subs=[];
  class Timestamp{constructor(ms){this.__ts=ms}toMillis(){return this.__ts}static fromMillis(ms){return new Timestamp(ms)}}
  const enc=o=>o==null?o:JSON.parse(JSON.stringify(o));
  const dec=o=>{if(o&&typeof o==="object"){if(typeof o.__ts==="number")return new Timestamp(o.__ts);for(const k in o)o[k]=dec(o[k])}return o};
  const save=()=>{try{localStorage.setItem(LS,JSON.stringify(store))}catch(e){}};
  // like Firestore, listeners hear about writes asynchronously, not inside the write call
  let pending=false;const notify=()=>{save();if(pending)return;pending=true;setTimeout(()=>{pending=false;subs.slice().forEach(f=>{try{f()}catch(e){console.error(e)}})},0)};
  function snapDoc(path){const ex=path in store;return{exists:ex,id:path.split("/").pop(),data:()=>ex?dec(enc(store[path])):undefined}}
  function docsOf(p){const n=p.split("/").length+1;return Object.keys(store).filter(k=>k.startsWith(p+"/")&&k.split("/").length===n).sort().map(snapDoc)}
  const listen=f=>{subs.push(f);setTimeout(f,0);return()=>{const i=subs.indexOf(f);if(i>=0)subs.splice(i,1)}};
  let n=0;const rid=()=>"m"+(++n).toString(36)+Math.random().toString(36).slice(2,8);
  function mkdoc(path){return{path,id:path.split("/").pop(),
    get:async()=>snapDoc(path),
    set:async(d,o)=>{store[path]=o&&o.merge?Object.assign({},store[path]||{},enc(d)):enc(d);notify()},
    update:async d=>{if(!(path in store))throw Object.assign(new Error("no doc"),{code:"not-found"});Object.assign(store[path],enc(d));notify()},
    delete:async()=>{delete store[path];notify()},
    onSnapshot:(next)=>listen(()=>next(snapDoc(path))),
    collection:c=>mkcol(path+"/"+c)}}
  function mkcol(p){return{path:p,doc:id=>mkdoc(p+"/"+(id||rid())),
    add:async d=>{const r=mkdoc(p+"/"+rid());await r.set(d);return r},
    get:async()=>({docs:docsOf(p)}),
    onSnapshot:(next)=>listen(()=>next({docs:docsOf(p)}))}}
  const batch=()=>{const ops=[];return{set:(r,d,o)=>ops.push(()=>r.set(d,o)),update:(r,d)=>ops.push(()=>r.update(d)),delete:r=>ops.push(()=>r.delete()),commit:async()=>{for(const f of ops)await f()}}};
  const db={doc:mkdoc,collection:mkcol,batch,settings(){},enablePersistence:async()=>{}};
  const ls=[];
  const mkUser=(uid,name)=>({uid,displayName:name,email:uid+"@example.com",photoURL:"",
    delete:async()=>{localStorage.removeItem(LU);user=null;ls.forEach(f=>f(null))},reauthenticateWithPopup:async()=>{}});
  let user=null;try{const u=JSON.parse(localStorage.getItem(LU)||"null");if(u)user=mkUser(u.uid,u.name)}catch(e){}
  const setUser=u=>{user=u;if(u)localStorage.setItem(LU,JSON.stringify({uid:u.uid,name:u.displayName}));else localStorage.removeItem(LU);ls.forEach(f=>f(u))};
  const auth={get currentUser(){return user},
    onAuthStateChanged(f){ls.push(f);setTimeout(()=>f(user),0);return()=>{}},
    getRedirectResult:async()=>null,
    signInWithPopup:async()=>{const nx=JSON.parse(localStorage.getItem("__nextuser")||'{"uid":"u1","name":"測試弟弟"}');const u=mkUser(nx.uid,nx.name);setUser(u);return{user:u}},
    signInWithRedirect:async()=>{},
    signOut:async()=>setUser(null)};
  const firebase={initializeApp(){},auth:()=>auth,firestore:()=>db};
  firebase.auth.GoogleAuthProvider=function(){this.setCustomParameters=()=>{}};
  firebase.firestore.Timestamp=Timestamp;
  window.firebase=firebase;
})();
