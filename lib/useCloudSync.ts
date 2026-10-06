"use client";

import {useEffect,useRef,useState} from "react";
import {createClient,hasSupabaseConfig} from "@/lib/supabase/client";

type CloudNovel={id:string;updatedAt?:string;cloudVersion?:number;[key:string]:unknown};

function newer(a?:string,b?:string){
  const at=a?Date.parse(a):0;
  const bt=b?Date.parse(b):0;
  return at>bt;
}

function syncToken(item:CloudNovel){return item.id+"::"+(item.updatedAt||"")+"::"+Number(item.cloudVersion||0);}

export function useCloudSync<T extends CloudNovel>(
  novels:T[],
  setNovels:(value:T[]|((prev:T[])=>T[]))=>void,
  enabled:boolean
){
  const [cloudReady,setCloudReady]=useState(false);
  const supabaseRef=useRef<ReturnType<typeof createClient>|null>(null);
  if(hasSupabaseConfig&&!supabaseRef.current)supabaseRef.current=createClient();
  const novelsRef=useRef(novels);
  const lastUploadRef=useRef<Map<string,string>>(new Map());
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
          .select("novel_id,data,updated_at,version")
          .order("updated_at",{ascending:false});

        if(error)throw error;

        const cloud=(data||[]).map(row=>({
          ...((row.data||{}) as T),
          id:String(row.novel_id),
          updatedAt:row.updated_at||((row.data as T)?.updatedAt),
          cloudVersion:Number(row.version||0)
        }));

        const local=novelsRef.current;
        const localById=new Map(local.map(n=>[n.id,n]));
        const cloudById=new Map(cloud.map(n=>[n.id,n]));
        const merged:T[]=[];
        const upload:Array<{item:T;expectedVersion:number}>=[];

        for(const item of local){
          const remote=cloudById.get(item.id);
          if(!remote){
            merged.push(item);
            upload.push({item,expectedVersion:0});
          }else if(newer(item.updatedAt,remote.updatedAt)){
            merged.push(item);
            upload.push({item,expectedVersion:Number((remote as T)?.cloudVersion||0)});
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
          for(const pending of upload){
            const item=pending.item;
            const {data:saveData,error:saveError}=await supabase.rpc("save_novel_atomic",{
              p_novel_id:item.id,
              p_data:item,
              p_expected_version:pending.expectedVersion,
              p_client_updated_at:item.updatedAt||new Date().toISOString()
            });
            if(saveError)console.error("Novelis cloud migration failed",saveError);
            else {
              const result=Array.isArray(saveData)?saveData[0]:saveData;
              if(result?.status==="saved"){
                const savedNovel={...item,updatedAt:result.updated_at||item.updatedAt,cloudVersion:Number(result.version||pending.expectedVersion+1)} as T;
                setNovels(current=>current.map(currentItem=>currentItem.id===item.id?savedNovel:currentItem));
                novelsRef.current=novelsRef.current.map(currentItem=>currentItem.id===item.id?savedNovel:currentItem);
                lastUploadRef.current.set(item.id,syncToken(savedNovel));
              }else if(result?.status==="conflict"&&result?.data){
                const remoteNovel={...((result.data||{}) as T),id:item.id,updatedAt:result.updated_at||((result.data as T)?.updatedAt),cloudVersion:Number(result.version||0)};
                setNovels(current=>current.map(currentItem=>currentItem.id===item.id?remoteNovel:currentItem));
                novelsRef.current=novelsRef.current.map(currentItem=>currentItem.id===item.id?remoteNovel:currentItem);
                lastUploadRef.current.set(item.id,syncToken(remoteNovel));
              }
            }
          }
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
        lastUploadRef.current.clear();
      }else if(event==="SIGNED_IN"||event==="TOKEN_REFRESHED"){
        window.setTimeout(load,0);
      }
    });

    return()=>{active=false;subscription.unsubscribe()};
  },[enabled,setNovels]);

  useEffect(()=>{
    if(!enabled||!cloudReady)return;

    const changed=novels.filter(n=>lastUploadRef.current.get(n.id)!==syncToken(n));
    if(!changed.length)return;

    const timer=window.setTimeout(async()=>{
      try{
        const supabase=supabaseRef.current;
        if(!supabase)return;
        const {data:{user}}=await supabase.auth.getUser();
        if(!user)return;

        for(const novel of changed){
          const localUpdated=novel.updatedAt||new Date().toISOString();
          const {data:remote,error:remoteError}=await supabase
            .from("novels")
            .select("novel_id,data,updated_at,version")
            .eq("user_id",user.id)
            .eq("novel_id",novel.id)
            .maybeSingle();
          if(remoteError)throw remoteError;

          const remoteUpdated=remote?.updated_at||((remote?.data as T|undefined)?.updatedAt);
          if(remote&&remoteUpdated&&Date.parse(remoteUpdated)>Date.parse(localUpdated)){
            const remoteNovel={...((remote.data||{}) as T),id:String(remote.novel_id),updatedAt:remoteUpdated,cloudVersion:Number(remote.version||0)};
            setNovels(current=>current.map(item=>item.id===novel.id?remoteNovel:item));
            novelsRef.current=novelsRef.current.map(item=>item.id===novel.id?remoteNovel:item);
            lastUploadRef.current.set(novel.id,syncToken(remoteNovel));
            continue;
          }

          const expectedVersion=Number(novel.cloudVersion||0);
          const {data:saveData,error}=await supabase.rpc("save_novel_atomic",{
            p_novel_id:novel.id,
            p_data:novel,
            p_expected_version:expectedVersion,
            p_client_updated_at:localUpdated
          });
          if(error)throw error;
          const result=Array.isArray(saveData)?saveData[0]:saveData;
          if(result?.status==="conflict"&&result?.data){
            const remoteNovel={...((result.data||{}) as T),id:novel.id,updatedAt:result.updated_at||((result.data as T)?.updatedAt),cloudVersion:Number(result.version||0)};
            setNovels(current=>current.map(item=>item.id===novel.id?remoteNovel:item));
            novelsRef.current=novelsRef.current.map(item=>item.id===novel.id?remoteNovel:item);
            lastUploadRef.current.set(novel.id,syncToken(remoteNovel));
            continue;
          }
          if(result?.status!=="saved")throw new Error("Cloud save was not committed.");
          const savedNovel={...novel,updatedAt:result.updated_at||localUpdated,cloudVersion:Number(result.version||expectedVersion+1)} as T;
          setNovels(current=>current.map(item=>item.id===novel.id?savedNovel:item));
          novelsRef.current=novelsRef.current.map(item=>item.id===novel.id?savedNovel:item);
          lastUploadRef.current.set(novel.id,syncToken(savedNovel));
        }
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
        const current=novelsRef.current.find(item=>item.id===novelId);
        const expectedVersion=Number(current?.cloudVersion||0);
        const {data,error}=await supabase.rpc("delete_novel_atomic",{
          p_novel_id:novelId,
          p_expected_version:expectedVersion
        });
        if(error)throw error;
        const result=Array.isArray(data)?data[0]:data;
        if(result?.status==="conflict"&&result?.data){
          const remoteNovel={...((result.data||{}) as T),id:novelId,updatedAt:result.updated_at||((result.data as T)?.updatedAt),cloudVersion:Number(result.version||0)};
          setNovels(items=>items.map(item=>item.id===novelId?remoteNovel:item));
          novelsRef.current=novelsRef.current.map(item=>item.id===novelId?remoteNovel:item);
          lastUploadRef.current.set(novelId,syncToken(remoteNovel));
          throw new Error("Novel berubah di perangkat lain. Penghapusan dibatalkan agar data terbaru tidak hilang.");
        }
      }
    }
    setNovels(current=>current.filter(n=>n.id!==novelId));
    novelsRef.current=novelsRef.current.filter(n=>n.id!==novelId);
    lastUploadRef.current.clear();
  };

  return {cloudReady,deleteNovelPermanently};
}
