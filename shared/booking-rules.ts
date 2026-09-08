export const EFFECTIVE_BOOKING_STATUSES = ["pending_coach", "reschedule_requested", "confirmed", "completed"] as const;
export const EFFECTIVE_BOOKING_SQL = EFFECTIVE_BOOKING_STATUSES.map((status) => `'${status}'`).join(",");
export function consumesTrial(status: string): boolean { return (EFFECTIVE_BOOKING_STATUSES as readonly string[]).includes(status); }
export const BOOKING_LABELS: Record<string,string> = { pending_coach: "等待教练确认", reschedule_requested: "方案协商中", confirmed: "预约已确认", completed: "课程已完成", rejected: "教练已拒绝", expired: "申请已失效", cancelled_by_student: "学员已取消", cancelled_by_coach: "教练已取消", cancelled: "预约已取消" };
export function isTerminalBooking(status: string) { return ["completed","rejected","expired","cancelled_by_student","cancelled_by_coach","cancelled"].includes(status); }
