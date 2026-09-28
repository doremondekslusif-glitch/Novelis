"use client";

import {useEffect,useMemo,useState} from "react";
import {BookOpen,BookMarked,Plus,Sparkles,Users,Globe2,FileText,ChevronRight,Search,MoreHorizontal,ArrowLeft,WandSparkles,Save,Play,X,Trash2,Check,MessageCircle,Loader2} from "lucide-react";

type Chapter={id:string;title:string;content:string;status:"Draft"|"Selesai";summary?:string};
type BuilderData={premise:string;characters:string;world:string;outline:string};
type Novel={title:string;genre:string;chapters:number;progress:number;updated:string;idea?:string;builder?:BuilderData;memory?:string;chapterList?:Chapter[]};

const starter:Novel[]=[
 {title:"The Last Aurora",genre:"Fantasy • Adventure",chapters:12,progress:68,updated:"Baru saja",builder:{premise:"",characters:"",world:"",outline:""},chapterList:Array.from({length:12},(_,i)=>({id:String(i+1),title:`Bab ${i+1}`,content:"",status:"Draft" as const}))},
 {title:"Senja di Kota Hujan",genre:"Romance • Drama",chapters:8,progress:42,updated:"Kemarin",builder:{premise:"",characters:"",world:"",outline:""},chapterList:Array.from({length:8},(_,i)=>({id:String(i+1),title:`Bab ${i+1}`,content:"",status:"Draft" as const}))},
 {title:"Project Eclipse",genre:"Sci-Fi • Mystery",chapters:5,progress:25,updated:"3 hari lalu",builder:{premise:"",characters:"",world:"",outline:""},chapterList:Array.from({length:5},(_,i)=>({id:String(i+1),title:`Bab ${i+1}`,content:"",status:"Draft" as const}))}
];

const emptyBuilder:BuilderData={premise:"",characters:"",world:"",outline:""};

function normalizeNovel(n:Novel):Novel{
 const chapterList:Chapter[]=n.chapterList?.length ? n.chapterList : [{id:"1",title:"Bab 1",content:"",status:"Draft" as const}];
 return {...n,builder:{...emptyBuilder,...n.builder},chapterList,chapters:chapterList.length};
}

