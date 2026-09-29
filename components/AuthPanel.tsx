"use client";

import { useEffect,useState } from "react";
import { LogIn,LogOut,Cloud,Loader2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

type CloudState="checking"|"signed_out"|"signed_in"|"error";

export default function AuthPanel(){
  const [user,setUser]=useState<{email?:string;name?:string;avatar?:string}|null>(null);
  const [state,setState]=useState<CloudState>("checking");
  const [busy,setBusy]=useState(false);
  const supabase=createClient();

  useEffect(()=>{
    let mounted=true;
    supabase.auth.getUser().then(({data,error})=>{
      if(!mounted)return;
      if(error){setState("error");return;}
      const u=data.user;
      setUser(u?{email:u.email,name:u.user_metadata?.full_name||u.user_metadata?.name,avatar:u.user_metadata?.avatar_url}:null);
      setState(u?"signed_in":"signed_out");
    });
    const {data:{subscription}}=supabase.auth.onAuthStateChange((_event,session)=>{
      const u=session?.user;
      setUser(u?{email:u.email,name:u.user_metadata?.full_name||u.user_metadata?.name,avatar:u.user_metadata?.avatar_url}:null);
      setState(u?"signed_in":"signed_out");
    });
    return()=>{mounted=false;subscription.unsubscribe()};
  },[]);

  const signIn=async()=>{
    if(busy)return;
    setBusy(true);
    const {error}=await supabase.auth.signInWithOAuth({
      provider:"google",
      options:{redirectTo:`${window.location.origin}/auth/callback`}
    });
    if(error){console.error(error);setState("error");setBusy(false);}
  };

  const signOut=async()=>{
    if(busy)return;
    setBusy(true);
    const {error}=await supabase.auth.signOut();
    if(error)console.error(error);
    setBusy(false);
  };

  if(state==="checking"){
    return <div className="profile"><div className="avatar">…</div><div><b>Memuat sesi</b><small>Memeriksa login Google</small></div><Loader2 size={16} className="spin"/></div>;
  }

  if(user){
    const initial=(user.name||user.email||"P").trim().charAt(0).toUpperCase();
    return <div className="profile">
      <div className="avatar" style={{overflow:"hidden"}}>
        {user.avatar?<img src={user.avatar} alt="" style={{width:"100%",height:"100%",objectFit:"cover"}}/>:initial}
      </div>
      <div style={{minWidth:0,flex:1}}>
        <b style={{display:"block",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{user.name||"Penulis"}</b>
        <small style={{display:"block",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{user.email||"Google Account"} • ☁ Cloud</small>
      </div>
      <button className="iconBtn" onClick={signOut} title="Keluar" disabled={busy}><LogOut size={16}/></button>
    </div>;
  }

  return <div style={{display:"grid",gap:8}}>
    <button className="primary full" onClick={signIn} disabled={busy}>
      {busy?<Loader2 size={16} className="spin"/>:<LogIn size={16}/>}
      {busy?"Menghubungkan…":"Masuk dengan Google"}
    </button>
    <small style={{display:"flex",alignItems:"center",gap:6,color:"#888"}}><Cloud size={13}/> Login diperlukan untuk menyimpan novel di cloud.</small>
  </div>;
}
