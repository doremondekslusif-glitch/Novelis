"use client";

import {useEffect,useRef,useState} from "react";
import {createClient,hasSupabaseConfig} from "@/lib/supabase/client";

type CloudNovel={id:string;updatedAt?:string;[key:string]:unknown};

function newer(a?:string,b?:string){
  const at=a?Date.parse(a):0;
  const bt=b?Date.parse(b):0;
  return at>=bt;
}

export function useCloudSync<T extends CloudNovel>(
  novels:T[],
  setNovels:(value:T[]|((prev:T[])=>T[]))=>void,
  enabled:boolean
){
  const [cloudReady,setCloudReady]=useState(false);
  const supabaseRef=useRef<ReturnType<typeof createClient>|null>(null);
  if(hasSupabaseConfig&&!supabaseRef.current)supabaseRef.current=createClient();
  const novelsRef=useRef(novels);
  const lastUploadRef=useRef("");
  const loadingRef=useRef(false);

  useEffect(()=>{novelsRef.current=novels},[novels]);

  useEffect(()=>{
    if(!enabled)return;
    const supabase=supabaseRef.current;
    if(!supabase||!hasSupabaseConfig)return;
    let active=true;

    const load=async()=>{
      if(loadingRef.current)return;
      loadingRef.current=true;
      setCloudReady(false);

      try{
        const {data:{user},error:userError}=await supabase.auth.getUser();
        if(userError||!user)return;

        const {data,error}=await supabase
          .from("novels")
          .select("novel_id,data,updated_at")
          .order("updated_at",{ascending:false});

        if(error)throw error;

        const cloud=(data||[]).map(row=>({
          ...((row.data||{}) as T),
          id:String(row.novel_id),
          updatedAt:(row.data as T)?.updatedAt||row.updated_at
        }));

        const local=novelsRef.current;
        const localById=new Map(local.map(n=>[n.id,n]));
        const cloudById=new Map(cloud.map(n=>[n.id,n]));
        const merged:T[]=[];
        const upload:T[]=[];

        for(const item of local){
          const remote=cloudById.get(item.id);
          if(!remote){
            merged.push(item);
            upload.push(item);
          }else if(newer(item.updatedAt,remote.updatedAt)){
            merged.push(item);
            upload.push(item);
          }else{
            merged.push(remote);
          }
        }

        for(const remote of cloud){
          if(!localById.has(remote.id))merged.push(remote);
        }

        if(!active)return;
        setNovels(merged);
        setCloudReady(true);

        if(upload.length){
          const {error:saveError}=await supabase.from("novels").upsert(
            upload.map(n=>({
              user_id:user.id,
              novel_id:n.id,
              data:n,
              version:1,
              updated_at:n.updatedAt||new Date().toISOString()
            })),
            {onConflict:"user_id,novel_id"}
          );
          if(saveError)console.error("Novelis cloud migration failed",saveError);
        }
      }catch(error){
        console.error("Novelis cloud load failed",error);
        if(active)setCloudReady(false);
      }finally{
        loadingRef.current=false;
      }
    };

    load();

    const {data:{subscription}}=supabase.auth.onAuthStateChange(event=>{
      if(event==="SIGNED_OUT"){
        setCloudReady(false);
        lastUploadRef.current="";
      }else if(event==="SIGNED_IN"||event==="TOKEN_REFRESHED"){
        window.setTimeout(load,0);
      }
    });

    return()=>{active=false;subscription.unsubscribe()};
  },[enabled,setNovels]);

  useEffect(()=>{
    if(!enabled||!cloudReady)return;

    const signature=novels.map(n=>`${n.id}:${n.updatedAt||""}`).join("|");
    if(signature===lastUploadRef.current)return;

    const timer=window.setTimeout(async()=>{
      try{
        const supabase=supabaseRef.current;
        if(!supabase)return;
        const {data:{user}}=await supabase.auth.getUser();
        if(!user)return;

        const payload=novels.map(n=>({
          user_id:user.id,
          novel_id:n.id,
          data:n,
          version:1,
          updated_at:n.updatedAt||new Date().toISOString()
        }));

        const {error}=await supabase
          .from("novels")
          .upsert(payload,{onConflict:"user_id,novel_id"});

        if(error)throw error;
        lastUploadRef.current=signature;
      }catch(error){
        console.error("Novelis cloud save failed",error);
      }
    },900);

    return()=>window.clearTimeout(timer);
  },[novels,cloudReady,enabled]);

  const deleteNovelPermanently=async(novelId:string)=>{
    const supabase=supabaseRef.current;
    if(enabled&&supabase&&hasSupabaseConfig){
      const {data:{user},error:userError}=await supabase.auth.getUser();
      if(userError)throw userError;
      if(user){
        const {error}=await supabase
          .from("novels")
          .delete()
          .eq("user_id",user.id)
          .eq("novel_id",novelId);
        if(error)throw error;
      }
    }
    setNovels(current=>current.filter(n=>n.id!==novelId));
    novelsRef.current=novelsRef.current.filter(n=>n.id!==novelId);
    lastUploadRef.current="";
  };

  return {cloudReady,deleteNovelPermanently};
}
