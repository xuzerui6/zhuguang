"use client";

import { useEffect, useState } from "react";
import { Upload } from "lucide-react";
import { COACH_APPLICATION_LABELS, coachOnboardingEntry, type CoachApplication, type CoachOnboardingSummary } from "../../shared/coach-application";
import { SERVICE_CITIES, type ServiceCityId } from "../../shared/service-cities";
import type { ServiceCatalog } from "../../shared/service-catalog";
import { mobileApi } from "./api-client";
import { Sheet } from "./components";

const emptyFields={realName:"",title:"",bio:"",experienceYears:"0",audiences:"",goals:"",strengths:"",honors:"",credentials:"",price:"",trialPrice:"",venueName:"",venueAddress:""};
type FieldName=keyof typeof emptyFields;
const split=(value:string)=>value.split(/[，,、\n]/u).map(item=>item.trim()).filter(Boolean);

export function CoachApplicationSheet({initialCity,onClose,onApproved}:{initialCity:ServiceCityId;onClose:()=>void;onApproved:()=>void}){
  const [application,setApplication]=useState<CoachApplication|null>(null);
  const [onboarding,setOnboarding]=useState<CoachOnboardingSummary>();
  const [loadFailed,setLoadFailed]=useState(false);const [loadAttempt,setLoadAttempt]=useState(0);
  const [fields,setFields]=useState(emptyFields);
  const [city,setCity]=useState(initialCity);
  const [catalog,setCatalog]=useState<ServiceCatalog|null>(null);
  const [sport,setSport]=useState("");const [area,setArea]=useState("");
  const [files,setFiles]=useState<Partial<Record<"avatar"|"hero"|"credential",File>>>({});
  const [loading,setLoading]=useState(true);const [busy,setBusy]=useState(false);const [error,setError]=useState("");
  useEffect(()=>{
    let active=true;
    void Promise.all([mobileApi.coachApplications(),mobileApi.me()]).then(([items,identity])=>{
      if(!active)return;
      setOnboarding(identity.coachOnboarding);
      const item=items.find(item=>item.id===identity.coachOnboarding?.applicationId)||items[0];setApplication(item||null);
      if(item&&item.status!=="withdrawn"){
        setFields({realName:item.real_name,title:item.title,bio:item.bio,experienceYears:String(item.experience_years),audiences:item.audiences.join("、"),goals:item.goals.join("、"),strengths:item.strengths.join("、"),honors:item.honors.join("、"),credentials:item.credentials.join("、"),price:item.price_fen?String(item.price_fen/100):"",trialPrice:item.trial_price_fen?String(item.trial_price_fen/100):"",venueName:item.venues[0]?.name||"",venueAddress:item.venues[0]?.address||""});
        setSport(item.sports[0]?.id||"");setArea(item.areas[0]?.id||"");if(item.areas[0])setCity(item.areas[0].cityId);
        if(item.status==="approved")onApproved();
      }
    }).catch(reason=>{if(active){setLoadFailed(true);setError(reason instanceof Error?reason.message:"申请加载失败");}}).finally(()=>{if(active)setLoading(false);});
    return()=>{active=false;};
  },[onApproved,loadAttempt]);
  useEffect(()=>{
    let active=true;
    void mobileApi.catalog(city).then(value=>{if(!active)return;setCatalog(value);setSport(current=>value.sports.some(item=>item.id===current)?current:value.sports[0]?.id||"");setArea(current=>value.serviceAreas?.some(item=>item.id===current)?current:value.serviceAreas?.[0]?.id||"");}).catch(reason=>{if(active)setError(reason instanceof Error?reason.message:"城市资料加载失败");});
    return()=>{active=false;};
  },[city]);
  const locked=application?.status==="pending"||application?.status==="approved"||onboarding?.status==="pending"||Boolean(onboarding?.isOnboarded);
  const update=(key:FieldName,value:string)=>setFields(current=>({...current,[key]:value}));
  const save=async(submit:boolean)=>{
    if(busy||locked)return;setBusy(true);setError("");
    try{
      const result=await mobileApi.saveCoachApplication({applicationId:application?.status==="withdrawn"?undefined:application?.id,realName:fields.realName,title:fields.title,bio:fields.bio,experienceYears:Number(fields.experienceYears),audiences:split(fields.audiences),goals:split(fields.goals),strengths:split(fields.strengths),honors:split(fields.honors),credentials:split(fields.credentials),priceFen:Math.round(Number(fields.price)*100),trialPriceFen:Math.round(Number(fields.trialPrice)*100),sportIds:[sport],areaIds:[area],primarySportId:sport,primaryAreaId:area,venue:{name:fields.venueName,address:fields.venueAddress,areaId:area}});
      setApplication(result);
      for(const kind of ["avatar","hero","credential"] as const)if(files[kind])await mobileApi.uploadCoachApplicationMedia(result.id,kind,files[kind]!);
      const latest=(await mobileApi.coachApplications()).find(item=>item.id===result.id)||result;setApplication(latest);setFiles({});
      if(submit){await mobileApi.submitCoachApplication(result.id);setApplication({...latest,status:"pending"});}
    }catch(reason){setError(reason instanceof Error?reason.message:"申请保存失败，请重试");}finally{setBusy(false);}
  };
  const withdraw=async()=>{if(!application||busy)return;setBusy(true);try{await mobileApi.withdrawCoachApplication(application.id);setApplication({...application,status:"withdrawn"});}catch(reason){setError(reason instanceof Error?reason.message:"撤回失败");}finally{setBusy(false);}};
  const input=(key:FieldName,label:string,type="text",hint?:string)=><label className="zg-mobile-field" key={key}><span>{label}</span><input disabled={locked||busy} type={type} value={fields[key]} onChange={event=>update(key,event.target.value)} placeholder={hint}/></label>;
  if(!loading&&loadFailed)return <Sheet title="教练入驻" onClose={onClose}><p role="alert">{error}</p><button className="zg-sheet-primary" onClick={()=>{setLoading(true);setLoadFailed(false);setError("");setLoadAttempt(value=>value+1);}} type="button">重新读取申请</button></Sheet>;
  if(!loading&&onboarding?.isOnboarded)return <Sheet title="已入驻教练" onClose={onClose}><p>{coachOnboardingEntry(onboarding).description}</p><button className="zg-sheet-primary" onClick={onClose} type="button">返回我的</button></Sheet>;
  return <Sheet title="申请成为教练" onClose={onClose}><div className="zg-onboarding-form">
    {loading?<div className="zg-review-skeleton" aria-label="正在读取申请"><span/><span/><span/></div>:<>
    {application?<section className="zg-application-status" role="status"><strong>{COACH_APPLICATION_LABELS[application.status]}</strong><p>{application.review_note||"审核通过后自动开通教练身份、公开档案和接单。"}</p>{application.status==="pending"?<button disabled={busy} onClick={()=>void withdraw()} type="button">撤回申请</button>:null}</section>:<p className="zg-field-hint">填写真实资料并上传证明，公开资料由运营审核。</p>}
    {application?.status!=="approved"?<><section className="zg-form-section"><h2>身份与介绍</h2>{input("realName","真实姓名")}{input("title","公开头衔")}{input("experienceYears","执教年限","number")}<label className="zg-mobile-field"><span>个人简介</span><textarea disabled={locked||busy} maxLength={1000} value={fields.bio} onChange={event=>update("bio",event.target.value)} placeholder="20至1000字，介绍训练理念和服务方式"/></label></section>
    <section className="zg-form-section"><h2>项目与服务范围</h2><label className="zg-mobile-field"><span>城市</span><select disabled={locked||busy} value={city} onChange={event=>setCity(event.target.value as ServiceCityId)}>{SERVICE_CITIES.map(item=><option key={item.id} value={item.id}>{item.name}</option>)}</select></label><label className="zg-mobile-field"><span>运动项目</span><select disabled={locked||busy} value={sport} onChange={event=>setSport(event.target.value)}>{catalog?.sports.map(item=><option key={item.id} value={item.id}>{item.name}</option>)}</select></label><label className="zg-mobile-field"><span>服务区域</span><select disabled={locked||busy} value={area} onChange={event=>setArea(event.target.value)}>{catalog?.serviceAreas?.map(item=><option key={item.id} value={item.id}>{item.name}</option>)}</select></label>{input("audiences","服务对象","text","用逗号分隔")}{input("goals","训练目标")}{input("strengths","擅长方向")}</section>
    <section className="zg-form-section"><h2>价格与真实场馆</h2>{input("price","常规课（元/60分钟）","number")}{input("trialPrice","试课（元/60分钟）","number")}{input("venueName","场馆名称")}{input("venueAddress","详细地址")}</section>
    <section className="zg-form-section"><h2>资质与公开媒体</h2>{input("honors","荣誉经历（可选）")}{input("credentials","证书或经历证明名称")}<div className="zg-onboarding-uploads">{(["avatar","hero","credential"] as const).map(kind=><label key={kind}><Upload aria-hidden size={20}/><strong>{{avatar:"头像",hero:"详情图片",credential:"证明材料"}[kind]}</strong><small>{files[kind]?.name||(kind==="credential"?application?.credentialTempKeys.length:application?.[`${kind}_temp_key`])?"已选择或上传":"点击选择文件"}</small><input disabled={locked||busy} type="file" accept={kind==="credential"?"image/jpeg,image/png,image/webp,application/pdf":"image/jpeg,image/png,image/webp"} onChange={event=>{const file=event.target.files?.[0];if(file)setFiles(current=>({...current,[kind]:file}));}}/></label>)}</div><p className="zg-field-hint">照片支持 JPG、PNG、WebP，证明还支持 PDF。资料完整后才能提交审核。</p></section></>:null}
    {error?<p className="zg-auth-error" role="alert">{error}</p>:null}
    {!locked?<div className="zg-onboarding-actions"><button disabled={busy} onClick={()=>void save(false)} type="button">保存草稿</button><button className="zg-sheet-primary" disabled={busy} onClick={()=>void save(true)} type="button">{busy?"正在保存":"提交审核"}</button></div>:null}
    </>}
  </div></Sheet>;
}
