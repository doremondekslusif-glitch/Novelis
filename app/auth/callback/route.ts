import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const dynamic="force-dynamic";

export async function GET(request:Request){
  const {searchParams,origin}=new URL(request.url);
  const code=searchParams.get("code");
  const nextParam=searchParams.get("next")||"/";
  const next=nextParam.startsWith("/")&&!nextParam.startsWith("//")?nextParam:"/";

  if(!code){
    return NextResponse.redirect(new URL("/?auth_error=missing_code",origin));
  }

  try{
    const supabase=await createClient();
    const {error}=await supabase.auth.exchangeCodeForSession(code);

    if(error){
      console.error("Novelis OAuth callback failed:",error);
      return NextResponse.redirect(new URL("/?auth_error=oauth_callback",origin));
    }

    // Prefer the original host when the app is behind Vercel/load balancing.
    const forwardedHost=request.headers.get("x-forwarded-host");
    const isLocal=process.env.NODE_ENV==="development";
    const redirectOrigin=isLocal
      ? origin
      : forwardedHost
        ? `https://${forwardedHost}`
        : origin;

    const response=NextResponse.redirect(`${redirectOrigin}${next}`);
    response.headers.set("Cache-Control","private, no-store, max-age=0");
    return response;
  }catch(error){
    console.error("Novelis OAuth callback exception:",error);
    return NextResponse.redirect(new URL("/?auth_error=oauth_callback",origin));
  }
}
