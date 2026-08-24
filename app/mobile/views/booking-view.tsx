"use client";

import { Check, ChevronRight, MapPin, ShieldCheck, UserRound } from "lucide-react";
import { calculateDurationPriceFen } from "../../../shared/pricing";
import { formatBeijingDateTimeLocal } from "../../../shared/scheduling";
import { CoachAvatar, MatchScore, PageHeader, TrustRow } from "../components";
import { formatYuan, getMatchResult } from "../domain";
import type { BookingOptions, CoachVenue, LearnerProfile, MatchPreferences, MobileCoach } from "../types";

type Props = {
  agreed: boolean; coach: MobileCoach; customAddress: string; customDistrict: string; customLocationNote: string;
  durationMinutes: 60 | 90 | 120; isTrialBooking: boolean; learner: LearnerProfile; locationType: "venue" | "custom";
  note: string; onBack: () => void; onChangeCustomAddress: (value: string) => void; onChangeCustomDistrict: (value: string) => void;
  onChangeCustomLocationNote: (value: string) => void; onChangeDuration: (value: 60 | 90 | 120) => void;
  onChangeLocationType: (value: "venue" | "custom") => void; onChangeNote: (value: string) => void; onChangeStartsAt: (value: string) => void;
  onChangeVenue: (id: string) => void; onConfirm: () => void; onEditLearner: () => void; onToggleAgreement: () => void;
  options: BookingOptions; preferences: MatchPreferences; startsAt: string; submitting: boolean; venue: CoachVenue;
};

export function BookingView(props: Props) {
  const match = getMatchResult(props.coach, props.preferences);
  const basePriceFen = props.isTrialBooking ? props.options.trialBasePriceFen : props.options.regularBasePriceFen;
  const feeFen = calculateDurationPriceFen(basePriceFen, props.durationMinutes);
  const locationReady = props.locationType === "venue" ? Boolean(props.venue.id) : Boolean(props.customDistrict.trim() && props.customAddress.trim());

  return <div className="zg-view zg-booking-view">
    <PageHeader onBack={props.onBack} title="申请训练时间" />
    <section className="zg-booking-coach"><CoachAvatar coach={props.coach} size="medium" /><div><h2>{props.coach.name}</h2><p>{props.coach.sport} · {props.coach.level}</p><small>{props.coach.district} · 教练确认后生效</small></div><MatchScore score={match.score} /></section>
    <section className="zg-form-section"><h2>训练时间</h2><label className="zg-mobile-field"><span>开始时间（北京时间）</span><input max={formatBeijingDateTimeLocal(props.options.latestStartsAt)} min={formatBeijingDateTimeLocal(props.options.earliestStartsAt)} onChange={(event) => props.onChangeStartsAt(event.target.value)} type="datetime-local" value={props.startsAt} /></label><div className="zg-time-grid zg-duration-grid">{props.options.durationMinutes.map((minutes) => <button className={props.durationMinutes === minutes ? "is-active" : ""} key={minutes} onClick={() => props.onChangeDuration(minutes)} type="button"><span>{minutes}</span><small>分钟</small></button>)}</div><p className="zg-field-hint">可申请未来2小时至60天内的时间；多个学员可申请，教练确认时才锁定日程。</p></section>
    <section className="zg-form-section"><h2>训练地点</h2><div className="zg-location-toggle"><button aria-pressed={props.locationType === "venue"} onClick={() => props.onChangeLocationType("venue")} type="button">审核场馆</button><button aria-pressed={props.locationType === "custom"} onClick={() => props.onChangeLocationType("custom")} type="button">期望地点</button></div>{props.locationType === "venue" ? <label className="zg-mobile-field"><span>选择场馆</span><select onChange={(event) => props.onChangeVenue(event.target.value)} value={props.venue.id}>{props.options.venues.map((item) => <option key={item.id} value={item.id}>{item.name} · {item.district}</option>)}</select><small><MapPin aria-hidden size={14} />{props.venue.address}</small></label> : <div className="zg-mobile-field-grid"><label className="zg-mobile-field"><span>期望区域</span><input maxLength={40} onChange={(event) => props.onChangeCustomDistrict(event.target.value)} placeholder="例如：通州区" value={props.customDistrict} /></label><label className="zg-mobile-field"><span>详细地点</span><input maxLength={240} onChange={(event) => props.onChangeCustomAddress(event.target.value)} placeholder="仅双方与运营可见" value={props.customAddress} /></label><label className="zg-mobile-field"><span>补充说明</span><input maxLength={300} onChange={(event) => props.onChangeCustomLocationNote(event.target.value)} placeholder="集合点或交通说明" value={props.customLocationNote} /></label></div>}</section>
    <section className="zg-form-section"><h2>学员与需求</h2><button className="zg-select-row" onClick={props.onEditLearner} type="button"><UserRound aria-hidden size={22} /><span><strong>{props.learner.name} · {props.learner.age || "年龄待完善"}</strong><small>{props.learner.sport} {props.learner.level} · {props.learner.goal}</small></span><ChevronRight aria-hidden size={18} /></button><label className="zg-note-field"><span>训练需求说明</span><textarea maxLength={200} onChange={(event) => props.onChangeNote(event.target.value)} placeholder="补充训练基础、伤病史或希望重点改善的内容" rows={3} value={props.note} /><small>{props.note.length}/200</small></label></section>
    <section className="zg-form-section"><h2>服务保障</h2><div className="zg-trust-list"><TrustRow detail="教练可确认、拒绝或提出新的时间地点方案" title="双方确认后生效" /><TrustRow detail="反提案不能改变学员选择的时长和费用快照" title="价格保持透明" /></div></section>
    <section className="zg-fee-section"><h2>费用明细</h2><p><span>{props.isTrialBooking ? "首次试课" : "常规课"} · {props.durationMinutes}分钟</span><strong>{formatYuan(feeFen)}</strong></p><p><span>支付方式</span><strong>确认后线下支付</strong></p><p className="is-total"><span>费用快照</span><strong>{formatYuan(feeFen)} <em>待支付</em></strong></p></section>
    <label className="zg-agreement-row"><input checked={props.agreed} onChange={props.onToggleAgreement} type="checkbox" /><span aria-hidden className={props.agreed ? "is-checked" : ""}>{props.agreed ? <Check size={14} /> : null}</span><small>我已阅读服务与取消规则；未处理申请会在24小时后或训练开始时自动失效。</small></label>
    <div className="zg-booking-bottom-space" /><footer className="zg-booking-action"><button disabled={!props.agreed || !locationReady || props.submitting} onClick={props.onConfirm} type="button">{props.submitting ? "正在提交..." : "提交时间申请"}</button><small><ShieldCheck aria-hidden size={14} />教练确认后预约生效</small></footer>
  </div>;
}
