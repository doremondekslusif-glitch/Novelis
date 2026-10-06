"use client";

import {useEffect,useMemo,useState} from "react";
import AuthPanel from "@/components/AuthPanel";
import {useCloudSync} from "@/lib/useCloudSync";
import {BookOpen,BookMarked,Plus,Sparkles,Users,Globe2,FileText,ChevronRight,Search,MoreHorizontal,ArrowLeft,WandSparkles,Save,Play,X,Trash2,Check,MessageCircle,Loader2,Maximize2,Minimize2,Download,FileArchive,FileJson,FileType} from "lucide-react";
import JSZip from "jszip";
import {jsPDF} from "jspdf";
import {Document,Packer,Paragraph,HeadingLevel} from "docx";

type Chapter={id:string;title:string;content:string;status:"Draft"|"Selesai";summary?:string};
type CharacterMemory={id:string;name:string;role?:string;description?:string;facts?:string[];status?:string;firstChapter?:number;lastChapter?:number};
type EntityMemory={id:string;name:string;type:"location"|"object"|"organization"|"other";description?:string;facts?:string[];firstChapter?:number;lastChapter?:number};
type FactMemory={id:string;subjectId?:string;subjectType:"character"|"entity"|"relationship"|"world"|"plot";subjectName?:string;statement:string;status:"active"|"superseded"|"uncertain";firstChapter?:number;lastChapter?:number;replacesId?:string};
type RelationshipMemory={id:string;from:string;to:string;type?:string;status?:string;facts?:string[];lastChapter?:number};
type TimelineEvent={id:string;chapter:number;title:string;description:string;characters?:string[];importance?:string};
type StoryThread={id:string;title:string;description:string;status:"open"|"resolved"|"uncertain";lastChapter?:number;relatedCharacters?:string[]};
type CharacterArc={character:string;arc:string;currentState?:string;turningPoints?:string[];lastChapter?:number};
type QualityIssue={severity:"high"|"medium"|"low";category:"continuity"|"character"|"timeline"|"world"|"plot"|"style";title:string;evidence:string;suggestion:string};
type QualityReport={overall:"clear"|"review";issues:QualityIssue[];checkedChapter:number;checkedAt:string};
type MemoryStatus="green"|"yellow"|"red";
type BuilderData={premise:string;theme:string;tone:string;style:string;pointOfView:string;audience:string;length:string;chapterTarget:string;ending:string;aiFreedom:string;locked:string[];characters:string;world:string;outline:string};
type Novel={id:string;title:string;genre:string;chapters:number;progress:number;updated:string;createdAt:string;updatedAt:string;deletedAt?:string;idea?:string;builder?:BuilderData;memory?:string;charactersMemory?:CharacterMemory[];entitiesMemory?:EntityMemory[];relationshipsMemory?:RelationshipMemory[];timeline?:TimelineEvent[];storyThreads?:StoryThread[];characterArcs?:CharacterArc[];factMemory?:FactMemory[];memoryNeedsUpdate?:boolean;memoryLastAnalyzedChapter?:number;storyIntelligenceLastAnalyzedChapter?:number;memoryStatus?:MemoryStatus;memoryStatusChapter?:number;chapterList?:Chapter[]};

const starter:Partial<Novel>[]=[
 {title:"The Last Aurora",genre:"Fantasy • Adventure",chapters:12,progress:68,updated:"Baru saja",builder:{premise:"",theme:"",tone:"",style:"",pointOfView:"third_limited",audience:"umum",length:"sedang",chapterTarget:"30",ending:"not_set",aiFreedom:"co_writer",locked:[],characters:"",world:"",outline:""},chapterList:Array.from({length:12},(_,i)=>({id:String(i+1),title:`Bab ${i+1}`,content:"",status:"Draft" as const}))},
 {title:"Senja di Kota Hujan",genre:"Romance • Drama",chapters:8,progress:42,updated:"Kemarin",builder:{premise:"",theme:"",tone:"",style:"",pointOfView:"third_limited",audience:"umum",length:"sedang",chapterTarget:"30",ending:"not_set",aiFreedom:"co_writer",locked:[],characters:"",world:"",outline:""},chapterList:Array.from({length:8},(_,i)=>({id:String(i+1),title:`Bab ${i+1}`,content:"",status:"Draft" as const}))},
 {title:"Project Eclipse",genre:"Sci-Fi • Mystery",chapters:5,progress:25,updated:"3 hari lalu",builder:{premise:"",theme:"",tone:"",style:"",pointOfView:"third_limited",audience:"umum",length:"sedang",chapterTarget:"30",ending:"not_set",aiFreedom:"co_writer",locked:[],characters:"",world:"",outline:""},chapterList:Array.from({length:5},(_,i)=>({id:String(i+1),title:`Bab ${i+1}`,content:"",status:"Draft" as const}))}
];

const emptyBuilder:BuilderData={premise:"",theme:"",tone:"",style:"",pointOfView:"third_limited",audience:"umum",length:"sedang",chapterTarget:"30",ending:"not_set",aiFreedom:"co_writer",locked:[],characters:"",world:"",outline:""};

const STORAGE_KEY="novelis:novels";
const STORAGE_VERSION=2;
const PAGE_KEY="novelis:page";
const SELECTED_KEY="novelis:selected";

