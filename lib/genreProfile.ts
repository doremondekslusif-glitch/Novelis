export type ChapterLengthMode="auto"|"custom";

export type GenreChapterProfile={genre:string;min:number;max:number};

const PROFILES:GenreChapterProfile[]=[
 {genre:"Fantasy",min:1200,max:1800},
 {genre:"Romance",min:900,max:1400},
 {genre:"Drama",min:900,max:1400},
 {genre:"Mystery",min:1000,max:1600},
 {genre:"Science Fiction",min:1100,max:1700},
 {genre:"Thriller",min:900,max:1500},
 {genre:"Horror",min:1000,max:1600},
 {genre:"Adventure",min:1100,max:1700},
 {genre:"Historical",min:1100,max:1700},
 {genre:"Comedy",min:700,max:1200}
];

const LENGTH_MULTIPLIER:Record<string,number>={pendek:.75,sedang:1,panjang:1.2,sangat_panjang:1.4};

function normalizeGenre(value:string){return String(value||"").trim().toLowerCase();}

export function getGenreChapterProfile(genre:string){
 const genres=String(genre||"").split("•").map(normalizeGenre).filter(Boolean);
 const matched=genres.map(g=>PROFILES.find(p=>normalizeGenre(p.genre)===g)).filter(Boolean) as GenreChapterProfile[];
 if(!matched.length)return {genre:"Umum",min:900,max:1400};
 const min=Math.max(...matched.map(p=>p.min));
 const max=Math.max(...matched.map(p=>p.max));
 return {genre:matched.map(p=>p.genre).join(" • "),min,max};
}

export function getChapterWordTarget(genre:string,novelLength:string){
 const profile=getGenreChapterProfile(genre);
 const multiplier=LENGTH_MULTIPLIER[String(novelLength||"sedang")]||1;
 return {min:Math.round(profile.min*multiplier/50)*50,max:Math.round(profile.max*multiplier/50)*50,baseMin:profile.min,baseMax:profile.max,genre:profile.genre,length:novelLength||"sedang"};
}

export function formatChapterTarget(target:{min:number;max:number}){return `${target.min.toLocaleString("id-ID")}–${target.max.toLocaleString("id-ID")} kata`;}