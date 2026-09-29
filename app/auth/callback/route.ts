import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const dynamic="force-dynamic";

export async function GET(request:Request){
  const requestUrl=new URL(request.url);
  const code=requestUrl.searchParams.get("code");
  const nextParam=requestUrl.searchParams.get("next")||"/";
  const next=nextParam.startsWith("/")&&!nextParam.startsWith("//")?nextParam:"/";

  if(!code||!process.env.NEXT_PUBLIC_SUPABASE_URL||!process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY){
    return redirectWithError(requestUrl);
  }

  try{
    const supabase=await createClient();
    const {error}=await supabase.auth.exchangeCodeForSession(code);

    if(error){
      console.error("Novelis OAuth callback failed:",error);
      return redirectWithError(requestUrl);
    }

    const response=NextResponse.redirect(new URL(next,requestUrl.origin));
    response.headers.set("Cache-Control","private, no-store, max-age=0");
    return response;
  }catch(error){
    console.error("Novelis OAuth callback exception:",error);
    return redirectWithError(requestUrl);
  }
}

function redirectWithError(requestUrl:URL){
  const response=NextResponse.redirect(new URL("/?auth_error=oauth_callback",requestUrl.origin));
  response.headers.set("Cache-Control","private, no-store, max-age=0");
  return response;
}
