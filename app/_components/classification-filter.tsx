"use client";
export const CLASSIFICATION_LABELS: Record<string,string> = {production_eligible:'真实合格',qa:'QA 测试',unclassified:'未分类',excluded:'已排除',all:'全部（含测试）'};
export function ClassificationFilter({value,onChange}:{value:string;onChange:(value:string)=>void}) {
  return <label>数据分类 <select aria-label="数据分类" value={value} onChange={event=>onChange(event.target.value)} style={{minHeight:44}}>{Object.entries(CLASSIFICATION_LABELS).map(([key,label])=><option key={key} value={key}>{label}</option>)}</select></label>;
}
