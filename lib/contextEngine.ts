export type ContextDepth = "light" | "normal" | "deep";

export type ContextAction =
  | "generate"
  | "continue"
  | "improve"
  | "dialog"
  | "description"
  | "summarize"
  | "memory"
  | "memoryFoundation"
  | "storyIntelligence"
  | "qualityControl";

type AnyRecord = Record<string, any>;

export interface ContextRequest {
  action: ContextAction;
  query?: string;
  depth?: ContextDepth;
  budget?: number;
  currentChapter?: number;
}

export interface ContextResult {
  depth: ContextDepth;
  budget: number;
  storyMemory: string;
  canon: string[];
  facts: AnyRecord[];
  characters: AnyRecord[];
  entities: AnyRecord[];
  relationships: AnyRecord[];
  timeline: AnyRecord[];
  threads: AnyRecord[];
  arcs: AnyRecord[];
  recentChapters: AnyRecord[];
  metadata: {
    counts: Record<string, number>;
    reasons: Record<string, string[]>;
  };
}

const DEFAULT_BUDGETS:Record<ContextDepth,number> = {
  light: 9000,
  normal: 18000,
  deep: 32000
};

const LIMITS:Record<ContextDepth,Record<string,number>> = {
  light: {facts:18,characters:8,entities:8,relationships:6,timeline:6,threads:6,arcs:6,recentChapters:2},
  normal: {facts:30,characters:14,entities:14,relationships:10,timeline:12,threads:10,arcs:10,recentChapters:4},
  deep: {facts:60,characters:30,entities:30,relationships:24,timeline:24,threads:20,arcs:20,recentChapters:8}
};

function text(value:any){return String(value ?? "").trim();}
function lower(value:any){return text(value).toLowerCase();}
function words(value:string){
  return lower(value).split(/[^a-z0-9\u00C0-\u024F]+/gi).filter(v=>v.length>=3);
}
function unique(values:string[]){
  return Array.from(new Set(values.filter(Boolean)));
}
function entityTerms(item:AnyRecord){
  return unique([
    lower(item.name),
    lower(item.subjectName),
    lower(item.character),
    lower(item.from),
    lower(item.to),
    ...((Array.isArray(item.characters)?item.characters:[]).map(v=>lower(v))),
    ...((Array.isArray(item.relatedCharacters)?item.relatedCharacters:[]).map(v=>lower(v)))
  ].filter(v=>v.length>=2));
}

function scoreItem(item:AnyRecord, queryTerms:string[], currentChapter:number){
  const hay = lower([
    item.name,item.subjectName,item.statement,item.description,item.title,item.arc,item.currentState,
    item.type,item.status,item.from,item.to,
    ...(Array.isArray(item.facts)?item.facts:[]),
    ...(Array.isArray(item.turningPoints)?item.turningPoints:[]),
    ...(Array.isArray(item.characters)?item.characters:[]),
    ...(Array.isArray(item.relatedCharacters)?item.relatedCharacters:[])
  ].join(" "));
  const exactTerms = entityTerms(item);
  let score = 0;
  let reason = "base relevance";

  for(const term of queryTerms){
    if(!term) continue;
    if(exactTerms.includes(term)){score += 12; reason = "direct entity match";}
    else if(hay.includes(term)){score += 4; reason = "query match";}
  }

  const last = Number(item.lastChapter || item.chapter || 0);
  if(last > 0 && currentChapter > 0){
    const distance = Math.abs(currentChapter-last);
    score += Math.max(0, 5 - Math.min(5,distance/10));
    if(distance <= 3) reason = "recent chapter";
  }

  if(item.status === "active" || item.status === "open") score += 2;
  if(item.status === "uncertain") score -= 1;

  return {item,score,reason};
}

function rank(items:AnyRecord[], query:string, currentChapter:number, limit:number){
  const queryTerms = unique([
    ...words(query),
    ...query.split(/[,.;:!?\n]+/).map(v=>lower(v)).filter(v=>v.length>=2)
  ]);
  return items
    .map(item=>scoreItem(item,queryTerms,currentChapter))
    .sort((a,b)=>b.score-a.score)
    .slice(0,limit);
}

function approxSize(value:any){
  return JSON.stringify(value).length;
}

function trimToBudget(result:ContextResult){
  const sections=[
    "recentChapters","facts","characters","entities","relationships","timeline","threads","arcs"
  ] as const;
  let used=approxSize(result.storyMemory)+approxSize(result.canon);
  for(const section of sections){
    const arr=(result as any)[section] as AnyRecord[];
    while(arr.length && used+approxSize(arr)>result.budget){
      arr.pop();
    }
    used+=approxSize(arr);
  }
  return result;
}

