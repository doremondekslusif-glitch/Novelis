"use client";

import { useEffect,useRef,useState } from "react";
import { createClient } from "@/lib/supabase/client";

type CloudNovel={id:string;updatedAt?:string;[key:string]:unknown};

function newer(a?:string,b?:string){
  const at=a?Date.parse(a):0;
  const bt=b?Date.parse(b):0;
  return at>=bt;
}

export function useCloudSync<T extends CloudNovel>(
  novels:T[],
  setNovels:(value:T[]|((prev:T[])=>T[]))=>void
){
  const [cloudReady,setCloudReady]=useState(false);
  const supabaseRef=useRef(createClient());
  const lastUploadRef=useRef("");
  const syncRunRef=useRef(0);

  useEffect(()=>{
    const supabase=supabaseRef.current;
    let active=true;

    const load=async()=>{
      setCloudReady(false);
      const {data:{user},error:userError}=await supabase.auth.getUser();
      if(userError||!user){
        if(active)setCloudReady(false);
        return;
      }

      const {data,error}=await supabase.from("novels").select("novel_id,data,updated_at").order("updated_at",{ascending:false});
      if(error){
        console.error("Novelis cloud load failed",error);
        if(active)setCloudReady(false);
        return;
      }

      const cloud=(data||[]).map(row=>({...((row.data||{}) as T),id:String(row.novel_id),updatedAt:(row.data as T)?.updatedAt||row.updated_at}));
      const localById=new Map(novels.map(n=>[n.id,n]));
      const cloudById=new Map(cloud.map(n=>[n.id,n]));
      const merged:CloudNovel[]=[];
      const upload:CloudNovel[]=[];

      for(const local of novels){
        const remote=cloudById.get(local.id);
        if(!remote){merged.push(local);upload.push(local);}
        else if(newer(local.updatedAt,remote.updatedAt)){merged.push(local);upload.push(local);}
        else merged.push(remote);
      }
      for(const remote of cloud){
        if(!localById.has(remote.id))merged.push(remote);
      }

      if(active){
        setNovels(merged);
        setCloudReady(true);
      }

      if(upload.length){
        await supabase.from("novels").upsert(
          upload.map(n=>({novel_id:n.id,data:n,version:1,updated_at:n.updatedAt||new Date().toISOString()})),
          {onConflict:"novel_id"}
        );
      }
    };

    load();

    const {data:{subscription}}=supabase.auth.onAuthStateChange((event)=>{
      if(event==="SIGNED_OUT"){
        setCloudReady(false);
      }else if(event==="SIGNED_IN"||event==="TOKEN_REFRESHED"){
        const run=++syncRunRef.current;
        window.setTimeout(()=>{if(active&&run===syncRunRef.current)load()},0);
      }
    });

    return()=>{active=false;subscription.unsubscribe()};
  },[]);

  useEffect(()=>{
    if(!cloudReady||!novels.length)return;
    const signature=novels.map(n=>`${n.id}:${n.updatedAt||""}`).join("|");
    if(signature===lastUploadRef.current)return;
    const timer=window.setTimeout(async()=>{
      const supabase=supabaseRef.current;
      const {data:{user}}=await supabase.auth.getUser();
      if(!user)return;
      const payload=novels.map(n=>({novel_id:n.id,data:n,version:1,updated_at:n.updatedAt||new Date().toISOString()}));
      const {error}=await supabase.from("novels").upsert(payload,{onConflict:"novel_id"});
      if(error)console.error("Novelis cloud save failed",error);
      else lastUploadRef.current=signature;
    },900);
    return()=>window.clearTimeout(timer);
  },[novels,cloudReady]);

  return {cloudReady};
}
