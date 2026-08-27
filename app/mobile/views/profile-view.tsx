"use client";

import {
  BadgeCheck,
  BriefcaseBusiness,
  CalendarDays,
  ChevronRight,
  FileText,
  Headphones,
  Heart,
  LockKeyhole,
  RefreshCw,
  Settings,
  ShieldCheck,
  Star,
  UserRound,
} from "lucide-react";
import Image from "next/image";
import { ProfileAvatar, VerifiedPhone } from "../components";
import type { AccountProfile, CoachAccountSummary, LearnerProfile } from "../types";

const menuRows = [
  { icon: CalendarDays, label: "我的预约", detail: "查看全部服务进度", action: "bookings" },
  { icon: Heart, label: "收藏与对比", detail: "管理关注的教练", action: "favorites" },
  { icon: UserRound, label: "常用学员", detail: "管理本人和孩子档案", action: "learners" },
  { icon: ShieldCheck, label: "服务保障", detail: "资质、合同与申诉", action: "assurance" },
  { icon: LockKeyhole, label: "账号与隐私", detail: "邮箱、授权与注销", action: "privacy" },
  { icon: Headphones, label: "帮助与反馈", detail: "客服与问题反馈", action: "feedback" },
  { icon: RefreshCw, label: "关于与更新", detail: "版本、安全校验与更新日志", action: "updates" },
] as const;

export function ProfileView({
  activeBookingCount,
  completedCount,
  learner,
  onAction,
  contactMasked,
  savedCount,
  coachSummary,
  onOpenCoachMode,
  profile,
}: {
  activeBookingCount: number;
  completedCount: number;
  learner: LearnerProfile;
  onAction: (action: string) => void;
  contactMasked?: string;
  savedCount: number;
  coachSummary?: CoachAccountSummary;
  onOpenCoachMode?: () => void;
  profile?: AccountProfile;
}) {
  const ownerName = profile?.nickname || (contactMasked ? "待完善昵称" : "访客");
  const ownerRole = `${profile?.district || "北京"} · 学员账号`;
  const learnerInitial = learner.name.trim().slice(0, 1) || "学";
  const learnerMeta = [
    learner.gender === "male" ? "男" : learner.gender === "female" ? "女" : "性别待完善",
    learner.age > 0 ? `${learner.age}岁` : "年龄待完善",
  ].join(" · ");

  return (
    <div className="zg-view zg-profile-view">
      <header className="zg-profile-toolbar">
        <span />
        <button aria-label="联系客服" onClick={() => onAction("feedback")} type="button"><Headphones aria-hidden size={21} /></button>
        <button aria-label="设置" onClick={() => onAction("privacy")} type="button"><Settings aria-hidden size={21} /></button>
      </header>

      <section className="zg-profile-summary">
        {profile?.avatarUrl ? <span className="zg-profile-account-avatar"><Image alt={`${ownerName}头像`} height={64} src={profile.avatarUrl} unoptimized width={64} /></span> : <ProfileAvatar label={`${ownerName}头像`} />}
        <div><h1>{ownerName}</h1><p>{ownerRole}</p></div>
        <button onClick={() => onAction(contactMasked ? "edit-profile" : "authenticate")} type="button"><VerifiedPhone masked={contactMasked} /></button>
      </section>

      {coachSummary?.auditStatus === "approved" && onOpenCoachMode ? (
        <button className="zg-coach-entry" onClick={onOpenCoachMode} type="button">
          <span className="zg-coach-entry-icon"><BriefcaseBusiness aria-hidden size={23} /></span>
          <span>
            <strong>教练工作台</strong>
            <small><BadgeCheck aria-hidden size={14} />{coachSummary.name}教练 · {coachSummary.sport}</small>
          </span>
          {coachSummary.pendingBookingCount > 0 ? <em>{coachSummary.pendingBookingCount} 个预约待处理</em> : <em>进入管理</em>}
          <ChevronRight aria-hidden size={18} />
        </button>
      ) : null}

      <section className="zg-profile-stats">
        <button onClick={() => onAction("favorites")} type="button"><strong>{savedCount}</strong><span>收藏教练</span></button>
        <button onClick={() => onAction("bookings")} type="button"><strong>{activeBookingCount}</strong><span>进行中预约</span></button>
        <button onClick={() => onAction("records")} type="button"><strong>{completedCount}</strong><span>完成课程</span></button>
      </section>

      <section className="zg-training-record">
        <header><h2>训练档案</h2><button onClick={() => onAction("learners")} type="button">管理<ChevronRight aria-hidden size={16} /></button></header>
        <div>
          <span className="zg-learner-avatar">{learnerInitial}</span>
          <article>
            <h3>{learner.name}<small>{learnerMeta}</small></h3>
            <p>目标：{learner.goal}</p>
            <p>{completedCount > 0 ? `已完成 ${completedCount} 节课程，训练小结由教练完成课程后同步。` : "完成课程后，教练的训练小结会显示在这里。"}</p>
            <small><Star aria-hidden fill="currentColor" size={13} />{completedCount > 0 ? "前往训练记录查看课程明细" : "暂无课程记录"}</small>
          </article>
        </div>
      </section>

      <section className="zg-profile-menu">
        {menuRows.map((row) => {
          const Icon = row.icon;
          return (
            <button key={row.action} onClick={() => onAction(row.action)} type="button">
              <Icon aria-hidden size={21} />
              <span><strong>{row.label}</strong><small>{row.detail}</small></span>
              {row.action === "bookings" && activeBookingCount ? <em>{activeBookingCount} 个进行中</em> : null}
              {row.action === "favorites" ? <em>{savedCount} 位教练</em> : null}
              <ChevronRight aria-hidden size={17} />
            </button>
          );
        })}
      </section>

      <section className="zg-compliance-links">
        <button onClick={() => onAction("privacy")} type="button"><FileText aria-hidden size={17} />用户协议</button>
        <button onClick={() => onAction("privacy")} type="button"><LockKeyhole aria-hidden size={17} />隐私政策</button>
      </section>
    </div>
  );
}
