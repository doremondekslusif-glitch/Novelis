import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(request:Request){
  const requestUrl=new URL(request.url);
  const code=requestUrl.searchParams.get("code");
  const next=requestUrl.searchParams.get("next")||"/";

  if(code&&process.env.NEXT_PUBLIC_SUPABASE_URL&&process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY){
    const supabase=await createClient();
    const {error}=await supabase.auth.exchangeCodeForSession(code);
    if(!error){
      return NextResponse.redirect(new URL(next,requestUrl.origin));
    }
  }

  return NextResponse.redirect(new URL("/?auth_error=oauth_callback",requestUrl.origin));
}
