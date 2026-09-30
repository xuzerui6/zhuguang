import { DelayedSkeleton } from '../../components/delayed-skeleton';
import Taro, { useDidHide, useDidShow, useRouter } from '@tarojs/taro';
import { Input, Picker, Text, Textarea, View } from '@tarojs/components';
import { useRef, useState } from 'react';
import { coachOverview, markOfflinePaid, proposeCoachBooking, publishTrainingRecord, transitionCoachBooking } from '../../services/api';
import { SERVICE_AREAS, serviceCityName } from '../../services/service-city';
import { dateInShanghai, isTrainingTimeAllowed, LatestRead, parseTrainingTime } from '../../../../shared/product-flow';
import type { Booking, CoachOverview } from '../../types';
import { BOOKING_LABELS } from '../../../../shared/booking-rules';
import '../detail.scss';

export default function CoachRequestPage() {
  const id = String(useRouter().params.id || '');
  const [overview, setOverview] = useState<CoachOverview | null>(null);
  const [booking, setBooking] = useState<Booking | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [proposal, setProposal] = useState(false);
  const [date, setDate] = useState(() => dateInShanghai(Date.now() + 86_400_000));
  const [range] = useState(() => ({ start: dateInShanghai(), end: dateInShanghai(Date.now() + 60 * 86_400_000) }));
  const [time, setTime] = useState('18:30');
  const [locationType, setLocationType] = useState<'venue' | 'custom'>('custom');
  const [venueId, setVenueId] = useState('');
  const [customDistrict, setCustomDistrict] = useState('');
  const [customAddress, setCustomAddress] = useState('');
  const [note, setNote] = useState('');
  const [summary, setSummary] = useState('');
  const [busy, setBusy] = useState(false);
  const lock = useRef(false);
  const reads = useRef(new LatestRead());
  const load = async () => {
    const ticket = reads.current.begin();
    try {
      const data = await coachOverview();
      if (!reads.current.isCurrent(ticket)) return;
      setOverview(data); setBooking(data.bookings.find(item => item.id === id) || null); setError('');
    } catch (nextError) { if (reads.current.isCurrent(ticket)) setError(nextError instanceof Error ? nextError.message : '加载失败，请重试'); }
    finally { if (reads.current.isCurrent(ticket)) setLoading(false); }
  };
  useDidShow(() => { void load(); });
  useDidHide(() => reads.current.cancel());
  const city = booking?.serviceCityId;
  const areas = city ? SERVICE_AREAS[city] : [];
  const venues = overview?.venues.filter(venue => city && venue.city === serviceCityName(city)) || [];
  const perform = async (action: () => Promise<unknown>, message: string) => {
    if (lock.current) return;
    lock.current = true; setBusy(true); setError(''); reads.current.cancel();
    try { await action(); setProposal(false); await load(); Taro.showToast({ title: message, icon: 'success' }); }
    catch (nextError) { setError(nextError instanceof Error ? nextError.message : '操作失败，请重试'); }
    finally { lock.current = false; setBusy(false); }
  };
  const decide = async (status: 'confirmed' | 'rejected' | 'completed' | 'cancelled_by_coach') => {
    const result = await Taro.showModal({ title: status === 'completed' ? '确认课程已完成' : '确认处理预约', content: '操作会同步给学员，请核对课程实际状态。' });
    if (result.confirm) await perform(() => transitionCoachBooking(id, status), '预约状态已更新');
  };
  const submitProposal = async () => {
    const startsAt = parseTrainingTime(date, time);
    if (!city || !isTrainingTimeAllowed(startsAt)) { setError('请选择未来2小时至60天内的北京时间，并核对预约城市'); return; }
    if (locationType === 'venue' ? !venues.some(venue => venue.id === venueId) : !areas.includes(customDistrict) || customAddress.trim().length < 4) { setError('请选择本次预约城市的场馆，或填写区域和详细地点'); return; }
    await perform(() => proposeCoachBooking({ bookingId: id, startsAt, locationType, venueId: locationType === 'venue' ? venueId : undefined, customDistrict: locationType === 'custom' ? customDistrict : undefined, customAddress: locationType === 'custom' ? customAddress.trim() : undefined, note: note.trim() }), '方案已发送');
  };
  return <View className="zg-request-page">
    <View className="zg-detail-nav"><View onClick={() => Taro.navigateBack()}><Text>返回</Text></View><Text>预约详情</Text><View /></View>
    {error ? <View className="zg-inline-error"><Text>{error}</Text><Text onClick={() => void load()}>重新加载</Text></View> : null}
    {booking ? <View className="zg-request-detail">
      <Text className="zg-detail-heading">{BOOKING_LABELS[booking.status] || '状态待同步'}</Text>
      <View className="zg-form-section"><Text className="zg-detail-title">{booking.dateLabel} {booking.time}–{booking.endTime}</Text><Text>{booking.customAddress || booking.venueName || '地点信息未提供'}</Text><Text>{city ? serviceCityName(city) : '城市信息待核对'} · ¥{(booking.feeFen / 100).toFixed(2)} · {booking.durationMinutes || '—'}分钟</Text><Text>{booking.learnerName || '学员档案信息未提供'}</Text><Text className="zg-helper">{booking.note || '学员未填写补充需求'}</Text></View>
      {booking.status === 'pending_coach' && proposal ? <View className="zg-form-section">
        <Text className="zg-detail-heading">提出时间地点方案</Text><Text className="zg-helper">时长与费用保持不变，学员确认后生效。</Text>
        <View className="zg-form-grid"><Picker mode="date" start={range.start} end={range.end} value={date} onChange={event => setDate(event.detail.value)}><View className="zg-field"><Text>北京时间日期</Text><Text>{date}</Text></View></Picker><Picker mode="time" value={time} onChange={event => setTime(event.detail.value)}><View className="zg-field"><Text>开始时间</Text><Text>{time}</Text></View></Picker></View>
        <View className="zg-segments is-two"><View className={locationType === 'custom' ? 'is-active' : ''} onClick={() => setLocationType('custom')}><Text>协商地点</Text></View>{venues.length ? <View className={locationType === 'venue' ? 'is-active' : ''} onClick={() => setLocationType('venue')}><Text>已审核场馆</Text></View> : null}</View>
        {locationType === 'venue' ? <Picker range={venues} rangeKey="name" onChange={event => setVenueId(venues[Number(event.detail.value)]?.id || '')}><View className="zg-field"><Text>场馆</Text><Text>{venues.find(venue => venue.id === venueId)?.name || '请选择'}</Text></View></Picker> : <View><Picker range={areas} onChange={event => setCustomDistrict(areas[Number(event.detail.value)] || '')}><View className="zg-field"><Text>区域</Text><Text>{customDistrict || '请选择'}</Text></View></Picker><Input value={customAddress} maxlength={300} placeholder="详细训练地点" onInput={event => setCustomAddress(event.detail.value)} /></View>}
        <Textarea maxlength={500} onInput={event => setNote(event.detail.value)} placeholder="说明调整原因" value={note} /><View className="zg-primary-button" onClick={() => void submitProposal()}><Text>{busy ? '提交中' : '发送方案'}</Text></View><View className="zg-outline-button" onClick={() => setProposal(false)}><Text>取消编辑</Text></View>
      </View> : booking.status === 'pending_coach' ? <View className="zg-request-decision"><View className="zg-outline-button" onClick={() => void decide('rejected')}><Text>拒绝</Text></View><View className="zg-outline-button" onClick={() => setProposal(true)}><Text>提出方案</Text></View><View className="zg-primary-button" onClick={() => void decide('confirmed')}><Text>确认预约</Text></View></View> : null}
      {booking.status === 'confirmed' ? <View className="zg-form-section"><View className="zg-primary-button" onClick={() => void decide('completed')}><Text>完成课程</Text></View><View className="zg-outline-button" onClick={() => void decide('cancelled_by_coach')}><Text>取消课程</Text></View></View> : null}
      {['confirmed', 'completed'].includes(booking.status) && booking.paymentStatus === 'offline_unpaid' ? <View className="zg-outline-button" onClick={async () => { const result = await Taro.showModal({ title: '标记线下已收款', content: '仅在实际收到款项后确认，不会发起在线扣款。' }); if (result.confirm) void perform(() => markOfflinePaid(id), '收款状态已更新'); }}><Text>标记线下已收款</Text></View> : null}
      {booking.status === 'completed' ? <View className="zg-form-section"><Text className="zg-detail-heading">训练总结</Text><Textarea value={summary} maxlength={6000} onInput={event => setSummary(event.detail.value)} placeholder="记录训练内容与后续建议" /><View className="zg-primary-button" onClick={() => summary.trim() ? void perform(() => publishTrainingRecord(id, summary.trim()), '训练总结已发布') : setError('请填写训练总结')}><Text>{busy ? '提交中' : '发布训练总结'}</Text></View></View> : null}
      <View className="zg-outline-button" onClick={() => Taro.navigateTo({ url: '/pages/support/index?role=coach&booking=' + encodeURIComponent(id) })}><Text>关联预约工单</Text></View>
    </View> : loading ? <View className="zg-form-section"><DelayedSkeleton /></View> : !error ? <View className="zg-empty"><Text>预约不存在或当前账号无权查看</Text></View> : null}
  </View>;
}
