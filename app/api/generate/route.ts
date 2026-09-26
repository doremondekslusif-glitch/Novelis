import {NextResponse} from "next/server";

export async function POST(request:Request){
 try{
  const apiKey=process.env.GEMINI_API_KEY;
  if(!apiKey)return NextResponse.json({error:"GEMINI_API_KEY belum dipasang di environment Vercel."},{status:500});

  const body=await request.json();
  const novel=body?.novel||{};
  const chapter=body?.chapter||{};
  const builder=novel.builder||{};

  const prompt=[
   "Kamu adalah AI penulis novel untuk aplikasi Novelis.",
   "Tulis isi bab novel dalam bahasa Indonesia yang natural, imersif, konsisten, dan enak dibaca.",
   "Jangan memberi catatan, penjelasan, judul tambahan, atau markdown. Hanya isi cerita.",
   "Pertahankan karakter, dunia, konflik, dan gaya cerita yang sudah ditentukan.",
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
    ? "Teks yang sudah ditulis. Lanjutkan cerita secara langsung dari bagian terakhir tanpa mengulang bagian sebelumnya:\n"+chapter.content
    : "Bab ini masih kosong. Kembangkan adegan pembuka dan alurnya berdasarkan fondasi cerita di atas."
  ].join("\n\n");

  const response=await fetch("https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent",{
   method:"POST",
   headers:{
    "Content-Type":"application/json",
    "x-goog-api-key":apiKey
   },
   body:JSON.stringify({
    contents:[{parts:[{text:prompt}]}],
    generationConfig:{
     temperature:0.9,
     maxOutputTokens:4000
    }
   })
  });

  const result=await response.json();
  if(!response.ok){
   const message=result?.error?.message||"Gemini gagal menghasilkan cerita.";
   return NextResponse.json({error:message},{status:response.status});
  }

  const text=result?.candidates?.[0]?.content?.parts
   ?.map((part:{text?:string})=>part.text||"")
   .join("")
   .trim();

  if(!text)return NextResponse.json({error:"Gemini tidak mengembalikan teks."},{status:502});
  return NextResponse.json({text});
 }catch(error){
  return NextResponse.json({error:error instanceof Error?error.message:"Terjadi kesalahan saat generate."},{status:500});
 }
}
