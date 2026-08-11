"use client";

import {
  Check,
  ChevronRight,
  MapPin,
  ShieldCheck,
  UserRound,
} from "lucide-react";
import { CoachAvatar, MatchScore, PageHeader, TrustRow } from "../components";
import { formatYuan, getMatchResult } from "../domain";
import type {
  BookingSlot,
  CoachVenue,
  LearnerProfile,
  MatchPreferences,
  MobileCoach,
} from "../types";

export function BookingView({
  agreed,
  coach,
  learner,
  note,
  onBack,
  onChangeNote,
  onConfirm,
  onSelectSlot,
  onToggleAgreement,
  preferences,
  selectedSlot,
  slots,
  submitting,
  venue,
}: {
  agreed: boolean;
  coach: MobileCoach;
  learner: LearnerProfile;
  note: string;
  onBack: () => void;
  onChangeNote: (value: string) => void;
  onConfirm: () => void;
  onSelectSlot: (slot: BookingSlot) => void;
  onToggleAgreement: () => void;
  preferences: MatchPreferences;
  selectedSlot: BookingSlot;
  slots: BookingSlot[];
  submitting: boolean;
  venue: CoachVenue;
}) {
  const match = getMatchResult(coach, preferences);
  const dates = Array.from(new Map(slots.map((slot) => [slot.date, { date: slot.date, dateLabel: slot.dateLabel }])).values()).slice(0, 5);
  const selectedDateSlots = slots.filter((slot) => slot.date === selectedSlot.date);

  return (
    <div className="zg-view zg-booking-view">
      <PageHeader onBack={onBack} title="提交预约" />

      <section className="zg-booking-coach">
        <CoachAvatar coach={coach} size="medium" />
        <div><h2>{coach.name}</h2><p>{coach.sport} · {coach.level}</p><small>{coach.isNew ? "新教练" : `★ ${coach.rating}`} · {coach.distanceKm ? `${coach.distanceKm.toFixed(1)}km` : coach.district}</small></div>
        <MatchScore score={match.score} />
      </section>

      <section className="zg-form-section">
        <h2>选择时间</h2>
        <div className="zg-date-strip">
          {dates.map((item) => {
            const [month, day] = item.date.slice(5).split("-");
            return (
              <button
                className={selectedSlot.date === item.date ? "is-active" : ""}
                key={item.date}
                onClick={() => {
                  const first = slots.find((slot) => slot.date === item.date && slot.available);
                  if (first) onSelectSlot(first);
                }}
                type="button"
              >
                <strong>{item.dateLabel}</strong><small>{month}-{day}</small>
              </button>
            );
          })}
        </div>
        <div className="zg-time-grid">
          {selectedDateSlots.map((slot) => (
            <button
              className={selectedSlot.id === slot.id ? "is-active" : ""}
              disabled={!slot.available}
              key={slot.id}
              onClick={() => onSelectSlot(slot)}
              type="button"
            >{slot.time}</button>
          ))}
        </div>
      </section>

      <section className="zg-form-section">
        <h2>选择场馆</h2>
        <button className="zg-select-row" type="button">
          <MapPin aria-hidden size={22} />
          <span><strong>{venue.name}</strong><small>{venue.address}</small></span>
          <ChevronRight aria-hidden size={18} />
        </button>
      </section>

      <section className="zg-form-section">
        <h2>学员信息</h2>
        <button className="zg-select-row" type="button">
          <UserRound aria-hidden size={22} />
          <span><strong>{learner.name} · {learner.age} 岁</strong><small>{learner.sport} {learner.level} · {learner.goal}</small></span>
          <ChevronRight aria-hidden size={18} />
        </button>
        <label className="zg-note-field">
          <span>训练需求说明</span>
          <textarea maxLength={200} onChange={(event) => onChangeNote(event.target.value)} placeholder="补充伤病史、训练频率或希望重点改善的内容" rows={3} value={note} />
          <small>{note.length}/200</small>
        </label>
      </section>

      <section className="zg-form-section">
        <h2>服务保障与取消政策</h2>
        <div className="zg-trust-list">
          <TrustRow detail={coach.isNew ? "平台仅展示已经确认的基础资料" : "身份、退役履历和教学资质已完成复核"} title={coach.verificationLabel ?? "教练资质严格审核"} />
          <TrustRow detail="试课前 24 小时可免费取消，逾期不退" title="预约取消政策" />
        </div>
      </section>

      <section className="zg-fee-section">
        <h2>费用明细</h2>
        <p><span>试课价</span><strong>{formatYuan(coach.trialPrice * 100)}</strong></p>
        <p><span>支付方式</span><strong>教练确认后线下支付</strong></p>
        <p className="is-total"><span>本次应付</span><strong>{formatYuan(coach.trialPrice * 100)} <em>待支付</em></strong></p>
      </section>

      <label className="zg-agreement-row">
        <input checked={agreed} onChange={onToggleAgreement} type="checkbox" />
        <span aria-hidden className={agreed ? "is-checked" : ""}>{agreed ? <Check size={14} /> : null}</span>
        <small>我已阅读并同意《服务保障说明》《取消政策》与《隐私政策》</small>
      </label>

      <div className="zg-booking-bottom-space" />
      <footer className="zg-booking-action">
        <button disabled={!agreed || submitting} onClick={onConfirm} type="button">
          {submitting ? "正在提交..." : "提交预约申请"}
        </button>
        <small><ShieldCheck aria-hidden size={14} />提交后需验证邮箱，以便同步预约进度</small>
      </footer>
    </div>
  );
}