function createId(prefix="id"){return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2,10)}`;}
function nowIso(){return new Date().toISOString();}
function getRelevantFacts(facts:FactMemory[],text:string,characters:CharacterMemory[]=[],entities:EntityMemory[]=[],limit=30){
 const active=facts.filter(f=>f.status!=="superseded");
 if(!active.length)return [];
 const hay=String(text||"").toLowerCase();
 const terms=[...characters.map(c=>c.name),...entities.map(e=>e.name)].map(v=>String(v||"").trim().toLowerCase()).filter(v=>v.length>=2);
 return active.map((fact,index)=>{
  const subject=String(fact.subjectName||"").trim().toLowerCase();
  const statement=String(fact.statement||"").toLowerCase();
  let score=Math.max(0,5-index*0.01);
  if(subject&&hay.includes(subject))score+=10;
  for(const term of terms){
   if(subject===term)score+=6;
   else if(subject&&subject.includes(term))score+=3;
   if(hay.includes(term)&&statement.includes(term))score+=4;
  }
  return {fact,score};
 }).sort((a,b)=>b.score-a.score).slice(0,limit).map(x=>x.fact);
}

type LocalStore={version:number;updatedAt:string;novels:Novel[]};
type StorageStatus="idle"|"saving"|"saved"|"error";

function writeLocalStore(novels:Novel[],page:string,selected:Novel|null){
 try{
  const store:LocalStore={version:STORAGE_VERSION,updatedAt:nowIso(),novels:novels.map(normalizeNovel)};
  localStorage.setItem(STORAGE_KEY,JSON.stringify(store));
  localStorage.setItem(PAGE_KEY,page);
  if(selected)localStorage.setItem(SELECTED_KEY,selected.id);else localStorage.removeItem(SELECTED_KEY);
  return true;
 }catch(error){
  console.error("Novelis local persistence failed",error);
  return false;
 }
}

function normalizeNovel(n:Partial<Novel>):Novel{
 const chapterList:Chapter[]=Array.isArray(n.chapterList)&&n.chapterList.length
   ?n.chapterList.map((c,i)=>({...c,id:c.id||createId(`chapter${i+1}`),title:c.title||`Bab ${i+1}`,content:c.content||"",status:c.status==="Selesai"?"Selesai":"Draft"}))
   :[{id:createId("chapter1"),title:"Bab 1",content:"",status:"Draft" as const}];
 const createdAt=n.createdAt||nowIso();
 const updatedAt=n.updatedAt||createdAt;
 return {
   ...n,
   id:n.id||createId("novel"),
   title:String(n.title||"Novel Tanpa Judul"),
   genre:String(n.genre||""),
   progress:Number.isFinite(Number(n.progress))?Number(n.progress):0,
   updated:String(n.updated||"Baru saja"),
   createdAt,
   updatedAt,
   builder:{...emptyBuilder,...n.builder},
   chapterList,
   factMemory:Array.isArray(n.factMemory)?n.factMemory.filter((f:any)=>f&&typeof f.statement==="string").map((f:any)=>({id:String(f.id||createId("fact")),subjectId:typeof f.subjectId==="string"?f.subjectId:undefined,subjectType:f.subjectType==="character"||f.subjectType==="entity"||f.subjectType==="relationship"||f.subjectType==="world"||f.subjectType==="plot"?f.subjectType:"plot",subjectName:typeof f.subjectName==="string"?f.subjectName:undefined,statement:String(f.statement).trim(),status:f.status==="superseded"||f.status==="uncertain"||f.status==="active"?f.status:"active",firstChapter:Number.isFinite(Number(f.firstChapter))?Number(f.firstChapter):undefined,lastChapter:Number.isFinite(Number(f.lastChapter))?Number(f.lastChapter):undefined,replacesId:typeof f.replacesId==="string"?f.replacesId:undefined})):[],
   chapters:chapterList.length
 };
}

function parseLocalStore(raw:string|null):LocalStore{
 if(!raw)return {version:STORAGE_VERSION,updatedAt:nowIso(),novels:starter.map(normalizeNovel)};
 try{
   const parsed=JSON.parse(raw);
   const source=Array.isArray(parsed)?parsed:parsed?.novels;
   if(!Array.isArray(source))throw new Error("Invalid local store");
   return {
     version:STORAGE_VERSION,
     updatedAt:typeof parsed?.updatedAt==="string"?parsed.updatedAt:nowIso(),
     novels:source.map((n:Partial<Novel>)=>normalizeNovel(n))
   };
 }catch{
   return {version:STORAGE_VERSION,updatedAt:nowIso(),novels:starter.map(normalizeNovel)};
 }
}

const initialStarter=starter.map(normalizeNovel);function slugify(value:string){return String(value||"novel").trim().replace(/[^a-z0-9\\u00C0-\\u024F]+/gi,"-").replace(/^-+|-+$/g,"").toLowerCase()||"novel";}
function downloadBlob(blob:Blob,filename:string){const url=URL.createObjectURL(blob);const a=document.createElement("a");a.href=url;a.download=filename;document.body.appendChild(a);a.click();a.remove();window.setTimeout(()=>URL.revokeObjectURL(url),1000);}
function getExportChapters(novel:Novel,chapters?:Chapter[],activeId?:string,scope:"all"|"current"="all"){const source=chapters?.length?chapters:normalizeNovel(novel).chapterList||[];return scope==="current"?source.filter(c=>c.id===activeId):source;}
function manuscriptText(novel:Novel,chapters:Chapter[]){return [novel.title,"",...chapters.flatMap((c,i)=>["BAB "+(i+1)+" — "+c.title,"",c.content||"(Bab ini belum memiliki isi.)",""])].join("\n");}
function manuscriptMarkdown(novel:Novel,chapters:Chapter[]){return ["# "+novel.title,"","> "+(novel.genre||"Novel"),"",...chapters.flatMap((c,i)=>["## Bab "+(i+1)+" — "+c.title,"",c.content||"*(Bab ini belum memiliki isi.)*",""])].join("\n");}
async function exportProjectZip(novel:Novel){const safe=normalizeNovel(novel);const zip=new JSZip();zip.file("novel.json",JSON.stringify(safe,null,2));zip.file("naskah.txt",manuscriptText(safe,safe.chapterList||[]));zip.file("naskah.md",manuscriptMarkdown(safe,safe.chapterList||[]));const chaptersFolder=zip.folder("bab");(safe.chapterList||[]).forEach((c,i)=>chaptersFolder?.file("bab-"+(i+1)+"-"+slugify(c.title)+".txt",c.content||""));const blob=await zip.generateAsync({type:"blob"});downloadBlob(blob,slugify(safe.title)+".zip");}
function exportProjectJson(novel:Novel){const safe=normalizeNovel(novel);downloadBlob(new Blob([JSON.stringify(safe,null,2)],{type:"application/json;charset=utf-8"}),slugify(safe.title)+".json");}
function exportProjectTxt(novel:Novel){const safe=normalizeNovel(novel);downloadBlob(new Blob([manuscriptText(safe,safe.chapterList||[])],{type:"text/plain;charset=utf-8"}),slugify(safe.title)+".txt");}
function exportProjectMarkdown(novel:Novel){const safe=normalizeNovel(novel);downloadBlob(new Blob([manuscriptMarkdown(safe,safe.chapterList||[])],{type:"text/markdown;charset=utf-8"}),slugify(safe.title)+".md");}
function exportNovelPdf(novel:Novel,chapters:Chapter[]){const safe=normalizeNovel(novel);const doc=new jsPDF({unit:"pt",format:"a4"});const margin=54;const pageWidth=doc.internal.pageSize.getWidth();const pageHeight=doc.internal.pageSize.getHeight();const textWidth=pageWidth-margin*2;let y=64;const addText=(value:string,size:number,bold=false)=>{doc.setFont("times",bold?"bold":"normal");doc.setFontSize(size);const lines=doc.splitTextToSize(value||"",textWidth);const lineHeight=size*1.45;if(y+lines.length*lineHeight>pageHeight-margin){doc.addPage();y=margin;}doc.text(lines,margin,y);y+=lines.length*lineHeight;};addText(safe.title,22,true);y+=8;addText(safe.genre||"Novel",11,false);y+=24;chapters.forEach((c,i)=>{addText("Bab "+(i+1)+" — "+c.title,16,true);y+=8;addText(c.content||"(Bab ini belum memiliki isi.)",11,false);y+=28;});doc.save(slugify(safe.title)+".pdf");}
async function exportNovelDocx(novel:Novel,chapters:Chapter[]){const safe=normalizeNovel(novel);const children:Paragraph[]=[new Paragraph({text:safe.title,heading:HeadingLevel.TITLE}),new Paragraph({text:safe.genre||"Novel"})];chapters.forEach((c,i)=>{children.push(new Paragraph({text:"Bab "+(i+1)+" — "+c.title,heading:HeadingLevel.HEADING_1}));String(c.content||"(Bab ini belum memiliki isi.)").split(/\n{2,}/).forEach(par=>children.push(new Paragraph({text:par})));});const doc=new Document({sections:[{children}]});const blob=await Packer.toBlob(doc);downloadBlob(blob,slugify(safe.title)+".docx");}

export default function Home(){
 const [novels,setNovels]=useState<Novel[]>(initialStarter),[page,setPage]=useState("projects"),[query,setQuery]=useState(""),[showCreate,setShowCreate]=useState(false),[selected,setSelected]=useState<Novel|null>(null),[hydrated,setHydrated]=useState(false),[storageStatus,setStorageStatus]=useState<StorageStatus>("idle"),[menuId,setMenuId]=useState<string|null>(null),[downloadPanelId,setDownloadPanelId]=useState<string|null>(null);
 const [title,setTitle]=useState(""),[genres,setGenres]=useState<string[]>(["Fantasy"]),[idea,setIdea]=useState("");
 const {deleteNovelPermanently}=useCloudSync(novels,setNovels,hydrated);

 useEffect(()=>{try{
   const store=parseLocalStore(localStorage.getItem(STORAGE_KEY));
   setNovels(store.novels);const savedPage=localStorage.getItem(PAGE_KEY);const selectedId=localStorage.getItem(SELECTED_KEY);
   if(savedPage)setPage(savedPage);
   if(selectedId){const found=store.novels.find(n=>n.id===selectedId);if(found)setSelected(found)}
 }catch{}finally{setHydrated(true)}},[]);

 useEffect(()=>{if(!hydrated)return;
   setStorageStatus("saving");
   const timer=window.setTimeout(()=>{
     setStorageStatus(writeLocalStore(novels,page,selected)?"saved":"error");
   },150);
   return()=>window.clearTimeout(timer);
 },[novels,page,selected,hydrated]);

 // Local data is versioned and normalized so it can later be migrated to a cloud schema without changing novel content.
 const filtered=novels.filter(n=>n.title.toLowerCase().includes(query.toLowerCase()));
 const openNovel=(n:Novel)=>{const safe=normalizeNovel(n);setSelected(safe);setPage("editor")};
 const openSectionNovel=(n:Novel)=>{setSelected(normalizeNovel(n));setMenuId(null)};
 const updateNovel=(updated:Novel)=>{const safe={...normalizeNovel(updated),updatedAt:nowIso(),updated:"Baru saja"};setNovels(v=>v.map(n=>n.id===safe.id?safe:n));setSelected(safe)};
 const createNovel=()=>{const name=title.trim()||"Novel Tanpa Judul";const timestamp=nowIso();const n:Novel={id:createId("novel"),title:name,genre:genres.join(" • "),chapters:1,progress:0,updated:"Baru dibuat",createdAt:timestamp,updatedAt:timestamp,idea,builder:{...emptyBuilder,premise:idea},chapterList:[{id:createId("chapter1"),title:"Bab 1",content:"",status:"Draft"}]};setNovels(v=>[n,...v]);setShowCreate(false);setTitle("");setIdea("");setSelected(n);setPage("builder")};
 const nav=(p:string)=>{setSelected(null);setMenuId(null);setDownloadPanelId(null);setPage(p)};
 const renameNovel=(n:Novel)=>{const next=window.prompt("Nama novel:",n.title)?.trim();if(!next||next===n.title)return;updateNovel({...n,title:next});setMenuId(null)};
 const deleteNovelPermanentlyFromDashboard=async(n:Novel)=>{
  const confirmed=window.confirm("Hapus \""+n.title+"\" secara permanen?\\n\\nSemua bab, karakter, Story Memory, dan data novel ini akan dihapus dan tidak dapat dipulihkan.");
  if(!confirmed)return;
  const remaining=novels.filter(item=>item.id!==n.id);
  setNovels(remaining);
  if(selected?.id===n.id)setSelected(null);
  setMenuId(null);
  setDownloadPanelId(null);
  const saved=writeLocalStore(remaining,page,null);
  if(!saved)alert("Novel sudah dihapus dari tampilan, tetapi penyimpanan lokal gagal diperbarui. Muat ulang halaman dan periksa penyimpanan browser.");
  try{
   await deleteNovelPermanently(n.id);
  }catch(error){
   console.error("Novelis cloud delete sync failed",error);
  }
 };

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
   <div className="sideBottom"><div className="aiCard"><Sparkles size={16}/><div><b>AI Studio</b><small>Siap membantu cerita kamu.</small></div></div><AuthPanel/></div>
  </aside>
  <section className="content">
   {page==="editor"&&selected?<Editor novel={selected} onBack={()=>nav("projects")} onUpdate={updateNovel}/>:
    page==="builder"&&selected?<Builder novel={selected} onBack={()=>nav("projects")} onUpdate={updateNovel} onStart={()=>setPage("editor")}/>:
    <><header><div><p className="eyebrow">WORKSPACE PENULIS</p><h1>{page==="projects"?"Selamat datang di Novelis.":page==="drafts"?"Draft & Bab":"Studio "+(page==="characters"?"Karakter":"Dunia Cerita")}</h1><p className="sub">{page==="projects"?"Bangun cerita, kembangkan karakter, dan biarkan AI membantu menulisnya.":selected?"Data dari novel yang dipilih.":"Pilih novel terlebih dahulu untuk melihat data yang tersimpan di dalamnya."}</p></div><div className="storageStatus">{storageStatus==="saving"?"Menyimpan otomatis…":storageStatus==="error"?"Penyimpanan lokal bermasalah":"✓ Tersimpan lokal"}</div><button className="primary" onClick={()=>setShowCreate(true)}><Sparkles size={17}/> Mulai Novel</button></header>
    {page==="projects"&&<><div className="hero"><div><span className="pill"><Sparkles size={14}/> AI Novel Studio</span><h2>Dari satu ide menjadi<br/><em>sebuah cerita utuh.</em></h2><p>Mulai dari premis sederhana. Novelis membantu membuat outline, karakter, dunia, hingga bab demi bab.</p><button className="heroBtn" onClick={()=>setShowCreate(true)}>Buat Novel Pertama <ChevronRight size={17}/></button></div><div className="heroArt"><div className="orb orb1"></div><div className="orb orb2"></div><div className="book"><BookOpen size={46}/><span>YOUR<br/>STORY</span></div></div></div>
    <div className="sectionHead"><div><h3>Novel Saya</h3><p>Kelola semua cerita yang sedang kamu kerjakan.</p></div><div className="search"><Search size={16}/><input placeholder="Cari novel..." value={query} onChange={e=>setQuery(e.target.value)}/></div></div>
    <div className="cards">{novels.filter(n=>n.title.toLowerCase().includes(query.toLowerCase())).map(n=><div className="novelCard" key={n.id} onClick={()=>openNovel(n)}><div className="cover"><span>{n.title.split(" ").slice(0,2).join(" ")}</span><small>NOVELIS</small></div><div className="cardBody"><div className="cardTop"><div><h4>{n.title}</h4><p>{n.genre}</p></div><div className="cardMenuWrap"><button className="iconBtn" title="Menu novel" onClick={e=>{e.stopPropagation();setMenuId(menuId===n.id?null:n.id)}}><MoreHorizontal size={18}/></button>{menuId===n.id&&<div className="cardMenu" onClick={e=>e.stopPropagation()}><button onClick={()=>renameNovel(n)}>Ganti Nama</button><button onClick={()=>{setDownloadPanelId(n.id);setMenuId(null)}}>Unduh</button><button className="danger" onClick={()=>deleteNovelPermanentlyFromDashboard(n)}><Trash2 size={14}/> Hapus permanen</button></div>}</div></div><div className="progressMeta"><span>{n.chapterList?.length||n.chapters} bab</span><span>{n.progress}%</span></div><div className="progress"><i style={{width:n.progress+"%"}}/></div><small className="updated">{n.updated}</small></div></div>)}<button className="emptyCard" onClick={()=>setShowCreate(true)}><div><Plus size={22}/></div><b>Buat novel baru</b><span>Mulai dari ide kamu</span></button></div></>}
    {(page==="drafts"||page==="characters"||page==="world")&&<SectionStudio page={page as "drafts"|"characters"|"world"} novels={novels} selected={selected} onSelect={openSectionNovel} onBack={()=>setSelected(null)} onOpenNovel={openNovel}/>}</>
    }
  </section>
  {downloadPanelId&&(()=>{const n=novels.find(item=>item.id===downloadPanelId);if(!n)return null;return <ProjectDownloadModal novel={n} onClose={()=>setDownloadPanelId(null)}/>})()}  {showCreate&&<div className="modalWrap" onMouseDown={e=>e.target===e.currentTarget&&setShowCreate(false)}><div className="modal"><div className="modalHead"><div><span className="pill"><Sparkles size={13}/> LANGKAH 1</span><h2>Buat Novel Baru</h2><p>Isi dasar cerita. Setelah ini kamu masuk ke Story Builder.</p></div><button className="close" onClick={()=>setShowCreate(false)}><X size={20}/></button></div>
   <label>Judul novel<input autoFocus value={title} onChange={e=>setTitle(e.target.value)} placeholder="Contoh: Senja yang Tak Pernah Pulang"/></label>
   <label>Genre utama<select value={genres[0]||"Fantasy"} onChange={e=>setGenres(v=>[e.target.value,...v.filter(x=>x!==e.target.value)])}><option>Fantasy</option><option>Romance</option><option>Drama</option><option>Mystery</option><option>Science Fiction</option><option>Thriller</option><option>Horror</option><option>Adventure</option><option>Historical</option></select></label><label>Genre pendukung <small style={{fontWeight:400,color:"#999"}}>(maks. 3)</small><div className="genreGrid">{["Fantasy","Romance","Drama","Mystery","Science Fiction","Thriller","Horror","Adventure","Historical","Comedy"].filter(g=>g!==(genres[0]||"Fantasy")).map(g=><button type="button" key={g} className={genres.includes(g)?"genreChip selected":"genreChip"} onClick={()=>setGenres(v=>v.includes(g)?v.filter(x=>x!==g):v.length<4?[...v,g]:v)}>{g}</button>)}</div></label>
   <label>Ide cerita<textarea value={idea} onChange={e=>setIdea(e.target.value)} placeholder="Ceritakan ide singkat novelmu..."/></label>
   <button className="primary full" onClick={createNovel}><Sparkles size={17}/> Lanjutkan ke Story Builder</button>
  </div></div>}
 </main>
}

function SectionStudio({page,novels,selected,onSelect,onBack,onOpenNovel}:{page:"drafts"|"characters"|"world";novels:Novel[];selected:Novel|null;onSelect:(n:Novel)=>void;onBack:()=>void;onOpenNovel:(n:Novel)=>void}){
 if(!selected){const title=page==="drafts"?"Draft & Bab":page==="characters"?"Karakter":"Dunia Cerita";return <div className="sectionStudio"><div className="sectionIntro"><span className="pill light"><Sparkles size={13}/> DATA PER NOVEL</span><h2>{title}</h2><p>Pilih novel untuk melihat data yang hanya milik novel tersebut. Data dari novel lain tidak akan tercampur.</p></div><div className="novelSelectorGrid">{novels.map(n=>{const count=page==="drafts"?(n.chapterList?.length||n.chapters):page==="characters"?(n.charactersMemory?.length||0):(n.entitiesMemory?.length||0);return <button className="novelSelector" key={n.id} onClick={()=>onSelect(n)}><div className="selectorIcon">{page==="drafts"?<FileText size={20}/>:page==="characters"?<Users size={20}/>:<Globe2 size={20}/>}</div><div><b>{n.title}</b><span>{n.genre}</span><small>{count} {page==="drafts"?"bab":page==="characters"?"karakter":"entitas"}</small></div><ChevronRight size={18}/></button>})}</div></div>}
 if(page==="drafts")return <div className="sectionStudio"><button className="back" onClick={onBack}><ArrowLeft size={17}/> Semua Novel</button><div className="sectionIntro compact"><span className="pill light"><FileText size={13}/> DRAFT & BAB</span><h2>{selected.title}</h2><p>{selected.chapterList?.length||selected.chapters} bab tersimpan di novel ini.</p></div><div className="chapterDirectory">{(selected.chapterList||[]).map((c,i)=><div className="directoryRow" key={c.id}><div><b>Bab {i+1} — {c.title}</b><span>{c.status} • {c.summary?.trim()?"Sudah diringkas":"Belum diringkas"}</span></div><button className="secondary mini" onClick={()=>onOpenNovel(selected)}>Buka Editor</button></div>)}</div></div>;
 if(page==="characters")return <div className="sectionStudio"><button className="back" onClick={onBack}><ArrowLeft size={17}/> Semua Novel</button><div className="sectionIntro compact"><span className="pill light"><Users size={13}/> KARAKTER</span><h2>{selected.title}</h2><p>{selected.charactersMemory?.length||0} karakter tersimpan dari perkembangan novel ini.</p></div><div className="memoryDirectory">{(selected.charactersMemory||[]).length===0?<div className="directoryEmpty">Belum ada karakter yang terdeteksi. Gunakan Ringkas & Analisis setelah menulis bab untuk membangun Character Memory.</div>:(selected.charactersMemory||[]).map(c=><div className="memoryCard" key={c.id}><div className="memoryAvatar"><Users size={18}/></div><div><b>{c.name}</b><span>{c.role||"Karakter"}</span><p>{c.description||c.facts?.[0]||"Belum ada deskripsi."}</p><small>{c.status||"Status belum ditentukan"}{c.firstChapter?" • Bab "+c.firstChapter+(c.lastChapter&&c.lastChapter!==c.firstChapter?"–"+c.lastChapter:""):""}</small></div></div>)}</div></div>;
 return <div className="sectionStudio"><button className="back" onClick={onBack}><ArrowLeft size={17}/> Semua Novel</button><div className="sectionIntro compact"><span className="pill light"><Globe2 size={13}/> DUNIA CERITA</span><h2>{selected.title}</h2><p>{selected.entitiesMemory?.length||0} entitas tersimpan di dunia novel ini.</p></div><div className="memoryDirectory">{(selected.entitiesMemory||[]).length===0?<div className="directoryEmpty">Belum ada entitas yang terdeteksi. Gunakan Ringkas & Analisis setelah menulis bab untuk membangun Entity Memory.</div>:(selected.entitiesMemory||[]).map(e=><div className="memoryCard" key={e.id}><div className="memoryAvatar"><Globe2 size={18}/></div><div><b>{e.name}</b><span>{e.type==="location"?"Lokasi":e.type==="object"?"Benda":e.type==="organization"?"Organisasi":"Entitas lain"}</span><p>{e.description||e.facts?.[0]||"Belum ada deskripsi."}</p><small>{e.firstChapter?"Pertama muncul Bab "+e.firstChapter:"Belum diketahui"}{e.lastChapter&&e.lastChapter!==e.firstChapter?" • Terakhir dianalisis Bab "+e.lastChapter:""}</small></div></div>)}</div></div>;
}

function ProjectDownloadModal({novel,onClose}:{novel:Novel;onClose:()=>void}){const [busy,setBusy]=useState(false);const run=async(kind:"zip"|"json"|"txt"|"md")=>{setBusy(true);try{if(kind==="zip")await exportProjectZip(novel);if(kind==="json")exportProjectJson(novel);if(kind==="txt")exportProjectTxt(novel);if(kind==="md")exportProjectMarkdown(novel);onClose()}finally{setBusy(false)}};return <div className="modalWrap" onMouseDown={e=>e.target===e.currentTarget&&!busy&&onClose()}><div className="exportModal"><div className="modalHead"><div><span className="pill"><Download size={13}/> UNDUH PROYEK</span><h2>{novel.title}</h2><p>Backup data proyek atau naskah dalam format yang mudah dibuka kembali.</p></div><button className="close" onClick={onClose} disabled={busy}><X size={20}/></button></div><div className="exportGrid"><button onClick={()=>run("zip")}><FileArchive size={21}/><b>ZIP</b><span>Seluruh data novel, bab, dan naskah.</span></button><button onClick={()=>run("json")}><FileJson size={21}/><b>JSON</b><span>Data proyek lengkap untuk backup.</span></button><button onClick={()=>run("txt")}><FileText size={21}/><b>TXT</b><span>Seluruh naskah sebagai teks.</span></button><button onClick={()=>run("md")}><FileType size={21}/><b>Markdown</b><span>Naskah dengan struktur judul bab.</span></button></div>{busy&&<div className="exportBusy"><Loader2 size={15} className="spin"/> Menyiapkan unduhan…</div>}</div></div>}function Builder({novel,onBack,onUpdate,onStart}:{novel:Novel;onBack:()=>void;onUpdate:(n:Novel)=>void;onStart:()=>void}){
 const [step,setStep]=useState(1);const [data,setData]=useState<BuilderData>({...emptyBuilder,...novel.builder});const [saved,setSaved]=useState(true);
 const labels=["Konsep & Arah","Karakter Utama","Dunia Cerita","Outline Bab"];
 const setField=(key:keyof BuilderData,value:string)=>{setData(d=>({...d,[key]:value}));setSaved(false)};
 const toggleLock=(key:string)=>setData(d=>({...d,locked:d.locked.includes(key)?d.locked.filter(x=>x!==key):[...d.locked,key]}));
 const save=()=>{onUpdate({...novel,builder:data,idea:data.premise,updated:"Baru saja"});setSaved(true)};
 const next=()=>{save();if(step<4)setStep(step+1);else onStart()};
 const SelectField=({label,value,options,field}:{label:string;value:string;options:[string,string][];field:keyof BuilderData})=><label className="builderField"><span>{label}</span><select value={value} onChange={e=>setField(field,e.target.value)}>{options.map(([v,l])=><option key={v} value={v}>{l}</option>)}</select></label>;
 return <div className="workspace"><button className="back" onClick={onBack}><ArrowLeft size={17}/> Kembali</button>
  <div className="workspaceHead"><div><p className="eyebrow">STORY BUILDER</p><h1>{novel.title}</h1><p className="sub">Bangun fondasi cerita. Informasi yang dikunci tidak boleh diubah AI tanpa persetujuanmu.</p></div><span className="status">Langkah {step} / 4</span></div>
  <div className="builderGrid"><div className="steps">{labels.map((label,i)=><button key={label} className={step===i+1?"step active":"step"} onClick={()=>{if(!saved)save();setStep(i+1)}}><b>0{i+1}</b>{label}{i<step&&<Check size={15}/>}</button>)}</div>
   <div className="builderPanel">
    {step===1&&<><span className="pill light"><Sparkles size={13}/> KONSEP NOVEL</span><h2>Identitas & arah cerita</h2><p>Genre utama menentukan identitas cerita. Genre pendukung memberi ruang untuk unsur tambahan tanpa mengacaukan fokus utama.</p>
     <div className="builderForm"><label>Premis / ide utama<textarea value={data.premise} onChange={e=>setField("premise",e.target.value)} placeholder="Apa inti cerita yang ingin kamu ceritakan?"/></label><label>Tema<textarea value={data.theme} onChange={e=>setField("theme",e.target.value)} placeholder="Contoh: pengorbanan, keluarga, kepercayaan..."/></label>
      <div className="builderCols"><SelectField label="Tone / nuansa" value={data.tone} field="tone" options={[["dark","Gelap"],["light","Ringan"],["warm","Hangat"],["tense","Tegang"],["mysterious","Misterius"],["epic","Epik"],["emotional","Emosional"]]}/><SelectField label="Gaya penulisan" value={data.style} field="style" options={[["simple","Sederhana"],["descriptive","Deskriptif"],["poetic","Puitis"],["cinematic","Sinematik"],["dynamic","Cepat & dinamis"],["dialogue","Banyak dialog"],["balanced","Seimbang"]]}/></div>
      <div className="builderCols"><SelectField label="Sudut pandang" value={data.pointOfView} field="pointOfView" options={[["first","Orang pertama"],["third_limited","Orang ketiga terbatas"],["third_omniscient","Orang ketiga serba tahu"],["multi","Berganti POV"]]}/><SelectField label="Target pembaca" value={data.audience} field="audience" options={[["anak","Anak-anak"],["remaja","Remaja"],["ya","Young Adult"],["dewasa","Dewasa"],["umum","Umum"]]}/></div>
      <div className="builderCols"><SelectField label="Panjang novel" value={data.length} field="length" options={[["pendek","Pendek"],["sedang","Sedang"],["panjang","Panjang"],["sangat_panjang","Sangat panjang"]]}/><label className="builderField"><span>Target jumlah bab</span><input type="number" min="1" max="500" value={data.chapterTarget} onChange={e=>setField("chapterTarget",e.target.value)}/></label></div>
      <div className="builderCols"><SelectField label="Ending" value={data.ending} field="ending" options={[["happy","Happy ending"],["sad","Sad ending"],["bittersweet","Bittersweet"],["open","Open ending"],["tragic","Tragic"],["not_set","Belum ditentukan"]]}/><SelectField label="Kebebasan AI" value={data.aiFreedom} field="aiFreedom" options={[["assistant","Pendamping — patuh pada konsep"],["co_writer","Co-writer — boleh mengembangkan"],["creative","Creative writer — lebih bebas"]]}/></div>
      <div className="lockBox"><div><b>Aturan AI</b><small>Pilih informasi yang harus dianggap sebagai canon.</small></div><div className="lockGrid">{[["premise","Premis"],["theme","Tema"],["tone","Tone"],["style","Gaya"],["pointOfView","POV"],["audience","Target pembaca"],["length","Panjang"],["chapterTarget","Jumlah bab"],["ending","Ending"]].map(([k,l])=><button type="button" key={k} className={data.locked.includes(k)?"lock active":"lock"} onClick={()=>toggleLock(k)}><span>{data.locked.includes(k)?"🔒":"○"}</span>{l}</button>)}</div><small className="lockHint">AI boleh mengembangkan detail yang tidak dikunci, tetapi tidak boleh mengubah canon yang dikunci.</small></div>
     </div></>}
    {step===2&&<><span className="pill light"><Users size={13}/> CHARACTER INTELLIGENCE</span><h2>Karakter Utama</h2><p>Definisikan tokoh, motivasi, tujuan, ketakutan, hubungan, dan arah perkembangan mereka.</p><textarea value={data.characters} onChange={e=>setField("characters",e.target.value)} placeholder="Contoh:\nProtagonis: ...\nTujuan: ...\nKetakutan: ...\nAntagonis: ...\nHubungan: ..."/></>}
    {step===3&&<><span className="pill light"><Globe2 size={13}/> WORLD BUILDING</span><h2>Dunia Cerita</h2><p>Bangun lokasi, waktu, aturan dunia, budaya, teknologi, sistem kekuatan, dan batasannya.</p><textarea value={data.world} onChange={e=>setField("world",e.target.value)} placeholder="Tulis aturan dunia dan detail penting yang harus konsisten..."/></>}
    {step===4&&<><span className="pill light"><BookMarked size={13}/> STORY OUTLINE</span><h2>Outline dari awal sampai akhir</h2><p>Gunakan target bab sebagai kerangka. Tentukan konflik, perkembangan karakter, klimaks, resolusi, dan hook tiap bagian.</p><textarea value={data.outline} onChange={e=>setField("outline",e.target.value)} placeholder="Contoh:\nBab 1 — Pertemuan\nTujuan: ...\nKonflik: ...\nHook: ...\n\nBab 2 — Rahasia..."/></>}
    <div className="builderActions"><button className="secondary" onClick={()=>setField(step===1?"premise":step===2?"characters":step===3?"world":"outline",(data[step===1?"premise":step===2?"characters":step===3?"world":"outline"]||"")+"\n\n[AI akan membantu mengembangkan bagian ini.]")}><WandSparkles size={16}/> Bantu AI</button><div className="actionRight">{!saved&&<small className="saveHint">Perubahan belum disimpan</small>}<button className="secondary" onClick={save}><Save size={16}/> Simpan</button><button className="primary" onClick={next}>{step===4?"Mulai Menulis":"Lanjut"} <ChevronRight size={16}/></button></div></div>
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
 const [characterMemories,setCharacterMemories]=useState<CharacterMemory[]>(novel.charactersMemory||[]);
 const [entityMemories,setEntityMemories]=useState<EntityMemory[]>(novel.entitiesMemory||[]);
 const [factMemory,setFactMemory]=useState<FactMemory[]>(novel.factMemory||[]);
 const [memoryNeedsUpdate,setMemoryNeedsUpdate]=useState(Boolean(novel.memoryNeedsUpdate));
 const [memoryStatus,setMemoryStatus]=useState<MemoryStatus>(novel.memoryStatus||(novel.memoryNeedsUpdate?"yellow":novel.memoryLastAnalyzedChapter?"green":"yellow"));
 const [memoryStatusChapter,setMemoryStatusChapter]=useState<number|undefined>(novel.memoryStatusChapter);
 const [memoryBusy,setMemoryBusy]=useState(false);
 const [summaryBusy,setSummaryBusy]=useState(false);
 const [intelligenceBusy,setIntelligenceBusy]=useState(false);
 const [qualityBusy,setQualityBusy]=useState(false);
 const [qualityReport,setQualityReport]=useState<QualityReport|null>(null);
 const [focusMode,setFocusMode]=useState(false);
 const [wordGoal,setWordGoal]=useState(1000);
 const [exportOpen,setExportOpen]=useState(false);
 const [relationships,setRelationships]=useState<RelationshipMemory[]>(novel.relationshipsMemory||[]);
 const [timeline,setTimeline]=useState<TimelineEvent[]>(novel.timeline||[]);
 const [storyThreads,setStoryThreads]=useState<StoryThread[]>(novel.storyThreads||[]);
 const [characterArcs,setCharacterArcs]=useState<CharacterArc[]>(novel.characterArcs||[]);
 const active=useMemo(()=>chapters.find(c=>c.id===activeId)||chapters[0],[chapters,activeId]);
 const chapterNumber=chapters.findIndex(c=>c.id===activeId)+1;
 const previousChapter=chapterNumber>1?chapters[chapterNumber-2]:null;
 const chapterSummaries=chapters.filter(c=>c.summary?.trim()).map((c,i)=>`Bab ${i+1} — ${c.title}: ${c.summary}`).join("\n");
 const relevantFacts=getRelevantFacts(factMemory,text,characterMemories,entityMemories);

 useEffect(()=>{if(active){setTitle(active.title);setText(active.content);setDirty(false);setGenerateError("");setNotice("")}},[activeId]);

 const persistChapter=(updatedChapters:Chapter[],nextMemory=memory,extra:Partial<Novel>={})=>{
  onUpdate({...novel,memory:nextMemory,charactersMemory:characterMemories,entitiesMemory:entityMemories,factMemory,memoryNeedsUpdate,memoryStatus,memoryStatusChapter,memoryLastAnalyzedChapter:novel.memoryLastAnalyzedChapter,chapterList:updatedChapters,chapters:updatedChapters.length,progress:Math.min(100,Math.round(updatedChapters.filter(c=>c.status==="Selesai").length/Math.max(1,updatedChapters.length)*100)),updatedAt:nowIso(),updated:"Baru saja",...extra});
 };

 const wordCount=text.trim()?text.trim().split(/\s+/).length:0;
 const characterCount=text.length;
 const readingMinutes=wordCount?Math.max(1,Math.ceil(wordCount/200)):0;
 const wordGoalProgress=wordGoal>0?Math.min(100,Math.round(wordCount/wordGoal*100)):0;

 const save=(silent=false)=>{
  const updatedChapters:Chapter[]=chapters.map(c=>c.id===activeId?{...c,title:title.trim()||`Bab ${chapterNumber}`,content:text,status:text.trim().length>80?"Selesai":"Draft"}:c);
  setChapters(updatedChapters);
  persistChapter(updatedChapters);
  setDirty(false);
  if(!silent)setNotice("Tersimpan");
 };

 useEffect(()=>{
  if(!dirty)return;
  const timer=window.setTimeout(()=>save(true),1200);
  return()=>window.clearTimeout(timer);
 },[dirty,text,title,activeId]);

 useEffect(()=>{
  const onKeyDown=(event:KeyboardEvent)=>{
   if((event.ctrlKey||event.metaKey)&&event.key.toLowerCase()==="s"){event.preventDefault();save();}
   if(event.key==="Escape"&&focusMode){setFocusMode(false);}
  };
  window.addEventListener("keydown",onKeyDown);
  return()=>window.removeEventListener("keydown",onKeyDown);
 },[focusMode,save]);

 const finalizeChapter=()=>{ save(); };

 const selectChapter=(id:string)=>{if(id===activeId)return;if(dirty)save(true);setActiveId(id)};
 const addChapter=()=>{if(dirty)save(true);const id=Date.now().toString();const next=chapters.length+1;const ch:Chapter={id,title:`Bab ${next}`,content:"",status:"Draft"};setChapters(c=>[...c,ch]);setActiveId(id);setTitle(ch.title);setText("");setDirty(false);setNotice("")};
 const removeChapter=()=>{if(chapters.length===1)return;const next=chapters.filter(c=>c.id!==activeId);setChapters(next);setActiveId(next[0].id);setDirty(true)};

 const runAI=async(action:"generate"|"continue"|"improve"|"dialog"|"description")=>{
  if(generating)return;
  setGenerating(true);setGenerateError("");setNotice("");
  try{
   const res=await fetch("/api/generate",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({
    action,novel:{title:novel.title,genre:novel.genre,builder:novel.builder,memory,chapterSummaries,factMemory:relevantFacts},
    chapter:{title:title.trim()||`Bab ${chapterNumber}`,content:text,number:chapterNumber},
    previousChapter:previousChapter?{title:previousChapter.title,content:previousChapter.content,summary:previousChapter.summary||""}:null
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
    action:"memoryFoundation",
    novel:{title:novel.title,genre:novel.genre,builder:novel.builder,memory,charactersMemory:characterMemories,entitiesMemory:entityMemories,factMemory:relevantFacts},
    chapter:{title:title.trim()||`Bab ${chapterNumber}`,content:text,number:chapterNumber},
    chapters:chapters.map(c=>({title:c.title,summary:c.summary}))
   })});
   const data=await res.json();if(!res.ok)throw new Error(data.error||"Gagal menganalisis memori cerita.");
   const updatedChapters:Chapter[]=chapters.map(c=>c.id===activeId?{...c,title:title.trim()||`Bab ${chapterNumber}`,content:text,status:(text.trim().length>80?"Selesai":"Draft") as Chapter["status"],summary:String(data.summary||"").trim()}:c);
   const nextMemory=String(data.storyMemory||memory).trim();
   const incomingCharacters=Array.isArray(data.characters)?data.characters as CharacterMemory[]:[];
   const incomingEntities=Array.isArray(data.entities)?data.entities as EntityMemory[]:[];
   const mergeByName=<T extends {id:string;name:string}>(existing:T[],incoming:T[])=>{
    const map=new Map(existing.map(item=>[item.name.trim().toLowerCase(),item]));
    incoming.forEach(item=>{
     const key=item.name.trim().toLowerCase();if(!key)return;
     const old=map.get(key);map.set(key,old?{...old,...item,id:old.id}:item);
    });
    return Array.from(map.values());
   };
   const nextCharacters=mergeByName(characterMemories,incomingCharacters);
   const nextEntities=mergeByName(entityMemories,incomingEntities);
   setChapters(updatedChapters);setCharacterMemories(nextCharacters);setEntityMemories(nextEntities);setMemory(nextMemory);setMemoryNeedsUpdate(false);setMemoryStatus("green");setMemoryStatusChapter(chapterNumber);
   setDirty(false);
   // Setelah Ringkas & Analisis berhasil, status resmi menjadi hijau.
   // Simpan juga ke parent agar autosave berikutnya tidak mengembalikan status kuning.
   onUpdate({...novel,memory:nextMemory,charactersMemory:nextCharacters,entitiesMemory:nextEntities,memoryNeedsUpdate:false,memoryStatus:"green",memoryStatusChapter:chapterNumber,memoryLastAnalyzedChapter:chapterNumber,chapterList:updatedChapters,chapters:updatedChapters.length,updated:"Baru saja"});
   setNotice("Ringkasan + Memory Foundation diperbarui • status kembali hijau");
  }catch(error){setGenerateError(error instanceof Error?error.message:"Gagal menganalisis memori cerita.")}finally{setSummaryBusy(false)}
 };

 const runIntelligence=async()=>{
  if(intelligenceBusy||!text.trim())return;
  setIntelligenceBusy(true);setGenerateError("");setNotice("");
  try{
   const res=await fetch("/api/generate",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({
    action:"storyIntelligence",
    novel:{title:novel.title,genre:novel.genre,builder:novel.builder,memory,charactersMemory:characterMemories,entitiesMemory:entityMemories,relationshipsMemory:relationships,timeline,storyThreads,characterArcs},
    chapter:{title:title.trim()||`Bab ${chapterNumber}`,content:text,number:chapterNumber},
    chapters:chapters.map(c=>({title:c.title,summary:c.summary}))
   })});
   const data=await res.json();if(!res.ok)throw new Error(data.error||"Gagal menganalisis Story Intelligence.");
   const mergeById=<T extends {id?:string}>(existing:T[],incoming:T[])=>{
    const map=new Map(existing.map(item=>[String(item.id||JSON.stringify(item)),item]));
    for(const item of incoming){
     const key=String(item.id||JSON.stringify(item));
     map.set(key,item);
    }
    return Array.from(map.values());
   };
   const mergeArcs=(existing:CharacterArc[],incoming:CharacterArc[])=>{
    const map=new Map(existing.map(item=>[item.character.trim().toLowerCase(),item]));
    for(const item of incoming){
     const key=item.character.trim().toLowerCase();
     if(key)map.set(key,item);
    }
    return Array.from(map.values());
   };
   const nextRelationships=Array.isArray(data.relationships)?mergeById(relationships,data.relationships as RelationshipMemory[]):relationships;
   const nextTimeline=Array.isArray(data.timeline)?mergeById(timeline,data.timeline as TimelineEvent[]):timeline;
   const nextThreads=Array.isArray(data.threads)?mergeById(storyThreads,data.threads as StoryThread[]):storyThreads;
   const nextArcs=Array.isArray(data.arcs)?mergeArcs(characterArcs,data.arcs as CharacterArc[]):characterArcs;
   setRelationships(nextRelationships);setTimeline(nextTimeline);setStoryThreads(nextThreads);setCharacterArcs(nextArcs);
   onUpdate({...novel,relationshipsMemory:nextRelationships,timeline:nextTimeline,storyThreads:nextThreads,characterArcs:nextArcs,storyIntelligenceLastAnalyzedChapter:chapterNumber,chapterList:chapters,chapters:chapters.length,updated:"Baru saja"});
   setNotice("Story Intelligence diperbarui");
  }catch(error){setGenerateError(error instanceof Error?error.message:"Gagal menganalisis Story Intelligence.")}finally{setIntelligenceBusy(false)}
 };

 const runQualityCheck=async()=>{
  if(qualityBusy||!text.trim())return;
  setQualityBusy(true);setGenerateError("");setNotice("");
  try{
   const res=await fetch("/api/generate",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({
    action:"qualityControl",
    novel:{title:novel.title,genre:novel.genre,builder:novel.builder,memory,charactersMemory:characterMemories,entitiesMemory:entityMemories,relationshipsMemory:relationships,timeline,storyThreads,characterArcs},
    chapter:{title:title.trim()||"Bab "+chapterNumber,content:text,number:chapterNumber},
    previousChapter:previousChapter?{title:previousChapter.title,content:previousChapter.content}:null,
    chapters:chapters.map(c=>({title:c.title,summary:c.summary}))
   })});
   const data=await res.json();if(!res.ok)throw new Error(data.error||"Gagal menjalankan Quality Control.");
   const issues=Array.isArray(data.issues)?data.issues as QualityIssue[]:[];
   const report:QualityReport={overall:data.overall==="clear"?"clear":"review",issues,checkedChapter:chapterNumber,checkedAt:new Date().toLocaleString("id-ID")};
   setQualityReport(report);setNotice(issues.length?"Quality Control menemukan "+issues.length+" hal untuk ditinjau":"Quality Control: tidak menemukan masalah penting");
  }catch(error){setGenerateError(error instanceof Error?error.message:"Gagal menjalankan Quality Control.")}finally{setQualityBusy(false)}
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
   onUpdate({...novel,memory:nextMemory,charactersMemory:characterMemories,entitiesMemory:entityMemories,relationshipsMemory:relationships,timeline,storyThreads,characterArcs,memoryNeedsUpdate:false,memoryStatus:"green",memoryStatusChapter:chapterNumber,memoryLastAnalyzedChapter:chapterNumber,chapterList:chapters,chapters:chapters.length,updated:"Baru saja"});
   setMemoryNeedsUpdate(false);setMemoryStatus("green");setMemoryStatusChapter(chapterNumber);
   setNotice("Story Memory diperbarui • status kembali hijau");
  }catch(error){setGenerateError(error instanceof Error?error.message:"Gagal membangun Story Memory.")}finally{setMemoryBusy(false)}
 };

 const saveMemory=()=>{
  onUpdate({...novel,memory,charactersMemory:characterMemories,entitiesMemory:entityMemories,memoryNeedsUpdate:false,memoryStatus:"green",memoryStatusChapter:chapterNumber,memoryLastAnalyzedChapter:chapterNumber,chapterList:chapters,chapters:chapters.length,updated:"Baru saja"});
  setMemoryNeedsUpdate(false);setMemoryStatus("green");setMemoryStatusChapter(chapterNumber);
  setNotice("Story Memory tersimpan • status kembali hijau");
 };

 const primaryAction=chapterNumber===1?"generate":"continue";
 const primaryLabel=chapterNumber===1?"Generate":"Lanjutkan";
 return <div className={focusMode?"workspace writerFocus":"workspace"}>
  <button className="back" onClick={()=>{if(dirty)save(true);onBack()}}><ArrowLeft size={17}/> Semua Novel</button>
  <div className="workspaceHead"><div><p className="eyebrow">NOVEL EDITOR • {novel.genre}</p><h1>{novel.title}</h1><p className="sub">{chapters.length} bab • {active?.status||"Draft"}</p></div><div className="editorSave"><span className={dirty?"unsaved":"saved"}>{dirty?"● Autosave menunggu...":notice||"✓ Tersimpan"}</span><div className="exportWrap"><button className="secondary exportIconBtn" title="Ekspor novel" onClick={()=>setExportOpen(v=>!v)}><Download size={17}/> Ekspor</button>{exportOpen&&<div className="exportDropdown"><b>Ekspor naskah</b><span>Pilih format dan cakupan.</span><button onClick={()=>{const cs=getExportChapters(novel,chapters,activeId,"all");exportNovelPdf({...novel,chapterList:cs},cs);setExportOpen(false)}}><FileType size={15}/> PDF — seluruh novel</button><button onClick={()=>{const cs=getExportChapters(novel,chapters,activeId,"current");exportNovelPdf({...novel,chapterList:cs},cs);setExportOpen(false)}}><FileType size={15}/> PDF — bab ini</button><button onClick={async()=>{const cs=getExportChapters(novel,chapters,activeId,"all");await exportNovelDocx({...novel,chapterList:cs},cs);setExportOpen(false)}}><FileText size={15}/> Word — seluruh novel</button><button onClick={async()=>{const cs=getExportChapters(novel,chapters,activeId,"current");await exportNovelDocx({...novel,chapterList:cs},cs);setExportOpen(false)}}><FileText size={15}/> Word — bab ini</button><button onClick={()=>{const cs=getExportChapters(novel,chapters,activeId,"all");downloadBlob(new Blob([manuscriptText(novel,cs)],{type:"text/plain;charset=utf-8"}),slugify(novel.title)+".txt");setExportOpen(false)}}><FileText size={15}/> TXT — seluruh novel</button><button onClick={()=>{const cs=getExportChapters(novel,chapters,activeId,"all");downloadBlob(new Blob([manuscriptMarkdown(novel,cs)],{type:"text/markdown;charset=utf-8"}),slugify(novel.title)+".md");setExportOpen(false)}}><FileType size={15}/> Markdown — seluruh novel</button></div>}</div><button className="primary" onClick={finalizeChapter} disabled={false}><Save size={16}/> Simpan</button></div></div>
  <div className="editorGrid">
   <div className="chapterList"><div className="chapterHead"><b>DAFTAR BAB</b><button className="iconBtn" onClick={addChapter} title="Tambah bab"><Plus size={16}/></button></div>{chapters.map((c,i)=><div className={c.id===activeId?"chapter active":"chapter"} key={c.id}><button onClick={()=>selectChapter(c.id)}><span>{c.title}</span><small>{c.status}</small></button></div>)}<button className="chapter add" onClick={addChapter}>+ Tambah bab</button>{chapters.length>1&&<button className="deleteChapter" onClick={removeChapter}><Trash2 size={14}/> Hapus bab aktif</button>}</div>
   <div className="editorPanel">
    <div className="editorTop">
     <input className="chapterTitle" value={title} onChange={e=>{setTitle(e.target.value);setDirty(true);setNotice("")}} placeholder="Judul bab"/>
     <div className="writerTools">
      <span className="writerStat"><b>{wordCount.toLocaleString("id-ID")}</b> kata</span>
      <span className="writerStat">{characterCount.toLocaleString("id-ID")} karakter</span>
      <span className="writerStat">≈ {readingMinutes||"—"} mnt</span>
      <button className="focusBtn" onClick={()=>setFocusMode(v=>!v)} title={focusMode?"Keluar dari Focus Mode":"Masuk Focus Mode"}>
       {focusMode?<><Minimize2 size={14}/> Keluar Focus</>:<><Maximize2 size={14}/> Focus</>}
      </button>
      <span className="chapterNumber">Bab {chapterNumber}</span>
     </div>
    </div>
    <div className="writingArea">
     <textarea value={text} onChange={e=>{setText(e.target.value);setDirty(true);setNotice("")}} placeholder="Mulai menulis cerita..."/>
     <div className="writingFooter">
      <div className="writingMeta"><span>{wordCount.toLocaleString("id-ID")} / {wordGoal>0?wordGoal.toLocaleString("id-ID"):"—"} kata</span><span>Ctrl/Cmd + S untuk menyimpan • Esc untuk keluar Focus</span></div>
      <div className="goalControl"><label>Target</label><input type="number" min="0" step="100" value={wordGoal} onChange={e=>setWordGoal(Math.max(0,Number(e.target.value)||0))}/><span>{wordGoal>0?wordGoalProgress+"%":"—"}</span></div>
     </div>
     <div className="goalTrack"><span style={{width:wordGoalProgress+"%"}}/></div>
    </div>
    {generateError&&<div className="generateError">⚠ {generateError}</div>}
    <div className="memoryPanel">
     <div className="memoryHead"><div><span className="memoryTitle"><BookMarked size={15}/> STORY MEMORY <span className={"memoryStatusDot "+memoryStatus}>● {memoryStatus==="green"?"HIJAU":memoryStatus==="yellow"?"KUNING":"MERAH"}</span></span><small>🟢 Tidak ada perubahan penting • 🟡 Ada perkembangan • 🔴 Ada perubahan besar atau risiko konflik. Ringkas Bab menentukan status; update mengembalikan status ke hijau.</small></div><span className="memoryAutoBadge"><Sparkles size={13}/> Otomatis saat Ringkas & Analisis</span></div>
     {memoryStatus==="yellow"&&<div className="memoryAlert yellow">{memoryStatusChapter?"🟡 Ada perkembangan cerita yang sudah dimasukkan ke Story Memory saat proses Ringkas & Analisis.":"🟡 Story Memory belum dianalisis. Ringkas & Analisis bab ini untuk menentukan apakah ada perubahan penting."}</div>}
     {memoryStatus==="red"&&<div className="memoryAlert red">🔴 Ada perubahan besar atau potensi konflik yang sudah dimasukkan ke Story Memory saat proses Ringkas & Analisis.</div>}
     {memoryStatus==="green"&&<div className="memoryAlert green">🟢 Story Memory sudah diperbarui dan menjadi versi aktif terbaru{memoryStatusChapter?` (Bab ${memoryStatusChapter}).`:"."}</div>}
     <textarea className="memoryInput" value={memory} onChange={e=>setMemory(e.target.value)} placeholder="Belum ada Story Memory. Klik “Update Story Memory” untuk membuatnya, atau tulis sendiri."/>
     <div className="memoryFoot"><span>{memory.trim()?memory.trim().length+" karakter tersimpan":"Memory kosong"} • {characterMemories.length} karakter • {entityMemories.length} entitas • {factMemory.length} fakta</span><button className="textBtn" onClick={saveMemory}>Simpan Memory</button></div>
    </div>
    <div className="intelligenceBar"><div><b>Story Intelligence</b><span>{novel.storyIntelligenceLastAnalyzedChapter===chapterNumber?"Hubungan, timeline, benang cerita, dan arc karakter sudah dianalisis untuk bab ini.":"Analisis perkembangan cerita untuk menjaga kesinambungan antar-bab."}</span></div><button className="secondary mini" onClick={runIntelligence} disabled={intelligenceBusy||!text.trim()}>{intelligenceBusy?<><Loader2 size={13} className="spin"/> Menganalisis...</>:<><Sparkles size={13}/> Analisis Story Intelligence</>}</button></div>
    <div className="qualityBar"><div><b>Quality Control</b><span>{qualityReport?qualityReport.overall==="clear"?"Bab "+chapterNumber+": tidak ditemukan masalah penting.":"Bab "+chapterNumber+": "+qualityReport.issues.length+" hal perlu ditinjau.":"Periksa kontinuitas, karakter, timeline, dunia, plot, dan gaya sebelum melanjutkan bab berikutnya."}</span></div><button className="secondary mini" onClick={runQualityCheck} disabled={qualityBusy||!text.trim()}>{qualityBusy?<><Loader2 size={13} className="spin"/> Memeriksa...</>:<><Check size={13}/> Periksa Bab</>}</button></div>
    {qualityReport&&<div className="qualityReport">{qualityReport.issues.length===0?<div className="qualityClear"><Check size={15}/><span>Tidak ada masalah penting yang terdeteksi pada pemeriksaan ini.</span></div>:qualityReport.issues.map((issue,i)=><div className="qualityIssue" key={issue.title+"-"+i}><div className={"severity "+issue.severity}>{issue.severity==="high"?"TINGGI":issue.severity==="medium"?"SEDANG":"RENDAH"}</div><div><b>{issue.title}</b><p>{issue.evidence}</p><small>Saran: {issue.suggestion}</small></div></div>)}</div>}
    <div className="summaryBar"><div><b>Ringkasan & Memory Foundation</b><span>{active?.summary?.trim()?`Bab ${chapterNumber} sudah dianalisis. ${memoryNeedsUpdate?"Ada perkembangan yang perlu dipertimbangkan untuk Story Memory.":"Memory Foundation tetap selaras."}`:"Ringkas Bab untuk mencatat kejadian dan memperbarui memori karakter/entitas."}</span></div><button className="secondary mini" onClick={runSummary} disabled={summaryBusy||!text.trim()}>{summaryBusy?<><Loader2 size={13} className="spin"/> Merangkum...</>:<><FileText size={13}/> Ringkas & Analisis</>}</button></div>
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
