"use client";

import {useEffect,useMemo,useState} from "react";
import {BookOpen,Plus,Sparkles,Users,Globe2,FileText,ChevronRight,Search,MoreHorizontal,ArrowLeft,WandSparkles,Save,Play,X,Trash2,Check} from "lucide-react";

type Chapter={id:string;title:string;content:string;status:"Draft"|"Selesai"};
type BuilderData={premise:string;characters:string;world:string;outline:string};
type Novel={title:string;genre:string;chapters:number;progress:number;updated:string;idea?:string;builder?:BuilderData;chapterList?:Chapter[]};

const starter:Novel[]=[
 {title:"The Last Aurora",genre:"Fantasy • Adventure",chapters:12,progress:68,updated:"Baru saja",builder:{premise:"",characters:"",world:"",outline:""},chapterList:Array.from({length:12},(_,i)=>({id:String(i+1),title:`Bab ${i+1}`,content:"",status:"Draft" as const}))},
 {title:"Senja di Kota Hujan",genre:"Romance • Drama",chapters:8,progress:42,updated:"Kemarin",builder:{premise:"",characters:"",world:"",outline:""},chapterList:Array.from({length:8},(_,i)=>({id:String(i+1),title:`Bab ${i+1}`,content:"",status:"Draft" as const}))},
 {title:"Project Eclipse",genre:"Sci-Fi • Mystery",chapters:5,progress:25,updated:"3 hari lalu",builder:{premise:"",characters:"",world:"",outline:""},chapterList:Array.from({length:5},(_,i)=>({id:String(i+1),title:`Bab ${i+1}`,content:"",status:"Draft" as const}))}
];

const emptyBuilder:BuilderData={premise:"",characters:"",world:"",outline:""};

function normalizeNovel(n:Novel):Novel{
 const chapterList=n.chapterList?.length?n.chapterList:[{id:"1",title:"Bab 1",content:"",status:"Draft"}];
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
 const initial=normalizeNovel(novel);const [chapters,setChapters]=useState<Chapter[]>(initial.chapterList!);const [activeId,setActiveId]=useState(initial.chapterList![0].id);const [title,setTitle]=useState("");const [text,setText]=useState("");const [dirty,setDirty]=useState(false);
 const active=useMemo(()=>chapters.find(c=>c.id===activeId)||chapters[0],[chapters,activeId]);
 useEffect(()=>{if(active){setTitle(active.title);setText(active.content);setDirty(false)}},[activeId]);
 const save=()=>{const updatedChapters=chapters.map(c=>c.id===activeId?{...c,title:title.trim()||"Bab tanpa judul",content:text,status:text.trim().length>80?"Selesai":"Draft"}:c);setChapters(updatedChapters);onUpdate({...novel,chapterList:updatedChapters,chapters:updatedChapters.length,progress:Math.min(100,Math.round(updatedChapters.filter(c=>c.status==="Selesai").length/Math.max(1,updatedChapters.length)*100)),updated:"Baru saja"});setDirty(false)};
 const selectChapter=(id:string)=>{if(dirty)save();setActiveId(id)};
 const addChapter=()=>{if(dirty)save();const id=Date.now().toString();const next=chapters.length+1;const ch:Chapter={id,title:`Bab ${next}`,content:"",status:"Draft"};setChapters(c=>[...c,ch]);setActiveId(id);setTitle(ch.title);setText("");setDirty(false)};
 const removeChapter=()=>{if(chapters.length===1)return;const next=chapters.filter(c=>c.id!==activeId);setChapters(next);setActiveId(next[0].id);setDirty(true)};
 return <div className="workspace"><button className="back" onClick={()=>{if(dirty)save();onBack()}}><ArrowLeft size={17}/> Semua Novel</button>
  <div className="workspaceHead"><div><p className="eyebrow">NOVEL EDITOR • {novel.genre}</p><h1>{novel.title}</h1><p className="sub">{chapters.length} bab • {active?.status||"Draft"}</p></div><button className="primary" onClick={save}><Save size={16}/> {dirty?"Simpan":"Tersimpan"}</button></div>
  <div className="editorGrid"><div className="chapterList"><div className="chapterHead"><b>DAFTAR BAB</b><button className="iconBtn" onClick={addChapter} title="Tambah bab"><Plus size={16}/></button></div>{chapters.map(c=><div className={c.id===activeId?"chapter active":"chapter"} key={c.id}><button onClick={()=>selectChapter(c.id)}><span>{c.title}</span><small>{c.status}</small></button></div>)}<button className="chapter add" onClick={addChapter}>+ Tambah bab</button>{chapters.length>1&&<button className="deleteChapter" onClick={removeChapter}><Trash2 size={14}/> Hapus bab aktif</button>}</div>
   <div className="editorPanel"><input className="chapterTitle" value={title} onChange={e=>{setTitle(e.target.value);setDirty(true)}} placeholder="Judul bab"/><textarea value={text} onChange={e=>{setText(e.target.value);setDirty(true)}} placeholder="Mulai menulis cerita..."/><div className="aiToolbar"><button><WandSparkles size={15}/> Lanjutkan</button><button>Perbaiki</button><button>Dialog</button><button>Deskripsi</button><button><Play size={15}/> Generate</button></div></div>
  </div></div>
}