export default function Home(){
 const [novels,setNovels]=useState<Novel[]>(starter),[page,setPage]=useState("projects"),[query,setQuery]=useState(""),[showCreate,setShowCreate]=useState(false),[selected,setSelected]=useState<Novel|null>(null),[hydrated,setHydrated]=useState(false);
 const [title,setTitle]=useState(""),[genre,setGenre]=useState("Fantasy"),[idea,setIdea]=useState("");

 useEffect(()=>{try{
   const raw=localStorage.getItem("novelis:novels");const savedPage=localStorage.getItem("novelis:page");const selectedTitle=localStorage.getItem("novelis:selected");
   const loaded=raw?JSON.parse(raw):starter;const safe=Array.isArray(loaded)?loaded.map(normalizeNovel):starter;
   setNovels(safe);if(savedPage)setPage(savedPage);
   if(selectedTitle){const found=safe.find((n:Novel)=>n.title===selectedTitle);if(found)setSelected(found)}
 }catch{}finally{setHydrated(true)}},[]);

 useEffect(()=>{if(!hydrated)return;localStorage.setItem("novelis:novels",JSON.stringify(novels));localStorage.setItem("novelis:page",page);if(selected)localStorage.setItem("novelis:selected",selected.title);else localStorage.removeItem("novelis:selected")},[novels,page,selected,hydrated]);

 const filtered=novels.filter(n=>n.title.toLowerCase().includes(query.toLowerCase()));
 const openNovel=(n:Novel)=>{setSelected(normalizeNovel(n));setPage("editor")};
 const updateNovel=(updated:Novel)=>{const safe=normalizeNovel(updated);setNovels(v=>v.map(n=>n.title===safe.title?safe:n));setSelected(safe)};
 const createNovel=()=>{const name=title.trim()||"Novel Tanpa Judul";const n:Novel={title:name,genre,chapters:1,progress:0,updated:"Baru dibuat",idea,builder:{...emptyBuilder,premise:idea},chapterList:[{id:"1",title:"Bab 1",content:"",status:"Draft"}]};setNovels(v=>[n,...v]);setShowCreate(false);setTitle("");setIdea("");setSelected(n);setPage("builder")};
 const nav=(p:string)=>{setSelected(null);setPage(p)};

 return <main className="shell">
  <aside className="sidebar">
   <div className="brand"><div className="brandIcon"><BookOpen size={19}/></div><span>Novelis</span></div>
   <button className="newBtn" onClick={()=>setShowCreate(true)}><Plus size={18}/> Novel Baru</button>
   <nav>
    <button className={page==="projects"?"active":""} onClick={()=>nav("projects")}><BookOpen size={17}/> Proyek Novel</button>
    <button className={page==="drafts"?"active":""} onClick={()=>nav("drafts")}><FileText size={17}/> Draft & Bab</button>
    <button className={page==="characters"?"active":""} onClick={()=>nav("characters")}><Users size={17}/> Karakter</button>
    <button className={page==="world"?"active":""} onClick={()=>nav("world")}><Globe2 size={17}/> Dunia Cerita</button>
   </nav>
   <div className="sideBottom"><div className="aiCard"><Sparkles size={16}/><div><b>AI Studio</b><small>Siap membantu cerita kamu.</small></div></div><div className="profile"><div className="avatar">F</div><div><b>Penulis</b><small>Workspace pribadi</small></div><MoreHorizontal size={17}/></div></div>
  </aside>

  <section className="content">
   {page==="editor"&&selected?<Editor novel={selected} onBack={()=>nav("projects")} onUpdate={updateNovel}/>:
    page==="builder"&&selected?<Builder novel={selected} onBack={()=>nav("projects")} onUpdate={updateNovel} onStart={()=>setPage("editor")}/>:
    <><header><div><p className="eyebrow">WORKSPACE PENULIS</p><h1>{page==="projects"?"Selamat datang di Novelis.":page==="drafts"?"Draft & Bab":"Studio "+(page==="characters"?"Karakter":"Dunia Cerita")}</h1><p className="sub">{page==="projects"?"Bangun cerita, kembangkan karakter, dan biarkan AI membantu menulisnya.":"Bagian ini sekarang terhubung dengan data novel yang tersimpan di browser."}</p></div><button className="primary" onClick={()=>setShowCreate(true)}><Sparkles size={17}/> Mulai Novel</button></header>
    {page==="projects"&&<><div className="hero"><div><span className="pill"><Sparkles size={14}/> AI Novel Studio</span><h2>Dari satu ide menjadi<br/><em>sebuah cerita utuh.</em></h2><p>Mulai dari premis sederhana. Novelis membantu membuat outline, karakter, dunia, hingga bab demi bab.</p><button className="heroBtn" onClick={()=>setShowCreate(true)}>Buat Novel Pertama <ChevronRight size={17}/></button></div><div className="heroArt"><div className="orb orb1"></div><div className="orb orb2"></div><div className="book"><BookOpen size={46}/><span>YOUR<br/>STORY</span></div></div></div>
    <div className="sectionHead"><div><h3>Novel Saya</h3><p>Kelola semua cerita yang sedang kamu kerjakan.</p></div><div className="search"><Search size={16}/><input placeholder="Cari novel..." value={query} onChange={e=>setQuery(e.target.value)}/></div></div>
    <div className="cards">{filtered.map(n=><button className="novelCard" key={n.title} onClick={()=>openNovel(n)}><div className="cover"><span>{n.title.split(" ").slice(0,2).join(" ")}</span><small>NOVELIS</small></div><div className="cardBody"><div className="cardTop"><div><h4>{n.title}</h4><p>{n.genre}</p></div><MoreHorizontal size={18}/></div><div className="progressMeta"><span>{n.chapterList?.length||n.chapters} bab</span><span>{n.progress}%</span></div><div className="progress"><i style={{width:n.progress+"%"}}/></div><small className="updated">{n.updated}</small></div></button>)}<button className="emptyCard" onClick={()=>setShowCreate(true)}><div><Plus size={22}/></div><b>Buat novel baru</b><span>Mulai dari ide kamu</span></button></div></>}
    {page!=="projects"&&<div className="placeholder"><div><Sparkles size={28}/></div><h2>{page==="drafts"?"Draft & Bab":"Studio "+(page==="characters"?"Karakter":"Dunia Cerita")}</h2><p>Pilih sebuah novel untuk mengelola bagian ini dari Story Builder atau Editor.</p><button className="primary" onClick={()=>setShowCreate(true)}>Buat Novel</button></div>}
    </>}
  </section>

  {showCreate&&<div className="modalWrap" onMouseDown={e=>e.target===e.currentTarget&&setShowCreate(false)}><div className="modal"><div className="modalHead"><div><span className="pill"><Sparkles size={13}/> LANGKAH 1</span><h2>Buat Novel Baru</h2><p>Isi dasar cerita. Setelah ini kamu masuk ke Story Builder.</p></div><button className="close" onClick={()=>setShowCreate(false)}><X size={20}/></button></div>
   <label>Judul novel<input autoFocus value={title} onChange={e=>setTitle(e.target.value)} placeholder="Contoh: Senja yang Tak Pernah Pulang"/></label>
   <label>Genre<select value={genre} onChange={e=>setGenre(e.target.value)}><option>Fantasy</option><option>Romance</option><option>Drama</option><option>Mystery</option><option>Science Fiction</option><option>Thriller</option></select></label>
   <label>Ide cerita<textarea value={idea} onChange={e=>setIdea(e.target.value)} placeholder="Ceritakan ide singkat novelmu..."/></label>
   <button className="primary full" onClick={createNovel}><Sparkles size={17}/> Lanjutkan ke Story Builder</button>
  </div></div>}
 </main>
}

