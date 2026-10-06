import {NextResponse} from "next/server";
import {buildContext,contextForPrompt} from "@/lib/contextEngine";

export const runtime="nodejs";
export const dynamic="force-dynamic";
export const maxDuration=60;

const MODEL="gemini-3.8-flash";

function classifyGeminiError(status:number,message:string,errorBody:any){
 const raw=JSON.stringify(errorBody||"")+" "+message;
 const lower=raw.toLowerCase();
 if(status===401||status===403){
  return {code:"API_KEY_ERROR",limitType:null,message:"API key Gemini bermasalah atau tidak diizinkan. Periksa GEMINI_API_KEY, project, dan akses API."};
 }
 if(status===404){
  return {code:"MODEL_ERROR",limitType:null,message:"Model gemini-3.8-flash tidak ditemukan atau tidak tersedia untuk API key ini."};
 }
 if(status===429){
  if(/requests?perday|requests?\s*\/\s*day|generate.*requests.*day|daily|per_day|perday/.test(lower)){
   return {code:"DAILY_QUOTA",limitType:"daily_quota",message:"Daily quota Gemini habis untuk project/model ini. Tunggu sampai jendela kuota harian reset, lalu coba lagi."};
  }
  if(/requests?perminute|requests?\s*\/\s*minute|rpm|per_minute/.test(lower)){
   return {code:"RPM_LIMIT",limitType:"rpm",message:"RPM limit Gemini tercapai. Tunggu sebentar sebelum mengirim request berikutnya."};
  }
  if(/input.*tokens?.*(minute|perminute)|output.*tokens?.*(minute|perminute)|tokens?.*perminute|tpm|token.*limit/.test(lower)){
   return {code:"TPM_LIMIT",limitType:"tpm",message:"TPM limit Gemini tercapai. Request terlalu banyak token dalam jendela waktu ini. Tunggu sebentar lalu coba lagi."};
  }
  return {code:"RATE_LIMIT",limitType:"rate_limit",message:"Gemini menolak request karena rate limit/quota. Detail tidak cukup untuk membedakan daily quota, RPM, atau TPM."};
 }
 if(status===408) return {code:"TIMEOUT",limitType:null,message:"Permintaan ke Gemini terlalu lama. Coba lagi."};
 if(status>=500) return {code:"GEMINI_SERVER_ERROR",limitType:null,message:"Server Gemini sedang mengalami masalah sementara. Coba lagi beberapa saat."};
 return {code:"GEMINI_ERROR",limitType:null,message:"Gemini gagal memproses permintaan. Periksa detail error untuk diagnosis."};
}

export async function GET(){
 const apiKey=process.env.GEMINI_API_KEY;
 return NextResponse.json({ok:true,hasGeminiKey:Boolean(apiKey),model:MODEL});
}

type Action="generate"|"continue"|"improve"|"dialog"|"description"|"summarize"|"memory"|"memoryFoundation"|"storyIntelligence"|"qualityControl";

