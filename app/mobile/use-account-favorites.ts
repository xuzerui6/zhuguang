"use client";
import { useCallback, useRef, useState } from 'react';
import { FavoriteSync, type FavoriteCache } from './favorite-sync';
import { mobileApi } from './api-client';
import { readPreference, writePreference } from './device';
import type { MobileSession } from './types';

export function useAccountFavorites() {
  const store = useRef(new FavoriteSync());
  const [ids,setIds] = useState<number[]>([]);
  const [pending,setPending] = useState(false);
  const writes = useRef(Promise.resolve());
  const activation = useRef<{owner:string; promise:Promise<void>} | null>(null);
  const generation = useRef(0);
  const changed = useCallback(() => {
    const current = store.current; setIds(current.ids()); setPending(current.owner !== 'guest' && current.save().pending.length > 0);
    const owner=current.owner; const cache=current.save();
    writes.current = writes.current.catch(()=>undefined).then(()=>writePreference(`favorites:${owner}`,cache));
    void writes.current.catch(()=>undefined);
  },[]);
  const activate = useCallback((session: MobileSession | null) => {
    const owner = session?.userId || session?.profile?.userId || (session ? 'unidentified' : 'guest');
    if (activation.current?.owner===owner) return activation.current.promise;
    const currentGeneration=++generation.current;
    store.current.activate(owner); setIds([]); setPending(false);
    const task = (async()=> {
      let cache = await readPreference<FavoriteCache>(`favorites:${owner}`);
      if (!cache && owner==='guest') cache={ids:await readPreference<number[]>('favorites') || [],pending:[]};
      if (generation.current!==currentGeneration) return;
      store.current.activate(owner,cache || undefined); changed();
      if(owner!=='guest') await writePreference('favorites',[]);
    })();
    activation.current={owner,promise:task}; return task;
  },[changed]);
  const flush = useCallback(async()=> {
    const owner=store.current.owner;
    if (!navigator.onLine || owner==='guest' || owner==='unidentified' || !owner) return;
    for (let attempt=0; attempt<4; attempt++) {
      await store.current.flush(async(id,favorite)=>(await mobileApi.setFavorite(id,favorite,owner)).favoriteCoachIds,changed);
      if(store.current.owner!==owner) return;
      changed();
      if(!store.current.save().pending.length) return;
    }
    throw new Error('收藏变更仍在等待同步');
  },[changed]);
  const toggle = useCallback((id:number)=>{ const favorite=store.current.toggle(id); changed(); return favorite; },[changed]);
  const accept = useCallback((snapshot:number[],ticket:ReturnType<FavoriteSync['ticket']>)=> {
    if(store.current.owner!=='guest' && store.current.accept(snapshot,ticket)) changed();
  },[changed]);
  const ticket = useCallback(()=>store.current.ticket(),[]);
  const consumeGuest = useCallback(async()=> {
    await writes.current.catch(()=>undefined);
    await writePreference('favorites',[]);
    await writePreference('favorites:guest',{ids:[],pending:[]});
    activation.current=null;
  },[]);
  return { ids,pending,activate,flush,toggle,accept,ticket,consumeGuest };
}
