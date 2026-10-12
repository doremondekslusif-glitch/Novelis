export type GenerationJobAction="generate"|"continue";

export interface GenerationJob{
 id:string;
 novelId:string;
 chapterId:string;
 action:GenerationJobAction;
 title:string;
 baseText:string;
 accumulatedText:string;
 nextScene:number;
 sceneCount:number;
 targetWords?:number;
 createdAt:string;
 updatedAt:string;
 status:"running"|"paused"|"completed"|"failed";
 error?:string;
}

const STORAGE_PREFIX="novelis:generation-job:";

function key(novelId:string,chapterId:string){return STORAGE_PREFIX+novelId+":"+chapterId;}

export function sceneCountForChapter(targetMin:number,targetMax:number,existingWords=0,targetWords?:number){
 const goal=Math.max(1,Math.floor(targetWords||Math.round((targetMin+targetMax)/2)));
 const remaining=Math.max(400,goal-Math.max(0,existingWords));
 return Math.max(1,Math.min(8,Math.ceil(remaining/400)));
}

export function loadGenerationJob(novelId:string,chapterId:string){
 try{
  const raw=localStorage.getItem(key(novelId,chapterId));
  if(!raw)return null;
  const job=JSON.parse(raw) as GenerationJob;
  if(!job||job.novelId!==novelId||job.chapterId!==chapterId)return null;
  return job;
 }catch{return null}
}

export function saveGenerationJob(job:GenerationJob){
 try{
  localStorage.setItem(key(job.novelId,job.chapterId),JSON.stringify(job));
 }catch(error){console.error("Novelis generation checkpoint failed",error)}
}

export function clearGenerationJob(novelId:string,chapterId:string){
 try{localStorage.removeItem(key(novelId,chapterId))}catch(error){console.error("Novelis generation checkpoint cleanup failed",error)}
}

export function createGenerationJob(args:{
 novelId:string;
 chapterId:string;
 action:GenerationJobAction;
 title:string;
 baseText:string;
 sceneCount:number;
 targetWords?:number;
}):GenerationJob{
 const now=new Date().toISOString();
 return {
  id:"gen_"+Date.now().toString(36)+"_"+Math.random().toString(36).slice(2,8),
  novelId:args.novelId,
  chapterId:args.chapterId,
  action:args.action,
  title:args.title,
  baseText:args.baseText,
  accumulatedText:args.baseText,
  nextScene:0,
  sceneCount:args.sceneCount,
  targetWords:args.targetWords,
  createdAt:now,
  updatedAt:now,
  status:"running"
 };
}
