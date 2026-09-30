import type { ServiceCityId } from "./service-cities";

export type CoachOnboardingSummary = {
  status: CoachApplication["status"] | "not_applied";
  isOnboarded: boolean;
  canApply: boolean;
  canEnterWorkspace: boolean;
  applicationId?: string;
  coachId?: number;
  rejectionReason?: string;
};

export function coachOnboardingEntry(summary?: CoachOnboardingSummary, coach?: { auditStatus: string }) {
  if (summary?.isOnboarded || coach || summary?.status === "approved") {
    return { kind: "coach" as const, title: "教练工作台", description: (summary?.canEnterWorkspace ?? coach?.auditStatus === "approved") ? "处理预约、日程和学员消息" : "教练权限暂停，请联系平台处理", canEnter: summary?.canEnterWorkspace ?? coach?.auditStatus === "approved" };
  }
  const title = summary?.status === "pending" ? "查看审核进度" : summary?.status === "draft" ? "继续填写" : summary?.status === "rejected" ? "修改并重新提交" : "申请成为教练";
  return { kind: "application" as const, title, description: summary?.rejectionReason || (summary?.status === "pending" ? "资料审核中，可查看进度或撤回申请" : "提交真实资料，审核通过后开通接单"), canEnter: true };
}

export type CoachApplication = {
  id: string;
  status: "draft" | "pending" | "approved" | "rejected" | "withdrawn";
  real_name: string;
  title: string;
  bio: string;
  experience_years: number;
  price_fen: number;
  trial_price_fen: number;
  review_note?: string;
  submitted_at?: number;
  created_at?: number;
  avatar_temp_key?: string;
  hero_temp_key?: string;
  credentialTempKeys: string[];
  audiences: string[];
  goals: string[];
  strengths: string[];
  honors: string[];
  credentials: string[];
  sports: Array<{ id: string; name: string; primary: number }>;
  areas: Array<{ id: string; cityId: ServiceCityId; name: string; primary: number }>;
  venues: Array<{ id: string; areaId: string; name: string; address: string }>;
};

export type CoachApplicationDraft = {
  applicationId?: string;
  realName: string;
  title: string;
  bio: string;
  experienceYears: number;
  audiences: string[];
  goals: string[];
  strengths: string[];
  honors: string[];
  credentials: string[];
  priceFen: number;
  trialPriceFen: number;
  sportIds: string[];
  areaIds: string[];
  primarySportId: string;
  primaryAreaId: string;
  venue: { name: string; address: string; areaId: string };
};

export const COACH_APPLICATION_LABELS = {
  draft: "草稿", pending: "待审核", approved: "已通过", rejected: "未通过", withdrawn: "已撤回",
} as const;
