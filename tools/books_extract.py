# 把「經文」資料夾裡的講記 PDF 轉成 books/*.json（只重新分段，不改字）。在 Cowork 的 device_bash 裡執行：python3 books_extract.py
import os,re,json,subprocess,sys,glob
ROOT=os.path.expanduser("~/mnt/經文"); OUT=os.path.expanduser("~/work/books")
BOOKS=[("gy","太上感應篇","淨空法師","太上感應篇_淨空法師","19-012",195),
       ("dzg","弟子規","蔡禮旭老師","弟子規_蔡禮旭老師","52-116",41),
       ("wls","無量壽經（淨土大經解演義）","淨空法師","無量壽經_淨土大經解演義_淨空法師","02-039",600),
       ("sx","十善業道經","淨空法師","十善業道經_淨空法師","19-014",0)]
def parse(pdf,code):
    t=subprocess.run(["pdftotext",pdf,"-"],capture_output=True,text=True).stdout
    t=t.replace("\r","")
    t=t.replace("\f","\n")
    lines=t.split("\n")
    acc="";ci=None
    for k,l in enumerate(lines[:40]):
        acc+=re.sub(r"\s","",l)
        if code in acc: ci=k;break
    i=(ci+1) if ci is not None else 0
    while i<len(lines) and len(lines[i].strip())<14: i+=1
    head=[l.strip() for l in lines[:i] if l.strip()]
    hj="".join(head)
    date=(re.search(r"\d{4}/\d{1,2}/\d{1,2}",hj) or [None])[0]
    frags=[]
    for h in head:
        if re.search(r"檔名|\d{4}/\d|第.{1,4}集|^（|^\(|主講|講座|大經解|感應篇|弟子規|業道經|^[\d\-]+$|^）",h):continue
        frags.append(h)
    frags.sort(key=lambda x:1 if re.search(r"(會|院|館|心|堂|林|寺|苑)$",x) else 0)
    place=re.sub(r"檔.{0,2}[:：]?\s*[\d\-]+","","".join(frags))[:30]
    bl=[l.strip() for l in lines[i:] if l.strip()]
    from collections import Counter
    L=Counter(len(l) for l in bl).most_common(1)[0][0] if bl else 30
    paras=[];cur=""
    for l in bl:
        cur+=l
        if len(l)<=L-3 and re.search(r"[。！？」』…）：\]】]$",l):
            paras.append(cur);cur=""
    if cur:paras.append(cur)
    # merge paragraphs that start with closing punctuation (page break mid-sentence)
    out=[]
    for p in paras:
        if out and re.match(r"^[。，、；：？！」』）)…]",p): out[-1]+=p
        else: out.append(p)
    return date,place,out
idx={"books":[]}
only=sys.argv[1:] 
for bid,name,author,folder,pre,total in BOOKS:
    d=os.path.join(OUT,bid);os.makedirs(d,exist_ok=True)
    eps=[]
    files={}
    for f in glob.glob(os.path.join(ROOT,folder,"*","*.pdf"))+glob.glob(os.path.join(ROOT,folder,"*.pdf")):
        m=re.search(re.escape(pre)+r"-(\d{4})\.pdf$",f)
        if m: files[int(m.group(1))]=f
    for n in sorted(files):
        fp=os.path.join(d,f"{n}.json")
        if only and bid not in only: pass
        if not os.path.exists(fp) or os.path.getmtime(fp)<os.path.getmtime(files[n]):
            date,place,paras=parse(files[n],f"{pre}-{n:04d}")
            json.dump({"n":n,"code":f"{pre}-{n:04d}","date":date,"place":place,"p":paras},open(fp,"w",encoding="utf-8"),ensure_ascii=False,separators=(",",":"))
        j=json.load(open(fp,encoding="utf-8"))
        eps.append([n,j["date"] or "",sum(len(x) for x in j["p"])])
    idx["books"].append({"id":bid,"name":name,"author":author,"code":pre,"total":total,"eps":eps})
json.dump(idx,open(os.path.join(OUT,"index.json"),"w",encoding="utf-8"),ensure_ascii=False,separators=(",",":"))
print({b["id"]:len(b["eps"]) for b in idx["books"]})
