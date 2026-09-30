"use client";
import styles from './platform-pages.module.css';
export const CLASSIFICATION_LABELS: Record<string,string> = {production_eligible:'真实合格',qa:'QA 测试',unclassified:'未分类',excluded:'已排除',all:'全部（含测试）'};
export function ClassificationFilter({value,onChange,workQueue=false}:{value:string;onChange:(value:string)=>void;workQueue?:boolean}) {
  return <div className={styles.toolbar}><label className={styles.classificationFilter}>数据分类 <select aria-label="数据分类" value={value} onChange={event=>onChange(event.target.value)}>{workQueue ? <option value="work_queue">工作队列（含未分类）</option> : null}{Object.entries(CLASSIFICATION_LABELS).map(([key,label])=><option key={key} value={key}>{label}</option>)}</select></label></div>;
}
