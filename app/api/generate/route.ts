import {NextResponse} from "next/server";

type Action="generate"|"continue"|"improve"|"dialog"|"description";

export async function POST(request:Request){
 try{
  const apiKey=process.env.GEMINI_API_KEY;
  if(!apiKey)return NextResponse.json({error:"GEMINI_API_KEY belum dipasang di environment Vercel."},{status:500});

  const body=await request.json();
  const action:Action=body?.action||"generate";
  const novel=body?.novel||{};
  const chapter=body?.chapter||{};
  const previousChapter=body?.previousChapter||null;
  const builder=novel.builder||{};

  const instructions:Record<Action,string>={
   generate:"Mulai Bab 1 dari awal. Tulis bab yang panjang, natural, imersif, dan kaya adegan. Targetkan sekitar 1200-1800 kata.",
   continue:"Lanjutkan cerita dari konteks terakhir yang diberikan. Jangan mengulang teks sebelumnya. Pastikan pembuka bab menyambung secara alami dengan kejadian bab sebelumnya. Targetkan sekitar 1200-1800 kata.",
   improve:"Perbaiki teks bab yang diberikan. Pertahankan inti cerita, fakta, karakter, urutan kejadian, dan gaya penulisannya. Perbaiki kalimat, alur, transisi, dialog, dan konsistensi tanpa mengubah maksud cerita. Kembalikan versi lengkap teks yang sudah diperbaiki.",
   dialog:"Perkaya bagian yang diberikan dengan dialog yang natural dan sesuai karakter. Pertahankan kejadian utama dan jangan mengubah inti cerita. Kembalikan versi lengkap teks yang sudah diperbaiki.",
   description:"Perkaya bagian yang diberikan dengan deskripsi suasana, tempat, ekspresi, gerakan, dan detail inderawi yang relevan. Jangan mengubah inti cerita atau kejadian utama. Kembalikan versi lengkap teks yang sudah diperbaiki."
  };

  const prompt=[
   "Kamu adalah AI penulis novel untuk aplikasi Novelis.",
   "Gunakan bahasa Indonesia yang natural, imersif, matang, dan enak dibaca.",
   "Jangan memberi catatan, penjelasan, judul tambahan, atau markdown. Hanya teks cerita.",
   "Pertahankan kesinambungan karakter, dunia, konflik, hubungan tokoh, waktu, sebab-akibat, dan outline.",
   instructions[action],
   "",
   "FONDASI CERITA",
   `Judul novel: ${novel.title||"Tanpa judul"}`,
   `Genre: ${novel.genre||"Umum"}`,
   `Premis: ${builder.premise||"-"}`,
   `Karakter: ${builder.characters||"-"}`,
   `Dunia cerita: ${builder.world||"-"}`,
   `Outline keseluruhan: ${builder.outline||"-"}`,
   "",
   `BAB: ${chapter.number||1}`,
   `JUDUL BAB: ${chapter.title||"Bab tanpa judul"}`,
   previousChapter?.content?.trim()
    ? "KONTEKS AKHIR BAB SEBELUMNYA:\n"+previousChapter.content
    : "",
   chapter.content?.trim()
    ? "TEKS BAB SEKARANG:\n"+chapter.content
    : ""
  ].filter(Boolean).join("\n\n");

  const models=["gemini-3.8-flash","gemini-3.7-flash","gemini-3.6-flash","gemini-3.5-flash-lite"];
  let response:Response|null=null;
  let result:any=null;
  let lastError="";

  for(const model of models){
   for(let attempt=0;attempt<2;attempt++){
    try{
     response=await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,{
      method:"POST",
      headers:{"Content-Type":"application/json","x-goog-api-key":apiKey},
      body:JSON.stringify({
       contents:[{role:"user",parts:[{text:prompt}]}],
       generationConfig:{thinkingConfig:{thinkingLevel:"low"}}
      })
     });
     result=await response.json();
     if(response.ok)break;
     lastError=result?.error?.message||`Gemini gagal menghasilkan cerita (HTTP ${response.status}).`;
     const retryable=[429,500,502,503,504].includes(response.status);
     if(!retryable)break;
     await new Promise(resolve=>setTimeout(resolve,800*(attempt+1)));
    }catch(error){
     lastError=error instanceof Error?error.message:"Koneksi ke Gemini gagal.";
     await new Promise(resolve=>setTimeout(resolve,800*(attempt+1)));
    }
   }
   if(response?.ok)break;
  }

  if(!response?.ok){
   return NextResponse.json({
    error:"Layanan AI sedang padat. Novelis sudah mencoba beberapa model Gemini, tetapi semuanya belum tersedia. Coba lagi beberapa saat.",
    detail:lastError
   },{status:503});
  }
  const text=result?.candidates?.[0]?.content?.parts
   ?.filter((part:{text?:string})=>typeof part.text==="string")
   ?.map((part:{text?:string})=>part.text||"").join("").trim();
  if(!text)return NextResponse.json({error:"Gemini tidak mengembalikan teks cerita."},{status:502});
  return NextResponse.json({text});
 }catch(error){
  return NextResponse.json({error:error instanceof Error?error.message:"Terjadi kesalahan saat generate."},{status:500});
 }
}