function Builder({novel,onBack,onUpdate,onStart}:{novel:Novel;onBack:()=>void;onUpdate:(n:Novel)=>void;onStart:()=>void}){
 const [step,setStep]=useState(1);const [data,setData]=useState<BuilderData>({...emptyBuilder,...novel.builder});const [saved,setSaved]=useState(true);
 const labels=["Premis & Arah","Karakter Utama","Dunia Cerita","Outline Bab"];const keys:["premise","characters","world","outline"]=["premise","characters","world","outline"];
 const value=data[keys[step-1]];
 const setValue=(v:string)=>{setData(d=>({...d,[keys[step-1]]:v}));setSaved(false)};
 const save=()=>{onUpdate({...novel,builder:data,idea:data.premise,updated:"Baru saja"});setSaved(true)};
 const next=()=>{save();if(step<4)setStep(step+1);else onStart()};
 return <div className="workspace"><button className="back" onClick={onBack}><ArrowLeft size={17}/> Kembali</button>
  <div className="workspaceHead"><div><p className="eyebrow">STORY BUILDER</p><h1>{novel.title}</h1><p className="sub">Susun fondasi novel. Semua langkah sekarang tersimpan.</p></div><span className="status">Langkah {step} / 4</span></div>
  <div className="builderGrid"><div className="steps">{labels.map((label,i)=><button key={label} className={step===i+1?"step active":"step"} onClick={()=>{if(!saved)save();setStep(i+1)}}><b>0{i+1}</b>{label}{i<step&&<Check size={15}/>}</button>)}</div>
   <div className="builderPanel"><span className="pill light"><Sparkles size={13}/> AI ASSISTED</span><h2>{labels[step-1]}</h2><p>{step===1?(novel.idea||"Tentukan premis, konflik utama, tujuan cerita, dan arah ending."):step===2?"Buat tokoh utama dan pendukung: tujuan, sifat, latar belakang, hubungan, serta konflik.":step===3?"Bangun lokasi, waktu, aturan dunia, budaya, teknologi, atau sistem kekuatan.":"Tulis alur besar dari awal sampai akhir. Satu baris dapat mewakili satu bab."}</p>
    <textarea value={value} onChange={e=>setValue(e.target.value)} placeholder={step===4?"Contoh:\nBab 1 — Pertemuan\nBab 2 — Rahasia\nBab 3 — Konflik...":"Tulis detail di sini..."}/>
    <div className="builderActions"><button className="secondary" onClick={()=>setValue(value?value+"\n\n[AI akan membantu mengembangkan bagian ini.]":"[AI akan membantu mengembangkan bagian ini.]")}><WandSparkles size={16}/> Bantu AI</button><div className="actionRight">{!saved&&<small className="saveHint">Perubahan belum disimpan</small>}<button className="secondary" onClick={save}><Save size={16}/> Simpan</button><button className="primary" onClick={next}>{step===4?"Mulai Menulis":"Lanjut"} <ChevronRight size={16}/></button></div></div>
   </div></div></div>
}

