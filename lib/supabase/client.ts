import {createBrowserClient} from "@supabase/ssr";

export const hasSupabaseConfig=Boolean(
  process.env.NEXT_PUBLIC_SUPABASE_URL&&
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
);

export function createClient(){
  if(!hasSupabaseConfig){
    throw new Error("Supabase environment variables are missing.");
  }
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!
  );
}
