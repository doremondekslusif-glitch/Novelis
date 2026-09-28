import {NextResponse} from "next/server";

export const runtime="nodejs";
export const dynamic="force-dynamic";
export const maxDuration=60;

const MODEL="gemini-3.8-flash";

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
  const memory=String(novel.memory||"");
  const chapterSummaries=String(novel.chapterSummaries||"");
  const chapters=Array.isArray(body?.chapters)?body.chapters:[];
  const charactersMemory=Array.isArray(novel.charactersMemory)?novel.charactersMemory:[];
  const entitiesMemory=Array.isArray(novel.entitiesMemory)?novel.entitiesMemory:[];
  const clip=(value:unknown,max:number)=>String(value??"").trim().slice(0,max);

  const instructions:Record<Action,string>={
   generate:"Mulai Bab 1 dari awal. Tulis bab yang panjang, natural, imersif, dan kaya adegan. Targetkan sekitar 1200-1800 kata.",
   continue:"Lanjutkan cerita dari konteks terakhir yang diberikan. Jangan mengulang teks sebelumnya. Pastikan pembuka bab menyambung secara alami dengan kejadian bab sebelumnya. Targetkan sekitar 1200-1800 kata.",
   improve:"Perbaiki teks bab yang diberikan. Pertahankan inti cerita, fakta, karakter, urutan kejadian, dan gaya penulisannya. Perbaiki kalimat, alur, transisi, dialog, dan konsistensi tanpa mengubah maksud cerita. Kembalikan versi lengkap teks yang sudah diperbaiki.",
   dialog:"Perkaya bagian yang diberikan dengan dialog yang natural dan sesuai karakter. Pertahankan kejadian utama dan jangan mengubah inti cerita. Kembalikan versi lengkap teks yang sudah diperbaiki.",
   description:"Perkaya bagian yang diberikan dengan deskripsi suasana, tempat, ekspresi, gerakan, dan detail inderawi yang relevan. Jangan mengubah inti cerita atau kejadian utama. Kembalikan versi lengkap teks yang sudah diperbaiki.",
   summarize:"Buat ringkasan bab yang padat tetapi informatif. Catat kejadian penting, perubahan hubungan, fakta baru, konflik, keputusan tokoh, lokasi, waktu, dan hal yang harus diingat untuk bab berikutnya. Jangan menambahkan kejadian yang tidak ada. Maksimal sekitar 180 kata.",
   memory:"Bangun Story Memory permanen untuk novel ini. Gabungkan fondasi cerita dengan kejadian yang sudah terjadi. Prioritaskan fakta yang harus konsisten di bab-bab berikutnya: premis, tujuan tokoh, hubungan, rahasia, aturan dunia, konflik, perkembangan penting, fakta waktu/tempat, dan benang cerita yang belum selesai. Hapus detail yang tidak penting. Jangan mengarang fakta baru. Maksimal sekitar 700 kata.",
   memoryFoundation:"Analisis bab ini untuk Memory Foundation. Buat ringkasan bab maksimal 180 kata. Ekstrak karakter dan entitas penting yang muncul atau berubah. Gabungkan dengan data yang sudah ada. Jangan menghapus karakter atau entitas lama hanya karena lama tidak muncul. Pertahankan nama dan ID yang sama jika itu entitas yang sama. Bedakan status aktif, meninggal, pergi, atau tidak diketahui. Tentukan memoryNeedsUpdate=true hanya jika ada perubahan penting pada alur utama, rahasia, tujuan, konflik, hubungan utama, aturan dunia, atau status penting karakter. Balas HANYA JSON valid dengan format {\"summary\":\"...\",\"characters\":[{\"id\":\"char-nama-normalized\",\"name\":\"...\",\"role\":\"...\",\"description\":\"...\",\"facts\":[\"...\"],\"status\":\"aktif\",\"firstChapter\":1,\"lastChapter\":1}],\"entities\":[{\"id\":\"entity-nama-normalized\",\"name\":\"...\",\"type\":\"location\",\"description\":\"...\",\"facts\":[\"...\"],\"firstChapter\":1,\"lastChapter\":1}],\"memoryNeedsUpdate\":false}. Jangan gunakan markdown.",
   qualityControl:"Lakukan Quality Control pada bab ini dengan membandingkan teks bab sekarang terhadap Story Memory, Character Memory, Entity Memory, Relationship Memory, Timeline, Story Threads, Character Arcs, ringkasan bab sebelumnya, dan konteks bab sebelumnya. Cari hanya masalah yang benar-benar didukung bukti: kontinuitas karakter, perubahan status tokoh, kontradiksi timeline, aturan dunia, lokasi/objek, sebab-akibat plot, benang cerita, atau perubahan gaya yang mengganggu. Jangan menganggap detail sebagai masalah hanya karena tidak disebut di bab ini. Bedakan masalah nyata dari kemungkinan/ketidakpastian. Jangan menulis ulang naskah dan jangan mengubah data. Balas HANYA JSON valid dengan format {\"overall\":\"clear\",\"issues\":[{\"severity\":\"high\",\"category\":\"continuity\",\"title\":\"...\",\"evidence\":\"...\",\"suggestion\":\"...\"}]}. Gunakan severity high hanya untuk kontradiksi atau risiko kontinuitas yang jelas, medium untuk hal yang perlu ditinjau, low untuk catatan minor. Maksimal 8 isu dan jika tidak ada masalah penting, issues harus []. Jangan gunakan markdown.",
   storyIntelligence:"Analisis bab ini untuk Story Intelligence. Perbarui hubungan antar karakter, timeline kejadian, benang cerita yang belum selesai, dan perkembangan arc karakter. Pertahankan data lama; jangan menghapus data lama hanya karena tidak muncul di bab ini. Gunakan ID stabil untuk entitas yang sama. Tambahkan timeline hanya untuk kejadian penting bab ini. Pertahankan status thread open/resolved/uncertain berdasarkan bukti. Gabungkan perkembangan baru ke arc karakter. Balas HANYA JSON valid dengan format {relationships:[{id:rel-nama1-nama2,from:Nama 1,to:Nama 2,type:teman,status:aktif,facts:[...],lastChapter:1}],timeline:[{id:event-1-1,chapter:1,title:...,description:...,characters:[...],importance:tinggi}],threads:[{id:thread-nama,title:...,description:...,status:open,lastChapter:1,relatedCharacters:[...]}],arcs:[{character:...,arc:...,currentState:...,turningPoints:[...],lastChapter:1}]}. Jangan gunakan markdown."
  };

  const currentText=clip(chapter.content,12000);
  const previousText=clip(previousChapter?.content,6000);
  const summaries=clip(chapterSummaries,7000);
  const storyMemory=clip(memory,7000);

  const foundationData=[
   charactersMemory.length?"KARAKTER YANG SUDAH DIKENAL:\n"+JSON.stringify(charactersMemory):"",
   entitiesMemory.length?"ENTITAS YANG SUDAH DIKENAL:\n"+JSON.stringify(entitiesMemory):""
  ].filter(Boolean).join("\n\n");

  const chapterData=chapters.map((item:{title?:string;content?:string;summary?:string},index:number)=>{
   const summary=clip(item.summary,1200);
   const content=clip(item.content,2500);
   return "BAB "+(index+1)+" — "+(item.title||("Bab "+(index+1)))+"\nRingkasan: "+(summary||"-")+"\nIsi penting: "+(content||"-");
  }).join("\n\n");

  const prompt=[
   "Kamu adalah AI penulis novel untuk aplikasi Novelis.",
   "Gunakan bahasa Indonesia yang natural, imersif, matang, dan enak dibaca.",
   "Jangan memberi catatan, penjelasan, judul tambahan, atau markdown kecuali diminta secara khusus oleh instruksi.",
   "Pertahankan kesinambungan karakter, dunia, konflik, hubungan tokoh, waktu, sebab-akibat, dan outline.",
   instructions[action]||instructions.generate,
   "",
   "FONDASI CERITA",
   "Judul novel: "+(novel.title||"Tanpa judul"),
   "Genre: "+(novel.genre||"Umum"),
   "Premis: "+(builder.premise||"-"),
   "Karakter: "+(builder.characters||"-"),
   "Dunia cerita: "+(builder.world||"-"),
   "Outline keseluruhan: "+(builder.outline||"-"),
   storyMemory ? "STORY MEMORY YANG HARUS DIJAGA:\n"+storyMemory : "",
   summaries ? "RINGKASAN BAB TERDAHULU:\n"+summaries : "",
   action==="memory" && chapterData ? "DATA BAB UNTUK MEMBANGUN MEMORY:\n"+chapterData : "",
   action==="memoryFoundation" && foundationData ? foundationData : "",
   action==="storyIntelligence"||action==="qualityControl" ? "STORY INTELLIGENCE LAMA:\n"+JSON.stringify({relationships:novel.relationshipsMemory||[],timeline:novel.timeline||[],threads:novel.storyThreads||[],arcs:novel.characterArcs||[]}) : "",
   "",
   "BAB: "+(chapter.number||1),
   "JUDUL BAB: "+(chapter.title||"Bab tanpa judul"),
   action!=="memory" && previousText ? "KONTEKS AKHIR BAB SEBELUMNYA:\n"+previousText : "",
   currentText ? "TEKS BAB SEKARANG:\n"+currentText : ""
  ].filter(Boolean).join("\n\n");

  let response:Response|null=null;
  let result:any=null;
  let lastError="";
  let geminiStatus=0;

  for(let attempt=0;attempt<2;attempt++){
   try{
    const controller=new AbortController();
    const timeout=setTimeout(()=>controller.abort(),25000);
    try{
     response=await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`,{
      method:"POST",
      headers:{"Content-Type":"application/json","x-goog-api-key":apiKey},
      body:JSON.stringify({
       contents:[{role:"user",parts:[{text:prompt}]}],
       generationConfig:{thinkingConfig:{thinkingLevel:"low"},responseMimeType:action==="memoryFoundation"?"application/json":"text/plain"}
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
    if(response.status===429 && attempt<1){
     await new Promise(resolve=>setTimeout(resolve,1200));
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
   const error=timeoutError
    ?"Gemini terlalu lama merespons. Coba lagi beberapa saat."
    :geminiStatus===401||geminiStatus===403
      ?"Gemini menolak API key. Periksa GEMINI_API_KEY di environment Vercel."
      :geminiStatus===404
        ?`Model ${MODEL} tidak ditemukan atau tidak tersedia untuk API key ini.`
        :geminiStatus===429
          ?"Batas penggunaan Gemini tercapai. Tunggu sebentar lalu coba lagi. Jika terus muncul, cek kuota/RPM/TPM project Gemini yang dipakai API key ini."
          :"Gemini gagal memproses permintaan.";
   return NextResponse.json({error,detail:lastError,status:geminiStatus||null},{status});
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
    return NextResponse.json({
     summary:typeof parsed.summary==="string"?parsed.summary:"",
     characters:Array.isArray(parsed.characters)?parsed.characters:[],
     entities:Array.isArray(parsed.entities)?parsed.entities:[],
     memoryNeedsUpdate:Boolean(parsed.memoryNeedsUpdate)
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
