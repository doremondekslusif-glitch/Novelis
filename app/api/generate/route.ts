import {NextResponse} from "next/server";

export async function POST(request:Request){
 try{
  const apiKey=process.env.GEMINI_API_KEY;
  if(!apiKey){
   return NextResponse.json(
    {error:"GEMINI_API_KEY belum dipasang di environment Vercel."},
    {status:500}
   );
  }

  const body=await request.json();
  const novel=body?.novel||{};
  const chapter=body?.chapter||{};
  const previousChapter=body?.previousChapter||null;
  const builder=novel.builder||{};

  const prompt=[
   "Kamu adalah AI penulis novel untuk aplikasi Novelis.",
   "Tulis kelanjutan cerita dalam bahasa Indonesia yang natural, imersif, konsisten, dan enak dibaca.",
   "Jangan memberi catatan, penjelasan, judul tambahan, atau markdown. Hanya isi cerita.",
   "Jangan mengulang adegan yang sudah diberikan. Buat kelanjutan yang benar-benar baru.",
   "Pertahankan karakter, dunia, konflik, hubungan antar tokoh, waktu, dan sebab-akibat cerita.",
   "",
   "FONDASI CERITA",
   `Judul novel: ${novel.title||"Tanpa judul"}`,
   `Genre: ${novel.genre||"Umum"}`,
   `Premis: ${builder.premise||"-"}`,
   `Karakter: ${builder.characters||"-"}`,
   `Dunia cerita: ${builder.world||"-"}`,
   `Outline keseluruhan: ${builder.outline||"-"}`,
   "",
   `BAB YANG SEDANG DITULIS: Bab ke-${chapter.number||1}`,
   `Judul bab: ${chapter.title||"Bab tanpa judul"}`,
   previousChapter?.content?.trim()
    ? "AKHIR BAB SEBELUMNYA. Gunakan ini sebagai konteks wajib agar alur bab sekarang tersambung:\n"+previousChapter.content
    : "",
   chapter.content?.trim()
    ? "ISI BAB SEKARANG YANG SUDAH ADA. Lanjutkan tepat dari bagian terakhir ini dan jangan menulis ulang bagian sebelumnya:\n"+chapter.content
    : chapter.number>1
      ? "Bab ini masih kosong. Mulai bab ini sebagai kelanjutan langsung dari bab sebelumnya."
      : "Bab 1 masih kosong. Mulai cerita dari awal berdasarkan fondasi cerita."
  ].filter(Boolean).join("\n\n");

  const response=await fetch(
   "https://generativelanguage.googleapis.com/v1beta/models/gemini-3.8-flash:generateContent",
   {
    method:"POST",
    headers:{
     "Content-Type":"application/json",
     "x-goog-api-key":apiKey
    },
    body:JSON.stringify({
     contents:[{role:"user",parts:[{text:prompt}]}],
     generationConfig:{thinkingConfig:{thinkingLevel:"low"}}
    })
   }
  );

  const result=await response.json();

  if(!response.ok){
   const message=result?.error?.message||`Gemini gagal menghasilkan cerita (HTTP ${response.status}).`;
   return NextResponse.json({error:message},{status:response.status});
  }

  const text=result?.candidates?.[0]?.content?.parts
   ?.filter((part:{text?:string})=>typeof part.text==="string")
   ?.map((part:{text?:string})=>part.text||"")
   ?.join("")
   ?.trim();

  if(!text){
   return NextResponse.json({error:"Gemini tidak mengembalikan teks cerita."},{status:502});
  }

  return NextResponse.json({text});
 }catch(error){
  return NextResponse.json(
   {error:error instanceof Error?error.message:"Terjadi kesalahan saat generate."},
   {status:500}
  );
 }
}
