export type AIAction =
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

export interface AIRequest {
  requestId?: string;
  novelId?: string;
  chapterId?: string;
  action: AIAction;
  chapterVersion?: string | number;
  prompt: string;
  options?: {
    model?: string;
    timeoutMs?: number;
    maxRetries?: number;
  };
}

export interface AIUsage {
  inputTokens?: number;
  outputTokens?: number;
  totalTokens?: number;
}

export interface AIResult {
  requestId: string;
  action: AIAction;
  status: "success" | "error";
  content: string | null;
  structured: unknown | null;
  usage: AIUsage | null;
  model: string;
  durationMs: number;
}

type GeminiErrorInfo={
  code:string;
  limitType:string|null;
  message:string;
};

const DEFAULT_MODEL=process.env.GEMINI_MODEL||"gemini-3.8-flash";
const DEFAULT_TIMEOUT=26000;
const DEFAULT_RETRIES=1;

function requestId(){
 return "req_"+Date.now().toString(36)+"_"+Math.random().toString(36).slice(2,9);
}

function classifyError(status:number,message:string,errorBody:any):GeminiErrorInfo{
 const raw=JSON.stringify(errorBody||"")+" "+message;
 const lower=raw.toLowerCase();
 if(status===401||status===403)return {code:"API_KEY_ERROR",limitType:null,message:"API key Gemini bermasalah atau tidak diizinkan. Periksa GEMINI_API_KEY, project, dan akses API."};
 if(status===404)return {code:"MODEL_ERROR",limitType:null,message:"Model Gemini tidak ditemukan atau tidak tersedia untuk API key ini."};
 if(status===429){
  if(/requests?perday|requests?\s*\/\s*day|generate.*requests.*day|daily|per_day|perday/.test(lower))return {code:"DAILY_QUOTA",limitType:"daily_quota",message:"Daily quota Gemini habis untuk project/model ini. Tunggu sampai jendela kuota harian reset, lalu coba lagi."};
  if(/requests?perminute|requests?\s*\/\s*minute|rpm|per_minute/.test(lower))return {code:"RPM_LIMIT",limitType:"rpm",message:"RPM limit Gemini tercapai. Tunggu sebentar sebelum mengirim request berikutnya."};
  if(/input.*tokens?.*(minute|perminute)|output.*tokens?.*(minute|perminute)|tokens?.*perminute|tpm|token.*limit/.test(lower))return {code:"TPM_LIMIT",limitType:"tpm",message:"TPM limit Gemini tercapai. Request terlalu banyak token dalam jendela waktu ini. Tunggu sebentar lalu coba lagi."};
  return {code:"RATE_LIMIT",limitType:"rate_limit",message:"Gemini menolak request karena rate limit/quota. Detail tidak cukup untuk membedakan daily quota, RPM, atau TPM."};
 }
 if(status===408)return {code:"TIMEOUT",limitType:null,message:"Permintaan ke Gemini terlalu lama. Coba lagi."};
 if(status>=500)return {code:"GEMINI_SERVER_ERROR",limitType:null,message:"Server Gemini sedang mengalami masalah sementara. Coba lagi beberapa saat."};
 return {code:"GEMINI_ERROR",limitType:null,message:"Gemini gagal memproses permintaan. Periksa detail error untuk diagnosis."};
}

