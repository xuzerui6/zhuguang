"use client";

import { CalendarDays, Clock3, MapPin, MessageCircle, Phone, RotateCcw } from "lucide-react";
import { BookingStatusPill, CoachAvatar, EmptyState, PageHeader } from "../components";
import { getBookingBucket } from "../domain";
import type { CoachVenue, MobileBooking, MobileCoach } from "../types";

type BookingTab = "pending" | "active" | "completed";

export function BookingsView({
  bookings,
  coaches,
  onCancel,
  onDiscover,
  onMessage,
  onReschedule,
  onTab,
  tab,
  venues,
}: {
  bookings: MobileBooking[];
  coaches: MobileCoach[];
  onCancel: (booking: MobileBooking) => void;
  onDiscover: () => void;
  onMessage: (coachId: number) => void;
  onReschedule: (booking: MobileBooking) => void;
  onTab: (tab: BookingTab) => void;
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
          ["completed", "已完成"],
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
            const coach = coaches.find((item) => item.id === booking.coachId) ?? coaches[0];
            const venue = venues.find((item) => item.id === booking.venueId) ?? venues[0];
            return (
              <article className="zg-booking-card" key={booking.id}>
                <header><BookingStatusPill booking={booking} /><small>提交于 {booking.submittedAt}</small></header>
                <div className="zg-booking-coach-row">
                  <CoachAvatar coach={coach} size="medium" />
                  <span><strong>{coach.name}</strong><small>{coach.sport} · {coach.level}</small></span>
                  <b>{booking.status === "pending_coach" ? "等待确认" : "线下待支付"}</b>
                </div>
                <dl>
                  <div><dt><CalendarDays aria-hidden size={18} /></dt><dd><strong>{booking.date}（{booking.dateLabel}）</strong><small>{booking.time}-{booking.endTime}</small></dd></div>
                  <div><dt><MapPin aria-hidden size={18} /></dt><dd><strong>{venue.name}</strong><small>{venue.address}</small></dd></div>
                </dl>
                <ol className="zg-booking-timeline">
                  <li className="is-complete"><span /> <div><strong>已提交申请</strong><small>{booking.submittedAt}</small></div></li>
                  <li className={booking.status === "confirmed" ? "is-complete" : "is-current"}><span /> <div><strong>{booking.status === "confirmed" ? "教练已确认" : "待教练确认"}</strong><small>{booking.status === "confirmed" ? "课程时间已锁定" : "教练将在 24 小时内处理"}</small></div></li>
                  <li><span /> <div><strong>确认后联系</strong><small>平台将同步完整联系方式</small></div></li>
                </ol>
                <div className="zg-booking-card-actions">
                  {booking.status === "pending_coach" ? <button onClick={() => onCancel(booking)} type="button">取消申请</button> : null}
                  {booking.status === "confirmed" ? <button onClick={() => onReschedule(booking)} type="button"><RotateCcw aria-hidden size={16} />修改时间</button> : null}
                  <button className="is-primary" onClick={() => onMessage(coach.id)} type="button">
                    {booking.status === "confirmed" ? <Phone aria-hidden size={16} /> : <MessageCircle aria-hidden size={16} />}
                    联系教练
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      ) : (
        <EmptyState action="去找教练" description={tab === "completed" ? "完成的课程和训练反馈会沉淀在这里。" : "找到合适教练并提交试课后，服务进度会出现在这里。"} onAction={onDiscover} title={tab === "completed" ? "还没有已完成课程" : "暂时没有这类预约"} />
      )}

      {tab === "active" && visibleBookings.length ? (
        <section className="zg-upcoming-note"><Clock3 aria-hidden size={20} /><span><strong>课程前提醒</strong><small>开始前 2 小时会通过站内消息和短信提醒。</small></span></section>
      ) : null}
    </div>
  );
}
