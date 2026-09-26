"use client";
import {useEffect, useState} from "react";
import {BookOpen,Plus,Sparkles,Users,Globe2,FileText,ChevronRight,Search,MoreHorizontal,ArrowLeft, WandSparkles, Save, Play, X} from "lucide-react";

type Novel={title:string;genre:string;chapters:number;progress:number;updated:string;idea?:string};
const starter:Novel[]=[
 {title:"The Last Aurora",genre:"Fantasy • Adventure",chapters:12,progress:68,updated:"Baru saja"},
 {title:"Senja di Kota Hujan",genre:"Romance • Drama",chapters:8,progress:42,updated:"Kemarin"},
 {title:"Project Eclipse",genre:"Sci-Fi • Mystery",chapters:5,progress:25,updated:"3 hari lalu"}
];

export default function Home(){
 const [novels,setNovels]=useState<Novel[]>(starter),[page,setPage]=useState("projects"),[query,setQuery]=useState(""),[showCreate,setShowCreate]=useState(false),[selected,setSelected]=useState<Novel|null>(null),[saved,setSaved]=useState(false),[hydrated,setHydrated]=useState(false);
 const [title,setTitle]=useState(""),[genre,setGenre]=useState("Fantasy"),[idea,setIdea]=useState("");
 useEffect(()=>{try{const raw=localStorage.getItem("novelis:novels");const savedPage=localStorage.getItem("novelis:page");const selectedTitle=localStorage.getItem("novelis:selected");if(raw){const parsed=JSON.parse(raw);if(Array.isArray(parsed))setNovels(parsed)}if(savedPage)setPage(savedPage);if(selectedTitle){const rawNovels=raw?JSON.parse(raw):starter;const found=rawNovels.find((n:Novel)=>n.title===selectedTitle);if(found)setSelected(found)} }catch{}finally{setHydrated(true)}},[]);
 useEffect(()=>{if(!hydrated)return;localStorage.setItem("novelis:novels",JSON.stringify(novels));localStorage.setItem("novelis:page",page);if(selected)localStorage.setItem("novelis:selected",selected.title);else localStorage.removeItem("novelis:selected")},[novels,page,selected,hydrated]);
 const filtered=novels.filter(n=>n.title.toLowerCase().includes(query.toLowerCase()));
 const openNovel=(n:Novel)=>{setSelected(n);setPage("editor")};
 const createNovel=()=>{const name=title.trim()||"Novel Tanpa Judul";const n={title:name,genre,chapters:0,progress:0,updated:"Baru dibuat",idea};setNovels(v=>[n,...v]);setShowCreate(false);setTitle("");setIdea("");setSelected(n);setPage("builder")};
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
   {page==="editor"&&selected ? <Editor novel={selected} onBack={()=>nav("projects")} saved={saved} setSaved={setSaved}/> :
    page==="builder"&&selected ? <Builder novel={selected} onBack={()=>nav("projects")} /> :
    <><header><div><p className="eyebrow">WORKSPACE PENULIS</p><h1>{page==="projects"?"Selamat datang di Novelis.":page==="drafts"?"Draft & Bab":"Studio "+(page==="characters"?"Karakter":"Dunia Cerita")}</h1><p className="sub">{page==="projects"?"Bangun cerita, kembangkan karakter, dan biarkan AI membantu menulisnya.":"Bagian ini sudah aktif dan siap kita kembangkan pada tahap berikutnya."}</p></div><button className="primary" onClick={()=>setShowCreate(true)}><Sparkles size={17}/> Mulai Novel</button></header>
    {page==="projects"&&<><div className="hero"><div><span className="pill"><Sparkles size={14}/> AI Novel Studio</span><h2>Dari satu ide menjadi<br/><em>sebuah cerita utuh.</em></h2><p>Mulai dari premis sederhana. Novelis membantu membuat outline, karakter, dunia, hingga bab demi bab.</p><button className="heroBtn" onClick={()=>setShowCreate(true)}>Buat Novel Pertama <ChevronRight size={17}/></button></div><div className="heroArt"><div className="orb orb1"></div><div className="orb orb2"></div><div className="book"><BookOpen size={46}/><span>YOUR<br/>STORY</span></div></div></div>
    <div className="sectionHead"><div><h3>Novel Saya</h3><p>Kelola semua cerita yang sedang kamu kerjakan.</p></div><div className="search"><Search size={16}/><input placeholder="Cari novel..." value={query} onChange={e=>setQuery(e.target.value)}/></div></div>
    <div className="cards">{filtered.map(n=><button className="novelCard" key={n.title} onClick={()=>openNovel(n)}><div className="cover"><span>{n.title.split(" ").slice(0,2).join(" ")}</span><small>NOVELIS</small></div><div className="cardBody"><div className="cardTop"><div><h4>{n.title}</h4><p>{n.genre}</p></div><MoreHorizontal size={18}/></div><div className="progressMeta"><span>{n.chapters} bab</span><span>{n.progress}%</span></div><div className="progress"><i style={{width:n.progress+"%"}}/></div><small className="updated">{n.updated}</small></div></button>)}<button className="emptyCard" onClick={()=>setShowCreate(true)}><div><Plus size={22}/></div><b>Buat novel baru</b><span>Mulai dari ide kamu</span></button></div></>}
    {page!=="projects"&&<div className="placeholder"><div><Sparkles size={28}/></div><h2>Area ini sudah bisa diklik.</h2><p>Fungsionalitas detailnya akan kita isi setelah fondasi workspace selesai.</p><button className="primary" onClick={()=>setShowCreate(true)}>Buat Novel</button></div>}
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

function Builder({novel,onBack}:{novel:Novel;onBack:()=>void}){const [step,setStep]=useState(1);return <div className="workspace"><button className="back" onClick={onBack}><ArrowLeft size={17}/> Kembali</button><div className="workspaceHead"><div><p className="eyebrow">STORY BUILDER</p><h1>{novel.title}</h1><p className="sub">Kita susun fondasi novel sebelum AI menulis babnya.</p></div><span className="status">Langkah {step} / 4</span></div><div className="builderGrid"><div className="steps"><button className={step===1?"step active":"step"} onClick={()=>setStep(1)}><b>01</b>Premis & Arah</button><button className={step===2?"step active":"step"} onClick={()=>setStep(2)}><b>02</b>Karakter</button><button className={step===3?"step active":"step"} onClick={()=>setStep(3)}><b>03</b>Dunia Cerita</button><button className={step===4?"step active":"step"} onClick={()=>setStep(4)}><b>04</b>Outline Bab</button></div><div className="builderPanel"><span className="pill light"><Sparkles size={13}/> AI ASSISTED</span><h2>{["Premis & Arah","Karakter Utama","Dunia Cerita","Outline Bab"][step-1]}</h2><p>{step===1?(novel.idea||"Belum ada ide detail. Tambahkan arah cerita yang kamu inginkan."):step===2?"Buat tokoh utama, tokoh pendukung, tujuan, sifat, dan konflik.":step===3?"Bangun lokasi, waktu, aturan dunia, budaya, atau sistem kekuatan.":"Tentukan alur dari awal sampai akhir. AI akan membantu memecahnya menjadi bab."}</p><textarea placeholder="Tulis detail di sini, atau minta AI membuatkannya..." /><div className="builderActions"><button className="secondary"><WandSparkles size={16}/> Bantu AI</button><button className="primary" onClick={()=>setStep(Math.min(4,step+1))}>{step===4?"Mulai Menulis":"Lanjut"} <ChevronRight size={16}/></button></div></div></div></div>}

function Editor({novel,onBack,saved,setSaved}:{novel:Novel;onBack:()=>void;saved:boolean;setSaved:(v:boolean)=>void}){const [text,setText]=useState("Bab 1\n\nTuliskan pembukaan cerita di sini. AI akan membantu mengembangkan adegan, dialog, deskripsi, dan alur berdasarkan fondasi novelmu.");return <div className="workspace"><button className="back" onClick={onBack}><ArrowLeft size={17}/> Semua Novel</button><div className="workspaceHead"><div><p className="eyebrow">NOVEL EDITOR • {novel.genre}</p><h1>{novel.title}</h1><p className="sub">Bab 1 • Draft</p></div><button className="primary" onClick={()=>setSaved(true)}><Save size={16}/> {saved?"Tersimpan":"Simpan"}</button></div><div className="editorGrid"><div className="chapterList"><b>DAFTAR BAB</b><button className="chapter active">Bab 1 <small>Draft</small></button><button className="chapter">+ Tambah bab</button></div><div className="editorPanel"><textarea value={text} onChange={e=>{setText(e.target.value);setSaved(false)}}/><div className="aiToolbar"><button><WandSparkles size={15}/> Lanjutkan</button><button>Perbaiki</button><button>Dialog</button><button>Deskripsi</button><button><Play size={15}/> Generate</button></div></div></div></div>}
