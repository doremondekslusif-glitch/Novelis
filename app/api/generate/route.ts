import {NextResponse} from "next/server";

export async function POST(request:Request){
 try{
  const apiKey=process.env.OPENAI_API_KEY;
  if(!apiKey)return NextResponse.json({error:"OPENAI_API_KEY belum dipasang di environment Vercel."},{status:500});

  const body=await request.json();
  const novel=body?.novel||{};
  const chapter=body?.chapter||{};
  const builder=novel.builder||{};

  const prompt=[
   "Kamu adalah AI penulis novel untuk aplikasi Novelis.",
   "Tulis isi bab novel dalam bahasa Indonesia yang natural, imersif, dan enak dibaca.",
   "Jangan memberi catatan, penjelasan, judul tambahan, atau markdown. Hanya isi cerita.",
   "Gunakan fondasi cerita berikut:",
   `Judul novel: ${novel.title||"Tanpa judul"}`,
   `Genre: ${novel.genre||"Umum"}`,
   `Premis: ${builder.premise||"-"}`,
   `Karakter: ${builder.characters||"-"}`,
   `Dunia cerita: ${builder.world||"-"}`,
   `Outline: ${builder.outline||"-"}`,
   `Bab ke: ${chapter.number||1}`,
   `Judul bab: ${chapter.title||"Bab tanpa judul"}`,
   chapter.content?.trim()
    ? "Teks yang sudah ditulis. Lanjutkan dari bagian terakhir tanpa mengulang bagian sebelumnya:\n"+chapter.content
    : "Bab ini masih kosong. Kembangkan adegan pembuka dan alurnya berdasarkan fondasi cerita di atas."
  ].join("\n\n");

  const response=await fetch("https://api.openai.com/v1/responses",{
   method:"POST",
   headers:{"Content-Type":"application/json","Authorization":`Bearer ${apiKey}`},
   body:JSON.stringify({model:"gpt-5.6-luna",input:prompt})
  });

  const result=await response.json();
  if(!response.ok){
   const message=result?.error?.message||"OpenAI gagal menghasilkan cerita.";
   return NextResponse.json({error:message},{status:response.status});
  }

  const text=result?.output_text?.trim();
  if(!text)return NextResponse.json({error:"AI tidak mengembalikan teks."},{status:502});
  return NextResponse.json({text});
 }catch(error){
  return NextResponse.json({error:error instanceof Error?error.message:"Terjadi kesalahan saat generate."},{status:500});
 }
}