function Editor({novel,onBack,onUpdate}:{novel:Novel;onBack:()=>void;onUpdate:(n:Novel)=>void}){
 const initial=normalizeNovel(novel);
 const [chapters,setChapters]=useState<Chapter[]>(initial.chapterList!);
 const [activeId,setActiveId]=useState(initial.chapterList![0].id);
 const [title,setTitle]=useState("");const [text,setText]=useState("");
 const [dirty,setDirty]=useState(false);const [generating,setGenerating]=useState(false);const [generateError,setGenerateError]=useState("");
 const [notice,setNotice]=useState("");
 const [memory,setMemory]=useState(novel.memory||"");
 const [memoryBusy,setMemoryBusy]=useState(false);
 const [summaryBusy,setSummaryBusy]=useState(false);
 const active=useMemo(()=>chapters.find(c=>c.id===activeId)||chapters[0],[chapters,activeId]);
 const chapterNumber=chapters.findIndex(c=>c.id===activeId)+1;
 const previousChapter=chapterNumber>1?chapters[chapterNumber-2]:null;
 const chapterSummaries=chapters.filter(c=>c.summary?.trim()).map((c,i)=>`Bab ${i+1} — ${c.title}: ${c.summary}`).join("\n");

 useEffect(()=>{if(active){setTitle(active.title);setText(active.content);setDirty(false);setGenerateError("");setNotice("")}},[activeId]);

 const persistChapter=(updatedChapters:Chapter[],nextMemory=memory)=>{
  onUpdate({...novel,memory:nextMemory,chapterList:updatedChapters,chapters:updatedChapters.length,progress:Math.min(100,Math.round(updatedChapters.filter(c=>c.status==="Selesai").length/Math.max(1,updatedChapters.length)*100)),updated:"Baru saja"});
 };

 const save=(silent=false)=>{
  const updatedChapters:Chapter[]=chapters.map(c=>c.id===activeId?{...c,title:title.trim()||`Bab ${chapterNumber}`,content:text,status:text.trim().length>80?"Selesai":"Draft"}:c);
  setChapters(updatedChapters);
  persistChapter(updatedChapters);
  setDirty(false);
  if(!silent)setNotice("Tersimpan");
 };

 const finalizeChapter=()=>{ save(); };
 useEffect(()=>{
  if(!dirty)return;
  const timer=setTimeout(()=>save(true),1200);
  return()=>clearTimeout(timer);
 },[text,title,dirty]);

 const selectChapter=(id:string)=>{if(id===activeId)return;if(dirty)save(true);setActiveId(id)};
 const addChapter=()=>{if(dirty)save(true);const id=Date.now().toString();const next=chapters.length+1;const ch:Chapter={id,title:`Bab ${next}`,content:"",status:"Draft"};setChapters(c=>[...c,ch]);setActiveId(id);setTitle(ch.title);setText("");setDirty(false);setNotice("")};
 const removeChapter=()=>{if(chapters.length===1)return;const next=chapters.filter(c=>c.id!==activeId);setChapters(next);setActiveId(next[0].id);setDirty(true)};

 const runAI=async(action:"generate"|"continue"|"improve"|"dialog"|"description")=>{
  if(generating)return;
  setGenerating(true);setGenerateError("");setNotice("");
  try{
   const res=await fetch("/api/generate",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({
    action,novel:{title:novel.title,genre:novel.genre,builder:novel.builder,memory,chapterSummaries},
    chapter:{title:title.trim()||`Bab ${chapterNumber}`,content:text,number:chapterNumber},
    previousChapter:previousChapter?{title:previousChapter.title,content:previousChapter.content}:null
   })});
   const data=await res.json();if(!res.ok)throw new Error(data.error||"Gagal memproses tulisan.");
   const generated=(data.text||"").trim();if(!generated)throw new Error("AI tidak menghasilkan teks.");
   if(action==="generate"||action==="continue")setText(text.trim()?text.trim()+"\n\n"+generated:generated);
   else setText(generated);
   setDirty(true);setNotice(action==="improve"?"Tulisan diperbaiki":action==="dialog"?"Dialog diperbarui":action==="description"?"Deskripsi diperkaya":"Cerita berhasil dibuat");
  }catch(error){setGenerateError(error instanceof Error?error.message:"Gagal memproses tulisan.")}finally{setGenerating(false)}
 };

 const runSummary=async()=>{
  if(summaryBusy||!text.trim())return;
  setSummaryBusy(true);setGenerateError("");setNotice("");
  try{
   const res=await fetch("/api/generate",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({
    action:"summarize",novel:{title:novel.title,genre:novel.genre,builder:novel.builder,memory},chapter:{title:title.trim()||`Bab ${chapterNumber}`,content:text,number:chapterNumber},previousChapter:null
   })});
   const data=await res.json();if(!res.ok)throw new Error(data.error||"Gagal membuat ringkasan.");
   const updatedChapters=chapters.map(c=>c.id===activeId?{...c,summary:(data.text||"").trim()}:c);
   setChapters(updatedChapters);
   onUpdate({...novel,memory,chapterList:updatedChapters,chapters:updatedChapters.length,updated:"Baru saja"});
   setNotice("Ringkasan bab diperbarui");
  }catch(error){setGenerateError(error instanceof Error?error.message:"Gagal membuat ringkasan.")}finally{setSummaryBusy(false)}
 };

 const runMemory=async()=>{
  if(memoryBusy)return;
  setMemoryBusy(true);setGenerateError("");setNotice("");
  try{
   const res=await fetch("/api/generate",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({
    action:"memory",novel:{title:novel.title,genre:novel.genre,builder:novel.builder,memory},chapter:{title:title,content:text,number:chapterNumber},chapters:chapters.map(c=>({title:c.title,content:c.content,summary:c.summary}))
   })});
   const data=await res.json();if(!res.ok)throw new Error(data.error||"Gagal membangun Story Memory.");
   const nextMemory=(data.text||"").trim();if(!nextMemory)throw new Error("AI tidak menghasilkan Story Memory.");
   setMemory(nextMemory);
   onUpdate({...novel,memory:nextMemory,chapterList:chapters,chapters:chapters.length,updated:"Baru saja"});
   setNotice("Story Memory diperbarui");
  }catch(error){setGenerateError(error instanceof Error?error.message:"Gagal membangun Story Memory.")}finally{setMemoryBusy(false)}
 };

 const saveMemory=()=>{
  onUpdate({...novel,memory,chapterList:chapters,chapters:chapters.length,updated:"Baru saja"});
  setNotice("Story Memory tersimpan");
 };

 const primaryAction=chapterNumber===1?"generate":"continue";
 const primaryLabel=chapterNumber===1?"Generate":"Lanjutkan";
 return <div className="workspace">
  <button className="back" onClick={()=>{if(dirty)save(true);onBack()}}><ArrowLeft size={17}/> Semua Novel</button>
  <div className="workspaceHead"><div><p className="eyebrow">NOVEL EDITOR • {novel.genre}</p><h1>{novel.title}</h1><p className="sub">{chapters.length} bab • {active?.status||"Draft"}</p></div><div className="editorSave"><span className={dirty?"unsaved":"saved"}>{dirty?"● Belum disimpan":notice||"✓ Tersimpan"}</span><button className="primary" onClick={finalizeChapter} disabled={false}><Save size={16}/> Simpan</button></div></div>
  <div className="editorGrid">
   <div className="chapterList"><div className="chapterHead"><b>DAFTAR BAB</b><button className="iconBtn" onClick={addChapter} title="Tambah bab"><Plus size={16}/></button></div>{chapters.map((c,i)=><div className={c.id===activeId?"chapter active":"chapter"} key={c.id}><button onClick={()=>selectChapter(c.id)}><span>{c.title}</span><small>{c.status}</small></button></div>)}<button className="chapter add" onClick={addChapter}>+ Tambah bab</button>{chapters.length>1&&<button className="deleteChapter" onClick={removeChapter}><Trash2 size={14}/> Hapus bab aktif</button>}</div>
   <div className="editorPanel">
    <div className="editorTop"><input className="chapterTitle" value={title} onChange={e=>{setTitle(e.target.value);setDirty(true);setNotice("")}} placeholder="Judul bab"/><span>Bab {chapterNumber}</span></div>
    <textarea value={text} onChange={e=>{setText(e.target.value);setDirty(true);setNotice("")}} placeholder="Mulai menulis cerita..."/>
    {generateError&&<div className="generateError">⚠ {generateError}</div>}
    <div className="memoryPanel">
     <div className="memoryHead"><div><span className="memoryTitle"><BookMarked size={15}/> STORY MEMORY</span><small>Diperbarui saat kamu menekan “Bangun Memory”, sehingga kamu bisa mengontrol kapan konteks cerita diubah.</small></div><button className="secondary mini" onClick={runMemory} disabled={memoryBusy}>{memoryBusy?<><Loader2 size={13} className="spin"/> Membangun...</>:<><Sparkles size={13}/> Bangun Memory</>}</button></div>
     <textarea className="memoryInput" value={memory} onChange={e=>setMemory(e.target.value)} placeholder="Belum ada Story Memory. Klik “Bangun Memory” untuk membuatnya, atau tulis sendiri."/>
     <div className="memoryFoot"><span>{memory.trim()?memory.trim().length+" karakter tersimpan":"Memory kosong"}</span><button className="textBtn" onClick={saveMemory} disabled={false}>Simpan Memory</button></div>
    </div>
    <div className="summaryBar"><div><b>Ringkasan bab</b><span>{active?.summary?.trim()?"AI sudah punya ringkasan bab ini.":"Belum ada ringkasan untuk bab ini."}</span></div><button className="secondary mini" onClick={runSummary} disabled={summaryBusy||!text.trim()}>{summaryBusy?<><Loader2 size={13} className="spin"/> Merangkum...</>:<><FileText size={13}/> Ringkas Bab</>}</button></div>
    <div className="aiToolbar">
     <button onClick={()=>runAI("improve")} disabled={generating||!text.trim()}><WandSparkles size={15}/> Perbaiki</button>
     <button onClick={()=>runAI("dialog")} disabled={generating||!text.trim()}><MessageCircle size={15}/> Dialog</button>
     <button onClick={()=>runAI("description")} disabled={generating||!text.trim()}><BookOpen size={15}/> Deskripsi</button>
     <button className="aiPrimary" onClick={()=>runAI(primaryAction)} disabled={generating}>{generating?<><Loader2 size={15} className="spin"/> Generating...</>:<><Play size={15}/> {primaryLabel}</>}</button>
    </div>
   </div>
  </div>
 </div>
}