function cleanJson(value:string){
 return value.replace(/^\s*\`\`\`json\s*/i,"").replace(/\s*\`\`\`\s*$/,"").trim();
}

function cleanString(value:unknown,max=4000){
 const valueText=String(value??"").trim();
 return valueText.slice(0,max);
}

const QUALITY_SEVERITIES=["high","medium","low"] as const;
const QUALITY_CATEGORIES=["continuity","character","timeline","world","plot","style"] as const;

function normalizeQualityIssue(value:any){
 if(!value||typeof value!=="object")return null;
 const severity=QUALITY_SEVERITIES.includes(value.severity)?value.severity:"low";
 const category=QUALITY_CATEGORIES.includes(value.category)?value.category:"continuity";
 const title=cleanString(value.title,300);
 const evidence=cleanString(value.evidence,1200);
 const suggestion=cleanString(value.suggestion,1200);
 if(!title||!evidence||!suggestion)return null;
 return {severity,category,title,evidence,suggestion};
}

function parseStructured(action:AIAction,text:string){
 if(!["memoryFoundation","storyIntelligence","qualityControl"].includes(action))return null;
 try{
  const parsed=JSON.parse(cleanJson(text));
  if(!parsed||typeof parsed!=="object")return null;
  if(action==="qualityControl"){
   const issues=Array.isArray(parsed.issues)
    ?parsed.issues.map(normalizeQualityIssue).filter(Boolean).slice(0,8)
    :[];
   return {
    overall:issues.some((item:any)=>item.severity==="high"||item.severity==="medium")?"review":"clear",
    issues
   };
  }
  if(action==="storyIntelligence"){
   return {
    relationships:Array.isArray(parsed.relationships)?parsed.relationships.filter((item:any)=>item&&typeof item==="object"):[],
    timeline:Array.isArray(parsed.timeline)?parsed.timeline.filter((item:any)=>item&&typeof item==="object"):[],
    threads:Array.isArray(parsed.threads)?parsed.threads.filter((item:any)=>item&&typeof item==="object"):[],
    arcs:Array.isArray(parsed.arcs)?parsed.arcs.filter((item:any)=>item&&typeof item==="object"):[]
   };
  }
  const memoryStatus=parsed.memoryStatus==="red"||parsed.memoryStatus==="yellow"||parsed.memoryStatus==="green"
   ?parsed.memoryStatus
   :(parsed.memoryNeedsUpdate?"yellow":"green");
  return {
   summary:cleanString(parsed.summary,6000),
   storyMemory:cleanString(parsed.storyMemory,12000),
   characters:Array.isArray(parsed.characters)?parsed.characters.filter((item:any)=>item&&typeof item==="object"):[],
   entities:Array.isArray(parsed.entities)?parsed.entities.filter((item:any)=>item&&typeof item==="object"):[],
   facts:Array.isArray(parsed.facts)?parsed.facts.filter((item:any)=>item&&typeof item==="object"):[],
   memoryStatus,
   memoryNeedsUpdate:memoryStatus!=="green"
  };
 }catch{
  return null;
 }
}

export async function executeAI(request:AIRequest):Promise<AIResult>{
 const started=Date.now();
 const id=request.requestId||requestId();
 const apiKey=process.env.GEMINI_API_KEY;
 const model=request.options?.model||DEFAULT_MODEL;
 const timeoutMs=Math.max(5000,request.options?.timeoutMs||DEFAULT_TIMEOUT);
 const maxRetries=Math.max(0,request.options?.maxRetries??DEFAULT_RETRIES);

 if(!apiKey){
  throw Object.assign(new Error("GEMINI_API_KEY belum dipasang di environment Vercel."),{code:"API_KEY_MISSING",status:500});
 }

 let lastError:GeminiErrorInfo={code:"GEMINI_ERROR",limitType:null,message:"Gemini gagal memproses permintaan."};
 let lastStatus=0;

 for(let attempt=0;attempt<=maxRetries;attempt++){
  const controller=new AbortController();
  const timer=setTimeout(()=>controller.abort(),timeoutMs);
  try{
   const response=await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,{
    method:"POST",
    headers:{"Content-Type":"application/json","x-goog-api-key":apiKey},
    body:JSON.stringify({
     contents:[{role:"user",parts:[{text:request.prompt}]}],
     generationConfig:{
      thinkingConfig:{thinkingLevel:"low"},
      responseMimeType:["memoryFoundation","storyIntelligence","qualityControl"].includes(request.action)?"application/json":"text/plain"
     }
    }),
    signal:controller.signal
   });
   const body=await response.json();
   if(response.ok){
    const content=body?.candidates?.[0]?.content?.parts
     ?.filter((part:{text?:string})=>typeof part.text==="string")
     ?.map((part:{text?:string})=>part.text||"")
     .join("")
     .trim()||"";
    if(!content){
     throw Object.assign(new Error("Gemini tidak mengembalikan teks."),{code:"EMPTY_RESPONSE",status:502});
    }
    const structured=parseStructured(request.action,content);
    if(["memoryFoundation","storyIntelligence","qualityControl"].includes(request.action)&&structured===null){
     throw Object.assign(new Error("Gemini mengembalikan JSON terstruktur yang tidak valid untuk aksi "+request.action+"."),{
      code:"INVALID_STRUCTURED_OUTPUT",
      status:502
     });
    }
    const usage=body?.usageMetadata;
    return {
     requestId:id,
     action:request.action,
     status:"success",
     content,
     structured,
     usage:usage?{
      inputTokens:Number(usage.promptTokenCount||0)||undefined,
      outputTokens:Number(usage.candidatesTokenCount||0)||undefined,
      totalTokens:Number(usage.totalTokenCount||0)||undefined
     }:null,
     model,
     durationMs:Date.now()-started
    };
   }

   lastStatus=response.status;
   lastError=classifyError(response.status,body?.error?.message||"",body?.error);

   // 429/quota tidak di-retry otomatis. 408/503 saja yang boleh retry.
   if((response.status===408||response.status===503)&&attempt<maxRetries){
    const retryAfter=Number(response.headers.get("retry-after")||0);
    const backoff=2000*Math.pow(2,attempt);
    const jitter=Math.floor(Math.random()*350);
    const delay=retryAfter>0?Math.min(retryAfter*1000,10000):Math.min(backoff+jitter,8000);
    await new Promise(resolve=>setTimeout(resolve,delay));
    continue;
   }
   break;
  }catch(error){
   if(error instanceof Error&&error.name==="AbortError"){
    lastError={code:"TIMEOUT",limitType:null,message:"Permintaan ke Gemini terlalu lama. Coba lagi."};
   }else if(error instanceof Error){
    lastError={code:(error as any).code||"GEMINI_CONNECTION_ERROR",limitType:null,message:error.message};
   }
   lastStatus=(error as any)?.status||lastStatus||0;
   break;
  }finally{
   clearTimeout(timer);
  }
 }

 const error=Object.assign(new Error(lastError.message),{
  code:lastError.code,
  limitType:lastError.limitType,
  status:lastStatus===429?429:lastError.code==="TIMEOUT"?504:lastStatus>=500?503:502,
  geminiStatus:lastStatus,
  requestId:id
 });
 throw error;
}

export function aiModel(){
 return DEFAULT_MODEL;
}