export function buildContext(
  novel:AnyRecord,
  chapters:AnyRecord[],
  request:ContextRequest
):ContextResult{
  const action = request.action;
  const depth = request.depth || (
    action==="storyIntelligence" || action==="qualityControl" || action==="memory"
      ? "deep"
      : action==="continue" || action==="memoryFoundation" || action==="summarize"
        ? "normal"
        : "light"
  );
  const budget = Math.max(4000, request.budget || DEFAULT_BUDGETS[depth]);
  const limits = LIMITS[depth];
  const currentChapter = Number(request.currentChapter || 0);
  const current = chapters.find((c:any)=>Number(c.number)===currentChapter);
  const query = [
    request.query || "",
    current?.title || "",
    current?.content || "",
    novel?.title || "",
    novel?.builder?.premise || "",
    novel?.builder?.outline || ""
  ].join(" ");

  const storyMemory = text(novel?.memory);
  const canon = Array.isArray(novel?.builder?.locked)
    ? novel.builder.locked.map((v:any)=>text(v)).filter(Boolean)
    : [];

  // Superseded facts remain in persistent memory for history/replacement tracking,
  // but must never compete with active/uncertain facts for AI context.
  const allFacts=Array.isArray(novel?.factMemory)?novel.factMemory:[];
  const contextFacts=allFacts.filter((item:any)=>item?.status!=="superseded");
  let factsRanked = rank(contextFacts,query,currentChapter,limits.facts);
  const charsRanked = rank(Array.isArray(novel?.charactersMemory)?novel.charactersMemory:[],query,currentChapter,limits.characters);
  const entitiesRanked = rank(Array.isArray(novel?.entitiesMemory)?novel.entitiesMemory:[],query,currentChapter,limits.entities);
  if(action==="memoryFoundation"){
    const relevantSubjects=new Set([...charsRanked.map(x=>lower(x.item.name)),...entitiesRanked.map(x=>lower(x.item.name)),...factsRanked.map(x=>lower(x.item.subjectName))].filter(Boolean));
    const selected=new Map(factsRanked.map(x=>[String(x.item.id||JSON.stringify(x.item)),x]));
    allFacts.filter((item:any)=>item.status!=="superseded"&&relevantSubjects.has(lower(item.subjectName)))
      .sort((a:any,b:any)=>Number(b.lastChapter||0)-Number(a.lastChapter||0))
      .slice(0,120)
      .forEach((item:any)=>{
        const key=String(item.id||JSON.stringify(item));
        if(!selected.has(key))selected.set(key,{item,score:0,reason:"subject history"});
      });
    factsRanked=Array.from(selected.values());
  }
  const relRanked = rank(Array.isArray(novel?.relationshipsMemory)?novel.relationshipsMemory:[],query,currentChapter,limits.relationships);
  const timelineRanked = rank(Array.isArray(novel?.timeline)?novel.timeline:[],query,currentChapter,limits.timeline);
  const threadsRanked = rank(Array.isArray(novel?.storyThreads)?novel.storyThreads:[],query,currentChapter,limits.threads);
  const arcsRanked = rank(Array.isArray(novel?.characterArcs)?novel.characterArcs:[],query,currentChapter,limits.arcs);

  const recentChapters = chapters
    .map((chapter:any,index:number)=>({...chapter,__index:index+1}))
    .filter((chapter:any)=>chapter.__index < currentChapter || !currentChapter)
    .sort((a:any,b:any)=>b.__index-a.__index)
    .slice(0,limits.recentChapters)
    .map((chapter:any)=>({
      number:chapter.__index,
      title:text(chapter.title),
      summary:text(chapter.summary)
    }));

  const result:ContextResult = {
    depth,budget,storyMemory,canon,
    facts:factsRanked.map(x=>x.item),
    characters:charsRanked.map(x=>x.item),
    entities:entitiesRanked.map(x=>x.item),
    relationships:relRanked.map(x=>x.item),
    timeline:timelineRanked.map(x=>x.item),
    threads:threadsRanked.map(x=>x.item),
    arcs:arcsRanked.map(x=>x.item),
    recentChapters,
    metadata:{
      counts:{
        facts:factsRanked.length,
        characters:charsRanked.length,
        entities:entitiesRanked.length,
        relationships:relRanked.length,
        timeline:timelineRanked.length,
        threads:threadsRanked.length,
        arcs:arcsRanked.length,
        recentChapters:recentChapters.length
      },
      reasons:{
        facts:factsRanked.slice(0,5).map(x=>x.reason),
        characters:charsRanked.slice(0,5).map(x=>x.reason),
        entities:entitiesRanked.slice(0,5).map(x=>x.reason)
      }
    }
  };

  return trimToBudget(result);
}

export function contextForPrompt(context:ContextResult){
  return [
    context.storyMemory ? "STORY MEMORY:\n"+context.storyMemory : "",
    context.canon.length ? "CANON TERKUNCI:\n"+context.canon.map(v=>"- "+v).join("\n") : "",
    context.facts.length ? "FAKTA RELEVAN:\n"+JSON.stringify(context.facts) : "",
    context.characters.length ? "KARAKTER RELEVAN:\n"+JSON.stringify(context.characters) : "",
    context.entities.length ? "ENTITAS RELEVAN:\n"+JSON.stringify(context.entities) : "",
    context.relationships.length ? "HUBUNGAN RELEVAN:\n"+JSON.stringify(context.relationships) : "",
    context.timeline.length ? "TIMELINE RELEVAN:\n"+JSON.stringify(context.timeline) : "",
    context.threads.length ? "BENANG CERITA RELEVAN:\n"+JSON.stringify(context.threads) : "",
    context.arcs.length ? "ARC KARAKTER RELEVAN:\n"+JSON.stringify(context.arcs) : "",
    context.recentChapters.length ? "RINGKASAN BAB TERDEKAT:\n"+JSON.stringify(context.recentChapters) : ""
  ].filter(Boolean).join("\n\n");
}
