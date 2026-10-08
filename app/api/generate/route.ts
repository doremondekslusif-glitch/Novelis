import {NextResponse} from "next/server";
import {buildContext,contextForPrompt} from "@/lib/contextEngine";
import {executeAI,aiModel,type AIAction} from "@/lib/aiEngine";
import {getChapterWordTarget} from "@/lib/genreProfile";

export const runtime="nodejs";
export const dynamic="force-dynamic";
export const maxDuration=60;

export async function GET(){
 const apiKey=process.env.GEMINI_API_KEY;
 return NextResponse.json({ok:true,hasGeminiKey:Boolean(apiKey),model:aiModel()});
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
  const chapterWordTarget=getChapterWordTarget(String(novel.genre||""),String(builder.length||"sedang"));
  const chapterTargetText=`${chapterWordTarget.min}–${chapterWordTarget.max} kata`;
  const sceneIndex=Math.max(0,Number(body?.sceneIndex||0));
  const sceneCount=Math.max(1,Number(body?.sceneCount||1));
  const sceneMin=Math.max(200,Math.floor(chapterWordTarget.min/sceneCount));
  const sceneMax=Math.max(sceneMin,Math.ceil(chapterWordTarget.max/sceneCount));
  const isSceneGeneration=(action==="generate"||action==="continue")&&sceneCount>1;
  const clip=(value:unknown,max:number)=>String(value??"").trim().slice(0,max);

  const instructions:Record<Action,string>={
   generate:"Mulai Bab 1 dari awal. Tulis bab yang natural, imersif, dan kaya adegan. Target panjang bab untuk genre dan skala novel ini adalah "+chapterTargetText+". Jadikan rentang ini sebagai target utama, tetapi biarkan adegan berhenti secara natural jika struktur cerita sudah selesai.",
   continue:"Lanjutkan cerita tepat setelah AKHIR bab sebelumnya. Jangan mengulang adegan, dialog, tindakan, informasi, atau kejadian yang sudah terjadi. Bagian akhir bab sebelumnya adalah TITIK MULAI cerita ini. Jika bab sebelumnya berakhir saat tokoh sedang berada di suatu tempat, melakukan sesuatu, atau baru mengetahui sesuatu, mulai dari keadaan terakhir tersebut dan bergerak maju. Jangan kembali ke awal bab sebelumnya hanya untuk menjelaskan ulang. Gunakan ringkasan untuk memahami keseluruhan bab dan KONTEKS AKHIR untuk menentukan posisi cerita yang sebenarnya. Target panjang bab untuk genre dan skala novel ini adalah "+chapterTargetText+". Jadikan rentang ini sebagai target utama, tetapi biarkan cerita bergerak natural dan jangan memaksakan kata hanya demi angka.",
   improve:"Perbaiki teks bab yang diberikan. Pertahankan inti cerita, fakta, karakter, urutan kejadian, dan gaya penulisannya. Perbaiki kalimat, alur, transisi, dialog, dan konsistensi tanpa mengubah maksud cerita. Kembalikan versi lengkap teks yang sudah diperbaiki.",
   dialog:"Perkaya bagian yang diberikan dengan dialog yang natural dan sesuai karakter. Pertahankan kejadian utama dan jangan mengubah inti cerita. Kembalikan versi lengkap teks yang sudah diperbaiki.",
   description:"Perkaya bagian yang diberikan dengan deskripsi suasana, tempat, ekspresi, gerakan, dan detail inderawi yang relevan. Jangan mengubah inti cerita atau kejadian utama. Kembalikan versi lengkap teks yang sudah diperbaiki.",
   summarize:"Buat ringkasan bab yang padat tetapi informatif. Catat kejadian penting, perubahan hubungan, fakta baru, konflik, keputusan tokoh, lokasi, waktu, dan hal yang harus diingat untuk bab berikutnya. Jangan menambahkan kejadian yang tidak ada. Maksimal sekitar 180 kata.",
   memory:"Bangun Story Memory permanen untuk novel ini. Gabungkan fondasi cerita dengan kejadian yang sudah terjadi. Prioritaskan fakta yang harus konsisten di bab-bab berikutnya: premis, tujuan tokoh, hubungan, rahasia, aturan dunia, konflik, perkembangan penting, fakta waktu/tempat, dan benang cerita yang belum selesai. Hapus detail yang tidak penting. Jangan mengarang fakta baru. Maksimal sekitar 700 kata.",
   memoryFoundation:"Analisis bab ini sebagai satu proses ATOMIK: ringkas bab DAN perbarui Story Memory dalam SATU respons. Ringkasan bab maksimal 180 kata dan tetap disimpan sebagai riwayat permanen bab tersebut. Story Memory adalah satu versi aktif yang diperbarui/ditimpa secara inkremental, bukan salinan memory per bab. Pertahankan fakta lama yang masih relevan, perbarui fakta yang berubah, dan buang detail yang sudah tidak relevan atau duplikatif. Ekstrak karakter dan entitas penting yang muncul atau berubah. Jangan menghapus karakter atau entitas lama hanya karena lama tidak muncul. Pertahankan nama dan ID yang sama jika itu entitas yang sama. Bedakan status aktif, meninggal, pergi, atau tidak diketahui. Tentukan status Story Memory: green jika bab tidak mengubah fakta penting dan Story Memory lama tetap akurat; yellow jika ada perkembangan nyata yang seharusnya masuk ke Story Memory; red jika ada perubahan besar, twist/reveal penting, perubahan tujuan utama, perubahan status karakter penting, aturan dunia baru yang signifikan, resolusi/pembukaan benang cerita besar, atau konflik dengan Story Memory lama. Jika Story Memory masih kosong dan bab ini membentuk fakta inti pertama, gunakan yellow. Untuk green, kembalikan Story Memory lama apa adanya. Untuk yellow/red, kembalikan Story Memory versi terbaru setelah memasukkan perkembangan bab ini. memoryNeedsUpdate true hanya untuk yellow/red. Balas HANYA JSON valid dengan format {\"summary\":\"...\",\"storyMemory\":\"...\",\"characters\":[{\"id\":\"char-nama-normalized\",\"name\":\"...\",\"role\":\"...\",\"description\":\"...\",\"facts\":[\"...\"],\"status\":\"aktif\",\"firstChapter\":1,\"lastChapter\":1}],\"entities\":[{\"id\":\"entity-nama-normalized\",\"name\":\"...\",\"type\":\"location\",\"description\":\"...\",\"facts\":[\"...\"],\"firstChapter\":1,\"lastChapter\":1}],\"facts\":[{\"id\":\"fact-...\",\"subjectId\":\"char-...\",\"subjectType\":\"character\",\"subjectName\":\"...\",\"statement\":\"...\",\"status\":\"active\",\"firstChapter\":1,\"lastChapter\":1,\"replacesId\":\"fact-old-optional\"}],\"memoryStatus\":\"green\",\"memoryNeedsUpdate\":false}. Untuk facts, hanya kembalikan fakta baru atau fakta yang berubah. Jika sebuah fakta lama digantikan, isi replacesId dengan ID fakta lama. Jika tidak ada perubahan fakta, facts harus []. Jangan gunakan markdown.",   qualityControl:"Lakukan Quality Control pada bab ini dengan membandingkan teks bab sekarang terhadap Story Memory, Character Memory, Entity Memory, Relationship Memory, Timeline, Story Threads, Character Arcs, ringkasan bab sebelumnya, dan konteks bab sebelumnya. Cari hanya masalah yang benar-benar didukung bukti: kontinuitas karakter, perubahan status tokoh, kontradiksi timeline, aturan dunia, lokasi/objek, sebab-akibat plot, benang cerita, atau perubahan gaya yang mengganggu. Jangan menganggap detail sebagai masalah hanya karena tidak disebut di bab ini. Bedakan masalah nyata dari kemungkinan/ketidakpastian. Jangan menulis ulang naskah dan jangan mengubah data. Balas HANYA JSON valid dengan format {\"overall\":\"clear\",\"issues\":[{\"severity\":\"high\",\"category\":\"continuity\",\"title\":\"...\",\"evidence\":\"...\",\"suggestion\":\"...\"}]}. Gunakan severity high hanya untuk kontradiksi atau risiko kontinuitas yang jelas, medium untuk hal yang perlu ditinjau, low untuk catatan minor. Maksimal 8 isu dan jika tidak ada masalah penting, issues harus []. Jangan gunakan markdown.",
   storyIntelligence:"Analisis bab ini untuk Story Intelligence. Perbarui hubungan antar karakter, timeline kejadian, benang cerita yang belum selesai, dan perkembangan arc karakter. Pertahankan data lama; jangan menghapus data lama hanya karena tidak muncul di bab ini. Gunakan ID stabil untuk entitas yang sama. Tambahkan timeline hanya untuk kejadian penting bab ini. Pertahankan status thread open/resolved/uncertain berdasarkan bukti. Gabungkan perkembangan baru ke arc karakter. Balas HANYA JSON valid dengan format {relationships:[{id:rel-nama1-nama2,from:Nama 1,to:Nama 2,type:teman,status:aktif,facts:[...],lastChapter:1}],timeline:[{id:event-1-1,chapter:1,title:...,description:...,characters:[...],importance:tinggi}],threads:[{id:thread-nama,title:...,description:...,status:open,lastChapter:1,relatedCharacters:[...]}],arcs:[{character:...,arc:...,currentState:...,turningPoints:[...],lastChapter:1}]}. Jangan gunakan markdown."
  };

  const currentText=clip(chapter.content,12000);
  const sceneCurrentText=isSceneGeneration&&sceneIndex>0
   ? (currentText.length>6000
      ? currentText.slice(0,1000)+"\n...[bagian tengah dipadatkan untuk menjaga latensi]...\n"+currentText.slice(-5000)
      : currentText)
   : currentText;
  const previousFullText=String(previousChapter?.content||"").trim();
  // Untuk kontinuitas, bagian akhir bab tetap diprioritaskan.
  const previousEnding=previousFullText.length>8000?previousFullText.slice(-8000):previousFullText;
  const previousSummary=clip(previousChapter?.summary,1500);

  // Context Engine memilih memory yang relevan berdasarkan tugas dan bab aktif.
  // Ia tidak menyimpan memory; ia hanya menyusun ContextResult yang dibutuhkan AI.
  const currentChapterId=typeof chapter?.id==="string"?chapter.id:"";
  const chapterRecords=[
   ...chapters.map((item:any,index:number)=>({...item,number:Number(item.number||index+1)})).filter((item:any)=>!currentChapterId||String(item?.id||"")!==currentChapterId),
   {id:currentChapterId||undefined,number:Number(chapter.number||0),title:chapter.title,content:currentText,summary:chapter.summary||""}
  ];
  const contextDepth=action==="storyIntelligence"||action==="qualityControl"||action==="memory"
   ?"deep"
   :action==="continue"||action==="memoryFoundation"||action==="summarize"
    ?"normal"
    :"light";
  const context=buildContext(novel,chapterRecords,{
   action,
   depth:contextDepth,
   query:[chapter.title,isSceneGeneration?sceneCurrentText:currentText,previousSummary,previousEnding].filter(Boolean).join("\n"),
   currentChapter:Number(chapter.number||0),
   budget:action==="qualityControl"||action==="storyIntelligence"?30000:undefined
  });
  const retrievedContext=contextForPrompt(context);

  const sceneInstruction=isSceneGeneration
   ? (sceneIndex===0
      ? "Tulis SCENE "+(sceneIndex+1)+" dari "+sceneCount+" untuk bab ini. Ini adalah bagian pertama. Mulai dari titik awal bab yang benar. Target scene: "+sceneMin+"–"+sceneMax+" kata. Jangan mencoba menyelesaikan seluruh bab dalam scene ini. Bangun adegan yang natural dan akhiri pada titik yang memungkinkan scene berikutnya melanjutkan cerita."
      : "Tulis SCENE "+(sceneIndex+1)+" dari "+sceneCount+" untuk bab ini. Lanjutkan TEPAT dari akhir teks yang sudah ada. Jangan mengulang isi sebelumnya. Target scene: "+sceneMin+"–"+sceneMax+" kata. Majukan kejadian secara natural dan jangan mencoba mengulang atau merangkum scene sebelumnya.")
   : "";

  const prompt=[
   "Kamu adalah AI penulis novel untuk aplikasi Novelis.",
   "Gunakan bahasa Indonesia yang natural, imersif, matang, dan enak dibaca.",
   "Jangan memberi catatan, penjelasan, judul tambahan, atau markdown kecuali diminta secara khusus oleh instruksi.",
   "Pertahankan kesinambungan karakter, dunia, konflik, hubungan tokoh, waktu, sebab-akibat, dan outline.",
   isSceneGeneration ? sceneInstruction : (instructions[action]||instructions.generate),
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
   "Profil panjang bab otomatis: "+chapterTargetText+" berdasarkan genre "+(chapterWordTarget.genre||"Umum")+" dan panjang novel "+(chapterWordTarget.length||"sedang")+"." ,
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
   (isSceneGeneration?sceneCurrentText:currentText) ? "TEKS BAB SEKARANG / HASIL SCENE SEBELUMNYA:\n"+(isSceneGeneration?sceneCurrentText:currentText) : ""
  ].filter(Boolean).join("\n\n");

  const requestId=typeof body?.requestId==="string"&&body.requestId.trim()?body.requestId.trim():undefined;
  const aiRequest={
   requestId,
   novelId:typeof body?.novelId==="string"?body.novelId:typeof novel?.id==="string"?novel.id:undefined,
   chapterId:typeof body?.chapterId==="string"?body.chapterId:typeof chapter?.id==="string"?chapter.id:undefined,
   action:action as AIAction,
   chapterVersion:body?.chapterVersion,
   prompt,
   options:{
    model:typeof body?.model==="string"&&body.model.trim()?body.model.trim():aiModel(),
    timeoutMs:isSceneGeneration?45000:50000,
    maxRetries:isSceneGeneration?0:1,
    maxOutputTokens:isSceneGeneration?Math.max(700,Math.ceil(sceneMax*2.2)):undefined
   }
  };

  try{
   const result=await executeAI(aiRequest);
   if(!result.content)throw new Error("AI tidak mengembalikan teks.");
   if(result.structured!==null){
    return NextResponse.json({
     ...result.structured,
     text:result.content,
     requestId:result.requestId,
     action:result.action,
     model:result.model,
     durationMs:result.durationMs,
     usage:result.usage
    });
   }
   return NextResponse.json({
    text:result.content,
    requestId:result.requestId,
    action:result.action,
    model:result.model,
    durationMs:result.durationMs,
    usage:result.usage
   });
  }catch(error){
   const err=error as any;
   return NextResponse.json({
    error:err?.message||"AI gagal memproses permintaan.",
    code:err?.code||"AI_ERROR",
    limitType:err?.limitType||null,
    requestId:err?.requestId||requestId||null,
    status:err?.geminiStatus||null
   },{status:Number(err?.status)||502});
  }
 }catch(error){
  return NextResponse.json({
   error:error instanceof Error?error.message:"Terjadi kesalahan saat generate."
  },{status:500});
 }
}
