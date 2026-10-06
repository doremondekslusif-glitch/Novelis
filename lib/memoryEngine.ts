export type MemoryStatus="green"|"yellow"|"red";

export type CharacterMemory={
 id:string;
 name:string;
 role?:string;
 description?:string;
 facts?:string[];
 status?:string;
 firstChapter?:number;
 lastChapter?:number
};

export type EntityMemory={
 id:string;
 name:string;
 type:"location"|"object"|"organization"|"other";
 description?:string;
 facts?:string[];
 firstChapter?:number;
 lastChapter?:number
};

export type FactMemory={
 id:string;
 subjectId?:string;
 subjectType:"character"|"entity"|"relationship"|"world"|"plot";
 subjectName?:string;
 statement:string;
 status:"active"|"superseded"|"uncertain";
 firstChapter?:number;
 lastChapter?:number;
 replacesId?:string;
 replacesSubjectName?:string;
 replacesStatement?:string
};

export type RelationshipMemory={id:string;from:string;to:string;type?:string;status?:string;facts?:string[];lastChapter?:number};
export type TimelineEvent={id:string;chapter:number;title:string;description:string;characters?:string[];importance?:string};
export type StoryThread={id:string;title:string;description:string;status:"open"|"resolved"|"uncertain";lastChapter?:number;relatedCharacters?:string[]};
export type CharacterArc={character:string;arc:string;currentState?:string;turningPoints?:string[];lastChapter?:number};

function normalizeFactText(value:unknown){
 return String(value??"").toLowerCase().replace(/[^a-z0-9\u00C0-\u024F]+/gi," ").trim();
}

function factTokens(value:unknown){
 return Array.from(new Set(normalizeFactText(value).split(/\s+/).filter(v=>v.length>=3)));
}

function factOverlap(a:unknown,b:unknown){
 const aa=factTokens(a);
 const bb=new Set(factTokens(b));
 if(!aa.length||!bb.size)return 0;
 return aa.filter(v=>bb.has(v)).length/aa.length;
}

export function resolveReplacementFactId(incoming:Partial<FactMemory>,facts:FactMemory[]){
 const direct=typeof incoming?.replacesId==="string"?incoming.replacesId.trim():"";
 if(direct&&facts.some(f=>f.id===direct))return direct;

 const subject=normalizeFactText(incoming?.replacesSubjectName);
 const oldStatement=String(incoming?.replacesStatement||"").trim();
 if(subject&&oldStatement){
  const candidates=facts
   .filter(f=>f.status!=="superseded"&&normalizeFactText(f.subjectName)===subject)
   .map(f=>({f,score:factOverlap(oldStatement,f.statement)}))
   .sort((a,b)=>b.score-a.score);
  if(candidates.length&&candidates[0].score>=0.5&&(!candidates[1]||candidates[0].score-candidates[1].score>=0.08)){
   return candidates[0].f.id;
  }
 }

 if(subject){
  const candidates=facts.filter(f=>f.status!=="superseded"&&normalizeFactText(f.subjectName)===subject);
  if(candidates.length===1)return candidates[0].id;
 }

 return "";
}

function mergeByName<T extends {id:string;name:string}>(existing:T[],incoming:T[]){
 const map=new Map(existing.map(item=>[item.name.trim().toLowerCase(),item]));
 for(const item of incoming){
  const key=String(item?.name||"").trim().toLowerCase();
  if(!key)continue;
  const old=map.get(key);
  map.set(key,old?{...old,...item,id:old.id}:item);
 }
 return Array.from(map.values());
}