export async function POST(request:Request){
 try{
  const apiKey=process.env.GEMINI_API_KEY;
  if(!apiKey){
   return NextResponse.json({error:"GEMINI_API_KEY belum dipasang di environment Vercel."},{status:500});
  }

  const body=await request.json();
  const action:Action=body?.action||"generate";
  const novel=body?.novel||{};
  const chapter=body?.chapter||{};
  const previousChapter=body?.previousChapter||null;
  const builder=novel.builder||{};
  const locked=Array.isArray(builder.locked)?builder.locked:[];
  const memory=String(novel.memory||"");
  const chapterSummaries=String(novel.chapterSummaries||"");
  const chapters=Array.isArray(body?.chapters)?body.chapters:[];
  const charactersMemory=Array.isArray(novel.charactersMemory)?novel.charactersMemory:[];
  const entitiesMemory=Array.isArray(novel.entitiesMemory)?novel.entitiesMemory:[];
  const factMemory=Array.isArray(novel.factMemory)?novel.factMemory:[];
  const clip=(value:unknown,max:number)=>String(value??"").trim().slice(0,max);

  const instructions:Record<Action,string>={
   generate:"Mulai Bab 1 dari awal. Tulis bab yang panjang, natural, imersif, dan kaya adegan. Targetkan sekitar 1200-1800 kata.",
   continue:"Lanjutkan cerita tepat setelah AKHIR bab sebelumnya. Jangan mengulang adegan, dialog, tindakan, informasi, atau kejadian yang sudah terjadi. Bagian akhir bab sebelumnya adalah TITIK MULAI cerita ini. Jika bab sebelumnya berakhir saat tokoh sedang berada di suatu tempat, melakukan sesuatu, atau baru mengetahui sesuatu, mulai dari keadaan terakhir tersebut dan bergerak maju. Jangan kembali ke awal bab sebelumnya hanya untuk menjelaskan ulang. Gunakan ringkasan untuk memahami keseluruhan bab dan KONTEKS AKHIR untuk menentukan posisi cerita yang sebenarnya. Targetkan sekitar 1200-1800 kata.",
   improve:"Perbaiki teks bab yang diberikan. Pertahankan inti cerita, fakta, karakter, urutan kejadian, dan gaya penulisannya. Perbaiki kalimat, alur, transisi, dialog, dan konsistensi tanpa mengubah maksud cerita. Kembalikan versi lengkap teks yang sudah diperbaiki.",
   dialog:"Perkaya bagian yang diberikan dengan dialog yang natural dan sesuai karakter. Pertahankan kejadian utama dan jangan mengubah inti cerita. Kembalikan versi lengkap teks yang sudah diperbaiki.",
   description:"Perkaya bagian yang diberikan dengan deskripsi suasana, tempat, ekspresi, gerakan, dan detail inderawi yang relevan. Jangan mengubah inti cerita atau kejadian utama. Kembalikan versi lengkap teks yang sudah diperbaiki.",
   summarize:"Buat ringkasan bab yang padat tetapi informatif. Catat kejadian penting, perubahan hubungan, fakta baru, konflik, keputusan tokoh, lokasi, waktu, dan hal yang harus diingat untuk bab berikutnya. Jangan menambahkan kejadian yang tidak ada. Maksimal sekitar 180 kata.",
   memory:"Bangun Story Memory permanen untuk novel ini. Gabungkan fondasi cerita dengan kejadian yang sudah terjadi. Prioritaskan fakta yang harus konsisten di bab-bab berikutnya: premis, tujuan tokoh, hubungan, rahasia, aturan dunia, konflik, perkembangan penting, fakta waktu/tempat, dan benang cerita yang belum selesai. Hapus detail yang tidak penting. Jangan mengarang fakta baru. Maksimal sekitar 700 kata.",
   memoryFoundation:"Analisis bab ini sebagai satu proses ATOMIK: ringkas bab DAN perbarui Story Memory dalam SATU respons. Ringkasan bab maksimal 180 kata dan tetap disimpan sebagai riwayat permanen bab tersebut. Story Memory adalah satu versi aktif yang diperbarui/ditimpa secara inkremental, bukan salinan memory per bab. Pertahankan fakta lama yang masih relevan, perbarui fakta yang berubah, dan buang detail yang sudah tidak relevan atau duplikatif. Ekstrak karakter dan entitas penting yang muncul atau berubah. Jangan menghapus karakter atau entitas lama hanya karena lama tidak muncul. Pertahankan nama dan ID yang sama jika itu entitas yang sama. Bedakan status aktif, meninggal, pergi, atau tidak diketahui. Tentukan status Story Memory: green jika bab tidak mengubah fakta penting dan Story Memory lama tetap akurat; yellow jika ada perkembangan nyata yang seharusnya masuk ke Story Memory; red jika ada perubahan besar, twist/reveal penting, perubahan tujuan utama, perubahan status karakter penting, aturan dunia baru yang signifikan, resolusi/pembukaan benang cerita besar, atau konflik dengan Story Memory lama. Jika Story Memory masih kosong dan bab ini membentuk fakta inti pertama, gunakan yellow. Untuk green, kembalikan Story Memory lama apa adanya. Untuk yellow/red, kembalikan Story Memory versi terbaru setelah memasukkan perkembangan bab ini. memoryNeedsUpdate true hanya untuk yellow/red. Balas HANYA JSON valid dengan format {\"summary\":\"...\",\"storyMemory\":\"...\",\"characters\":[{\"id\":\"char-nama-normalized\",\"name\":\"...\",\"role\":\"...\",\"description\":\"...\",\"facts\":[\"...\"],\"status\":\"aktif\",\"firstChapter\":1,\"lastChapter\":1}],\"entities\":[{\"id\":\"entity-nama-normalized\",\"name\":\"...\",\"type\":\"location\",\"description\":\"...\",\"facts\":[\"...\"],\"firstChapter\":1,\"lastChapter\":1}],\"facts\":[{\"id\":\"fact-...\",\"subjectId\":\"char-...\",\"subjectType\":\"character\",\"subjectName\":\"...\",\"statement\":\"...\",\"status\":\"active\",\"firstChapter\":1,\"lastChapter\":1,\"replacesId\":\"fact-old-optional\"}],\"memoryStatus\":\"green\",\"memoryNeedsUpdate\":false}. Untuk facts, hanya kembalikan fakta baru atau fakta yang berubah. Jika sebuah fakta lama digantikan, isi replacesId dengan ID fakta lama. Jika tidak ada perubahan fakta, facts harus []. Jangan gunakan markdown.",   qualityControl:"Lakukan Quality Control pada bab ini dengan membandingkan teks bab sekarang terhadap Story Memory, Character Memory, Entity Memory, Relationship Memory, Timeline, Story Threads, Character Arcs, ringkasan bab sebelumnya, dan konteks bab sebelumnya. Cari hanya masalah yang benar-benar didukung bukti: kontinuitas karakter, perubahan status tokoh, kontradiksi timeline, aturan dunia, lokasi/objek, sebab-akibat plot, benang cerita, atau perubahan gaya yang mengganggu. Jangan menganggap detail sebagai masalah hanya karena tidak disebut di bab ini. Bedakan masalah nyata dari kemungkinan/ketidakpastian. Jangan menulis ulang naskah dan jangan mengubah data. Balas HANYA JSON valid dengan format {\"overall\":\"clear\",\"issues\":[{\"severity\":\"high\",\"category\":\"continuity\",\"title\":\"...\",\"evidence\":\"...\",\"suggestion\":\"...\"}]}. Gunakan severity high hanya untuk kontradiksi atau risiko kontinuitas yang jelas, medium untuk hal yang perlu ditinjau, low untuk catatan minor. Maksimal 8 isu dan jika tidak ada masalah penting, issues harus []. Jangan gunakan markdown.",
   storyIntelligence:"Analisis bab ini untuk Story Intelligence. Perbarui hubungan antar karakter, timeline kejadian, benang cerita yang belum selesai, dan perkembangan arc karakter. Pertahankan data lama; jangan menghapus data lama hanya karena tidak muncul di bab ini. Gunakan ID stabil untuk entitas yang sama. Tambahkan timeline hanya untuk kejadian penting bab ini. Pertahankan status thread open/resolved/uncertain berdasarkan bukti. Gabungkan perkembangan baru ke arc karakter. Balas HANYA JSON valid dengan format {relationships:[{id:rel-nama1-nama2,from:Nama 1,to:Nama 2,type:teman,status:aktif,facts:[...],lastChapter:1}],timeline:[{id:event-1-1,chapter:1,title:...,description:...,characters:[...],importance:tinggi}],threads:[{id:thread-nama,title:...,description:...,status:open,lastChapter:1,relatedCharacters:[...]}],arcs:[{character:...,arc:...,currentState:...,turningPoints:[...],lastChapter:1}]}. Jangan gunakan markdown."
  };

  const currentText=clip(chapter.content,12000);
  const previousFullText=String(previousChapter?.content||"").trim();
  // Untuk kontinuitas, bagian akhir bab tetap diprioritaskan.
  const previousEnding=previousFullText.length>8000?previousFullText.slice(-8000):previousFullText;
  const previousSummary=clip(previousChapter?.summary,1500);

  // Context Engine memilih memory yang relevan berdasarkan tugas dan bab aktif.
  // Ia tidak menyimpan memory; ia hanya menyusun ContextResult yang dibutuhkan AI.
  const chapterRecords=[
   ...chapters.map((item:any,index:number)=>({...item,number:Number(item.number||index+1)})),
   {number:Number(chapter.number||0),title:chapter.title,content:currentText,summary:chapter.summary||""}
  ];
  const contextDepth=action==="storyIntelligence"||action==="qualityControl"||action==="memory"
   ?"deep"
   :action==="continue"||action==="memoryFoundation"||action==="summarize"
    ?"normal"
    :"light";
  const context=buildContext(novel,chapterRecords,{
   action,
   depth:contextDepth,
   query:[chapter.title,currentText,previousSummary,previousEnding].filter(Boolean).join("\n"),
   currentChapter:Number(chapter.number||0),
   budget:action==="qualityControl"||action==="storyIntelligence"?30000:undefined
  });
  const retrievedContext=contextForPrompt(context);

  const prompt=[
   "Kamu adalah AI penulis novel untuk aplikasi Novelis.",
   "Gunakan bahasa Indonesia yang natural, imersif, matang, dan enak dibaca.",
   "Jangan memberi catatan, penjelasan, judul tambahan, atau markdown kecuali diminta secara khusus oleh instruksi.",
   "Pertahankan kesinambungan karakter, dunia, konflik, hubungan tokoh, waktu, sebab-akibat, dan outline.",
   instructions[action]||instructions.generate,
   "",
   "FONDASI CERITA",
   "Judul novel: "+(novel.title||"Tanpa judul"),
   "Genre utama/pendukung: "+(novel.genre||"Umum"),
   "Premis: "+(builder.premise||"-"),
   "Tema: "+(builder.theme||"-"),
   "Tone: "+(builder.tone||"-"),
   "Gaya penulisan: "+(builder.style||"-"),
   "Sudut pandang: "+(builder.pointOfView||"-"),
   "Target pembaca: "+(builder.audience||"-"),
   "Panjang novel: "+(builder.length||"-"),
   "Target jumlah bab: "+(builder.chapterTarget||"-"),
   "Jenis ending: "+(builder.ending||"-"),
   "Kebebasan AI: "+(builder.aiFreedom||"-"),
   "CANON TERKUNCI: "+(locked.length?locked.join(", "):"Tidak ada; gunakan penilaian kreatif sesuai brief."),
   "ATURAN CANON: Jika sebuah field termasuk CANON TERKUNCI, jangan mengubahnya, meniadakannya, atau membuat perkembangan yang bertentangan tanpa persetujuan pengguna. Jika tidak dikunci, AI boleh mengembangkan detail secara masuk akal, tetapi tetap menjaga konsistensi dengan keseluruhan cerita." ,
   "Karakter: "+(builder.characters||"-"),
   "Dunia cerita: "+(builder.world||"-"),
   "Outline keseluruhan: "+(builder.outline||"-"),
   retrievedContext ? "KONTEKS TERPILIH OLEH CONTEXT ENGINE:\n"+retrievedContext : "",
   "",
   "BAB: "+(chapter.number||1),
   "JUDUL BAB: "+(chapter.title||"Bab tanpa judul"),
   action==="continue" && previousSummary ? "RINGKASAN BAB SEBELUMNYA:\n"+previousSummary : "",
   action==="continue" && previousEnding ? "KONTEKS AKHIR BAB SEBELUMNYA — TITIK MULAI WAJIB:\n"+previousEnding : "",
   action==="continue" && previousFullText ? "ATURAN KONTINUITAS: Bab baru WAJIB bergerak maju dari kalimat/kejadian terakhir di konteks di atas. Jangan menulis ulang bagian awal bab sebelumnya, jangan mengulang adegan yang sama dengan kata-kata berbeda, dan jangan memulai kembali dari titik waktu yang lebih awal. Ringkasan bab terdahulu adalah konteks historis, sedangkan bagian akhir bab sebelumnya adalah titik mulai aktual." : "",
   action==="qualityControl" && previousEnding ? "KONTEKS AKHIR BAB SEBELUMNYA:\n"+previousEnding : "",
   currentText ? "TEKS BAB SEKARANG:\n"+currentText : ""
  ].filter(Boolean).join("\n\n");

  let response:Response|null=null;
  let result:any=null;
  let lastError="";
  let geminiStatus=0;

  for(let attempt=0;attempt<2;attempt++){
   try{
    const controller=new AbortController();
    const timeout=setTimeout(()=>controller.abort(),50000);
    try{
     response=await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`,{
      method:"POST",
      headers:{"Content-Type":"application/json","x-goog-api-key":apiKey},
      body:JSON.stringify({
       contents:[{role:"user",parts:[{text:prompt}]}],
       generationConfig:{thinkingConfig:{thinkingLevel:"low"},responseMimeType:["memoryFoundation","storyIntelligence","qualityControl"].includes(action)?"application/json":"text/plain"}
      }),
      signal:controller.signal
     });
     result=await response.json();
    }finally{
     clearTimeout(timeout);
    }

    if(response.ok)break;

    geminiStatus=response.status;
    lastError=result?.error?.message||`Gemini gagal menghasilkan cerita (HTTP ${response.status}).`;
    // Jangan otomatis mengulang 429. Rate-limit/quota errors adalah kondisi
    // yang tidak akan pulih hanya dengan request kedua dan retry justru bisa
    // menambah konsumsi kuota. Retry hanya untuk gangguan sementara 408/503.
    const retryable=response.status===503||response.status===408;
    if(retryable&&attempt<1){
     const retryAfter=Number(response.headers.get("retry-after")||0);
     const delay=retryAfter>0?Math.min(retryAfter*1000,8000):2000;
     await new Promise(resolve=>setTimeout(resolve,delay));
     continue;
    }
    break;
   }catch(error){
    lastError=error instanceof Error&&error.name==="AbortError"?"Gemini terlalu lama merespons.":error instanceof Error?error.message:"Koneksi ke Gemini gagal.";
    break;
   }
  }

  if(!response?.ok){
   const timeoutError=lastError==="Gemini terlalu lama merespons.";
   const status=timeoutError?504:geminiStatus===429?429:(geminiStatus>=500?503:502);
   const errorInfo=classifyGeminiError(geminiStatus,lastError,result?.error);
   return NextResponse.json({error:errorInfo.message,code:errorInfo.code,limitType:errorInfo.limitType,detail:lastError,status:geminiStatus||null},{status});
  }

  const text=result?.candidates?.[0]?.content?.parts
   ?.filter((part:{text?:string})=>typeof part.text==="string")
   ?.map((part:{text?:string})=>part.text||"")
   .join("")
   .trim();

  if(!text){
   return NextResponse.json({error:"Gemini tidak mengembalikan teks cerita."},{status:502});
  }

  if(action==="qualityControl"){
   try{
    const cleaned=text.replace(/^```json\s*/,"").replace(/\s*```$/,"").trim();
    const parsed=JSON.parse(cleaned);
    const issues=Array.isArray(parsed.issues)?parsed.issues.slice(0,8).map((item:any)=>({severity:item?.severity==="high"||item?.severity==="medium"||item?.severity==="low"?item.severity:"low",category:typeof item?.category==="string"?item.category:"continuity",title:typeof item?.title==="string"?item.title:"Catatan kontinuitas",evidence:typeof item?.evidence==="string"?item.evidence:"",suggestion:typeof item?.suggestion==="string"?item.suggestion:"Tinjau bagian ini."})):[];
    return NextResponse.json({overall:issues.some((item:any)=>item.severity==="high"||item.severity==="medium")?"review":"clear",issues});
   }catch{return NextResponse.json({error:"Gemini mengembalikan format Quality Control yang tidak valid."},{status:502});}
  }
  if(action==="storyIntelligence"){
   try{
    const parsed=JSON.parse(text.replace(/^```json\s*/,"").replace(/\s*```$/,"").trim());
    return NextResponse.json({relationships:Array.isArray(parsed.relationships)?parsed.relationships:[],timeline:Array.isArray(parsed.timeline)?parsed.timeline:[],threads:Array.isArray(parsed.threads)?parsed.threads:[],arcs:Array.isArray(parsed.arcs)?parsed.arcs:[]});
   }catch{return NextResponse.json({error:"Gemini mengembalikan format Story Intelligence yang tidak valid."},{status:502});}
  }

  if(action==="memoryFoundation"){
   try{
    const parsed=JSON.parse(text.replace(/^```json\s*/,"").replace(/\s*```$/,"").trim());
    const memoryStatus=parsed.memoryStatus==="red"||parsed.memoryStatus==="yellow"||parsed.memoryStatus==="green"?parsed.memoryStatus:(parsed.memoryNeedsUpdate?"yellow":"green");
    return NextResponse.json({
     summary:typeof parsed.summary==="string"?parsed.summary:"",
     storyMemory:typeof parsed.storyMemory==="string"?parsed.storyMemory:"",
     characters:Array.isArray(parsed.characters)?parsed.characters:[],
     entities:Array.isArray(parsed.entities)?parsed.entities:[],
     facts:Array.isArray(parsed.facts)?parsed.facts:[],
     memoryStatus,
     memoryNeedsUpdate:memoryStatus!=="green"
    });
   }catch{
    return NextResponse.json({error:"Gemini mengembalikan format Memory Foundation yang tidak valid."},{status:502});
   }
  }

  return NextResponse.json({text});
 }catch(error){
  return NextResponse.json({
   error:error instanceof Error?error.message:"Terjadi kesalahan saat generate."
  },{status:500});
 }
}
