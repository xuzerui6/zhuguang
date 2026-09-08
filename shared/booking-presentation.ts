import type { MobileBooking } from "../app/mobile/types";
import { BOOKING_LABELS, isTerminalBooking } from "./booking-rules";

export function getBookingPresentation(booking: Pick<MobileBooking, "status" | "paymentStatus" | "submittedAt" | "completion" | "review">) {
  const labels = BOOKING_LABELS;
  const status = booking.status as string;
  const ended = isTerminalBooking(status);
  const pendingCompletion = status === "confirmed" && booking.completion?.status === "pending_student";
  const disputed = status === "confirmed" && booking.completion?.status === "disputed";
  const label = pendingCompletion ? "待学员确认完成" : disputed ? "完成状态存在异议" : labels[status] || "预约状态待同步";
  const submittedAt = booking.submittedAt && /\d{1,4}[年/月.:-]/u.test(booking.submittedAt) ? booking.submittedAt : null;
  const paymentLabel = booking.paymentStatus === "offline_paid" ? "已登记线下收款" : booking.paymentStatus === "online_paid" ? "已支付" : booking.paymentStatus === "offline_unpaid" && ["confirmed", "completed"].includes(status) ? "线下收款未登记" : null;
  const note = status === "pending_coach" ? "申请已提交，等待教练处理" : status === "confirmed" ? pendingCompletion ? "请核对课程履约情况后确认或提出异议" : disputed ? "异议已交由售后处理" : "请按双方确认的时间与地点训练" : status === "reschedule_requested" ? "请核对双方提出的时间与地点方案" : status === "completed" ? "课程履约已完成，评价资格以平台记录为准" : "该申请已结束，历史记录保留";
  return { label, ended, paymentLabel, submittedAt, timeline: [{ title: "已提交申请", detail: submittedAt || "申请已记录", complete: true }, { title: label, detail: note, complete: ended || status === "confirmed" }], canCancel: status === "pending_coach", canReschedule: status === "confirmed" && !pendingCompletion && !disputed, canComplete: pendingCompletion, canPay: status === "confirmed" && !pendingCompletion && !disputed && booking.paymentStatus === "offline_unpaid", canReview: status === "completed" && Boolean(booking.review?.canSubmit || booking.review?.canResubmit) };
}