export function mergeMemoryFoundation(input:{
 existingCharacters:CharacterMemory[];
 existingEntities:EntityMemory[];
 existingFacts:FactMemory[];
 incomingCharacters:CharacterMemory[];
 incomingEntities:EntityMemory[];
 incomingFacts:FactMemory[];
 chapterNumber:number;
 storyMemory:string;
 memoryStatus?:MemoryStatus;
}){
 const nextCharacters=mergeByName(input.existingCharacters,input.incomingCharacters);
 const nextEntities=mergeByName(input.existingEntities,input.incomingEntities);
 const factMap=new Map(input.existingFacts.map(item=>[item.id,item]));
 let unresolvedReplacement=false;

 for(const incoming of input.incomingFacts){
  const statement=String(incoming?.statement||"").trim();
  if(!statement)continue;

  const requestedReplacement=Boolean(incoming?.replacesId||incoming?.replacesSubjectName||incoming?.replacesStatement);
  const replacesId=resolveReplacementFactId(incoming,input.existingFacts);
  const replacementUnresolved=requestedReplacement&&!replacesId;

  if(replacesId&&factMap.has(replacesId)){
   factMap.set(replacesId,{
    ...factMap.get(replacesId)!,
    status:"superseded",
    lastChapter:input.chapterNumber
   });
  }else if(replacementUnresolved){
   unresolvedReplacement=true;
  }

  const existing=incoming?.id?factMap.get(String(incoming.id)):undefined;
  const id=existing?.id||String(incoming?.id||`fact_${Date.now().toString(36)}_${Math.random().toString(36).slice(2,8)}`);
  const status=replacementUnresolved
   ?"uncertain"
   :(incoming.status==="superseded"||incoming.status==="uncertain"||incoming.status==="active"?incoming.status:"active");

  factMap.set(id,{
   ...existing,
   ...incoming,
   id,
   statement,
   status,
   firstChapter:Number(incoming.firstChapter||existing?.firstChapter||input.chapterNumber),
   lastChapter:Number(incoming.lastChapter||input.chapterNumber),
   replacesId:replacesId||undefined
  });
 }

 const nextFacts=Array.from(factMap.values());
 const aiStatus=input.memoryStatus==="red"||input.memoryStatus==="yellow"||input.memoryStatus==="green"?input.memoryStatus:"green";
 const hasFactChanges=input.incomingFacts.length>0;
 const hasCharacterChanges=input.incomingCharacters.some(incoming=>{
  const old=input.existingCharacters.find(item=>item.id===incoming.id||item.name.trim().toLowerCase()===String(incoming.name||"").trim().toLowerCase());
  return !old || JSON.stringify({...old,lastChapter:undefined})!==JSON.stringify({...old,...incoming,lastChapter:undefined});
 });
 const hasEntityChanges=input.incomingEntities.some(incoming=>{
  const old=input.existingEntities.find(item=>item.id===incoming.id||item.name.trim().toLowerCase()===String(incoming.name||"").trim().toLowerCase());
  return !old || JSON.stringify({...old,lastChapter:undefined})!==JSON.stringify({...old,...incoming,lastChapter:undefined});
 });
 const hasMeaningfulChanges=hasFactChanges||hasCharacterChanges||hasEntityChanges;
 // AI proposes the status; the memory engine is authoritative. A real memory delta
 // cannot be reported green, while unresolved replacement is always red.
 const validatedStatus:MemoryStatus=hasMeaningfulChanges&&aiStatus==="green"?"yellow":aiStatus;
 const memoryStatus:MemoryStatus=unresolvedReplacement?"red":validatedStatus;

 return {
  storyMemory:input.storyMemory.trim(),
  characters:nextCharacters,
  entities:nextEntities,
  facts:nextFacts,
  memoryStatus,
  memoryNeedsUpdate:memoryStatus!=="green",
  unresolvedReplacement
 };
}

function mergeDefined<T extends Record<string,any>>(existing:T,incoming:T){
 const result={...existing} as T;
 for(const [key,value] of Object.entries(incoming)){
  if(value!==undefined) (result as any)[key]=value;
 }
 return result;
}

function mergeById<T extends {id?:string}>(existing:T[],incoming:T[]){
 const map=new Map(existing.map(item=>[String(item.id||JSON.stringify(item)),item]));
 for(const item of incoming){
  const key=String(item.id||JSON.stringify(item));
  const old=map.get(key);
  map.set(key,old?mergeDefined(old,item):item);
 }
 return Array.from(map.values());
}

function mergeArcs(existing:CharacterArc[],incoming:CharacterArc[]){
 const map=new Map(existing.map(item=>[item.character.trim().toLowerCase(),item]));
 for(const item of incoming){
  const key=String(item?.character||"").trim().toLowerCase();
  if(key){
   const old=map.get(key);
   map.set(key,old?mergeDefined(old,item):item);
  }
 }
 return Array.from(map.values());
}

export function mergeStoryIntelligence(input:{
 existingRelationships:RelationshipMemory[];
 existingTimeline:TimelineEvent[];
 existingThreads:StoryThread[];
 existingArcs:CharacterArc[];
 incomingRelationships:RelationshipMemory[];
 incomingTimeline:TimelineEvent[];
 incomingThreads:StoryThread[];
 incomingArcs:CharacterArc[];
}){
 return {
  relationships:mergeById(input.existingRelationships,input.incomingRelationships),
  timeline:mergeById(input.existingTimeline,input.incomingTimeline),
  threads:mergeById(input.existingThreads,input.incomingThreads),
  arcs:mergeArcs(input.existingArcs,input.incomingArcs)
 };
}
