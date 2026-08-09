import { ArrowLeft, LockKeyhole } from "lucide-react";
import Link from "next/link";
import { Brand } from "./brand";
import styles from "./access-denied.module.css";

const areaLabels = {
  coach: "教练工作台",
  ops: "运营工作台",
  student: "学员平台",
} as const;

export function AccessDenied({ area }: { area: keyof typeof areaLabels }) {
  return (
    <main className={styles.page}>
      <header><Brand /></header>
      <section>
        <span className={styles.icon}><LockKeyhole aria-hidden size={26} /></span>
        <p>访问权限</p>
        <h1>当前账号暂不能进入{areaLabels[area]}</h1>
        <p>工作台内容仅向已授权账号开放。教练资格暂停或角色发生变化时，系统也会自动收回入口。</p>
        <div>
          <Link className={styles.primary} href="/student">返回学员平台</Link>
          <Link href={`/login?next=/${area === "coach" ? "coach-workspace" : area}`}><ArrowLeft aria-hidden size={16} />切换账号</Link>
        </div>
      </section>
    </main>
  );
}
