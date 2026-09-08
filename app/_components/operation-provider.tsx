"use client";
import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { OperationDialog } from './operation-dialog';
import { OperationContext, type RequestOperation } from "./operation-context";
export function OperationProvider({children}:{children:ReactNode}) {
  const [pending,setPending]=useState<{description:string;initialValue:string;minimum:number;id:number}|null>(null);
  const resolver=useRef<((value:string|null)=>void)|null>(null);
  const serial=useRef(0);
  const request=useCallback<RequestOperation>((description,initialValue='',minimum=4)=>{
    if (resolver.current) return Promise.resolve(null);
    return new Promise(resolve=>{resolver.current=resolve;setPending({description,initialValue,minimum,id:++serial.current});});
  },[]);
  const finish=(value:string|null)=>{const resolve=resolver.current;resolver.current=null;setPending(null);resolve?.(value);};
  useEffect(()=>()=>{resolver.current?.(null);resolver.current=null;},[]);
  return <OperationContext.Provider value={request}>{children}{pending ? <OperationDialog key={pending.id} title="核对操作" description={pending.description} initialValue={pending.initialValue} minimum={pending.minimum} onCancel={()=>finish(null)} onConfirm={async reason=>finish(reason)} />:null}</OperationContext.Provider>;
}
