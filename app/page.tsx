"use client";

import {useEffect,useMemo,useState} from "react";
import AuthPanel from "@/components/AuthPanel";
import {useCloudSync} from "@/lib/useCloudSync";
import {BookOpen,BookMarked,Plus,Sparkles,Users,Globe2,FileText,ChevronRight,Search,MoreHorizontal,ArrowLeft,WandSparkles,Save,Play,X,Trash2,Check,MessageCircle,Loader2,Maximize2,Minimize2} from "lucide-react";

type Chapter={id:string;title:string;content:string;status:"Draft"|"Selesai";summary?:string};
type CharacterMemory={id:string;name:string;role?:string;description?:string;facts?:string[];status?:string;firstChapter?:number;lastChapter?:number};
type EntityMemory={id:string;name:string;type:"location"|"object"|"organization"|"other";description?:string;facts?:string[];firstChapter?:number;lastChapter?:number};
type RelationshipMemory={id:string;from:string;to:string;type?:string;status?:string;facts?:string[];lastChapter?:number};
type TimelineEvent={id:string;chapter:number;title:string;description:string;characters?:string[];importance?:string};
type StoryThread={id:string;title:string;description:string;status:"open"|"resolved"|"uncertain";lastChapter?:number;relatedCharacters?:string[]};
type CharacterArc={character:string;arc:string;currentState?:string;turningPoints?:string[];lastChapter?:number};
type QualityIssue={severity:"high"|"medium"|"low";category:"continuity"|"character"|"timeline"|"world"|"plot"|"style";title:string;evidence:string;suggestion:string};
type QualityReport={overall:"clear"|"review";issues:QualityIssue[];checkedChapter:number;checkedAt:string};
type MemoryStatus="green"|"yellow"|"red";
type BuilderData={premise:string;theme:string;tone:string;style:string;pointOfView:string;audience:string;length:string;chapterTarget:string;ending:string;aiFreedom:string;locked:string[];characters:string;world:string;outline:string};
type Novel={id:string;title:string;genre:string;chapters:number;progress:number;updated:string;createdAt:string;updatedAt:string;idea?:string;builder?:BuilderData;memory?:string;charactersMemory?:CharacterMemory[];entitiesMemory?:EntityMemory[];relationshipsMemory?:RelationshipMemory[];timeline?:TimelineEvent[];storyThreads?:StoryThread[];characterArcs?:CharacterArc[];memoryNeedsUpdate?:boolean;memoryLastAnalyzedChapter?:number;storyIntelligenceLastAnalyzedChapter?:number;memoryStatus?:MemoryStatus;memoryStatusChapter?:number;chapterList?:Chapter[]};

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

const initialStarter=starter.map(normalizeNovel);

export default function Home(){