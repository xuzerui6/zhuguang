"use client";

import { CalendarDays, MapPin, MessageCircle, RotateCcw } from "lucide-react";
import { getBookingPresentation } from "../../../shared/booking-presentation";
import { BookingStatusPill, CoachAvatar, EmptyState, PageHeader } from "../components";
import { getBookingBucket } from "../domain";
import type { CoachVenue, MobileBooking, MobileCoach, PlatformCapabilities } from "../types";

type BookingTab = "pending" | "active" | "completed";

export function BookingsView({
  bookings,
  capabilities,
  coaches,
  onCancel,
  onComplete,
  onDiscover,
  onMessage,
  onReschedule,
  onReview,
  onTab,
  onTestPayment,
  tab,
  venues,
}: {
  bookings: MobileBooking[];
  capabilities: PlatformCapabilities | null;
  coaches: MobileCoach[];
  onCancel: (booking: MobileBooking) => void;
  onComplete: (booking: MobileBooking, decision: "accepted" | "disputed") => void;
  onDiscover: () => void;
  onMessage: (coachId: number) => void;
  onReschedule: (booking: MobileBooking) => void;
  onReview: (booking: MobileBooking) => void;
  onTab: (tab: BookingTab) => void;
  onTestPayment: (booking: MobileBooking) => void;
  tab: BookingTab;
  venues: CoachVenue[];
}) {
  const visibleBookings = bookings.filter((booking) => getBookingBucket(booking) === tab);
  return (
    <div className="zg-view zg-bookings-view">
      <PageHeader title="我的预约" />
      <div aria-label="预约状态" className="zg-segmented-tabs" role="tablist">
        {([
          ["pending", "待确认"],
          ["active", "进行中"],
          ["completed", "已结束"],
        ] as const).map(([id, label]) => (
          <button aria-selected={tab === id} className={tab === id ? "is-active" : ""} key={id} onClick={() => onTab(id)} role="tab" type="button">
            {label}
            {bookings.filter((booking) => getBookingBucket(booking) === id).length ? <b>{bookings.filter((booking) => getBookingBucket(booking) === id).length}</b> : null}
          </button>
        ))}
      </div>

      {visibleBookings.length ? (
        <div className="zg-booking-list">
          {visibleBookings.map((booking) => {
            const coach = coaches.find((item) => item.id === booking.coachId);
            const venue = venues.find((item) => item.id === booking.venueId);
            const display = getBookingPresentation(booking);
            return (
              <article className="zg-booking-card" key={booking.id}>
                <header><BookingStatusPill booking={booking} />{display.submittedAt ? <small>提交于 {display.submittedAt}</small> : null}</header>
                <div className="zg-booking-coach-row">
                  {coach ? <CoachAvatar coach={coach} size="medium" /> : null}
                  <span><strong>{coach?.name || booking.coachName || "预约教练"}</strong><small>{coach?.sport || booking.sport || ""}</small></span>
                  {display.paymentLabel ? <b>{display.paymentLabel}</b> : null}
                </div>
                <dl>
                  <div><dt><CalendarDays aria-hidden size={18} /></dt><dd><strong>{booking.date}（{booking.dateLabel}）</strong><small>{booking.time}-{booking.endTime}</small></dd></div>
                  <div><dt><MapPin aria-hidden size={18} /></dt><dd><strong>{booking.locationType === "custom" ? booking.customDistrict || "协商训练地点" : booking.venueName || venue?.name || "查看预约地点记录"}</strong><small>{booking.locationType === "custom" ? booking.customAddress : venue?.address || ""}</small></dd></div>
                </dl>
                <ol className="zg-booking-timeline">
                  {display.timeline.map((node) => <li className={node.complete ? "is-complete" : "is-current"} key={node.title}><span /><div><strong>{node.title}</strong><small>{node.detail}</small></div></li>)}
                </ol>
                <div className="zg-booking-card-actions">
                  {display.canComplete ? <><button onClick={() => onComplete(booking, "disputed")} type="button">提出异议</button><button className="is-primary" onClick={() => onComplete(booking, "accepted")} type="button">确认课程完成</button></> : null}
                  {display.canCancel ? <button onClick={() => onCancel(booking)} type="button">取消申请</button> : null}
                  {display.canReschedule ? <button onClick={() => onReschedule(booking)} type="button"><RotateCcw aria-hidden size={16} />修改时间</button> : null}
                  {capabilities?.onlineTransactions.enabled && capabilities.onlineTransactions.mode === "test" && display.canPay ? <button onClick={() => onTestPayment(booking)} type="button">隔离测试支付</button> : null}
                  {display.canReview ? <button className="is-primary" onClick={() => onReview(booking)} type="button">{booking.review.canResubmit ? "修改评价" : "评价教练"}</button> : null}
                  <button className="is-primary" onClick={() => onMessage(booking.coachId)} type="button">
                    <MessageCircle aria-hidden size={16} />
                    联系教练
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      ) : (
        <EmptyState action="去找教练" description={tab === "completed" ? "完成、取消、拒绝或失效的预约记录会保留在这里。" : "找到合适教练并提交试课后，服务进度会出现在这里。"} onAction={onDiscover} title={tab === "completed" ? "还没有已结束预约" : "暂时没有这类预约"} />
      )}

    </div>
  );
}
