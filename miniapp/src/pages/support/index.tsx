import Taro, { useDidHide, useDidShow, useRouter } from '@tarojs/taro';
import { Input, Picker, Text, Textarea, View } from '@tarojs/components';
import { useCallback, useRef, useState } from 'react';
import { createSupportTicket, listSupportTickets } from '../../services/api';
import { LatestRead } from '../../../../shared/product-flow';
import '../detail.scss';
const categories = [{ name: '服务体验', id: 'service' }, { name: '预约安排', id: 'booking' }, { name: '线下支付', id: 'payment' }, { name: '安全问题', id: 'safety' }, { name: '隐私问题', id: 'privacy' }, { name: '其他', id: 'other' }];
export default function SupportPage() {
  const router = useRouter();
  const role = router.params.role === 'coach' ? 'coach' : 'student';
  const [tickets, setTickets] = useState<Awaited<ReturnType<typeof listSupportTickets>>>([]);
  const [subject, setSubject] = useState(''); const [body, setBody] = useState('');
  const [category, setCategory] = useState(0); const [error, setError] = useState(''); const [busy, setBusy] = useState(false);
  const lock = useRef(false);
  const reads = useRef(new LatestRead());
  const load = useCallback(async () => {
    const ticket = reads.current.begin();
    try { const next = await listSupportTickets(role); if (reads.current.isCurrent(ticket)) { setTickets(next); setError(''); } }
    catch (reason) { if (reads.current.isCurrent(ticket)) setError(reason instanceof Error ? reason.message : '工单读取失败'); }
  }, [role]);
  useDidShow(() => { void load(); });
  useDidHide(() => reads.current.cancel());
  const submit = async () => {
    if (lock.current) return;
    if (subject.trim().length < 2 || body.trim().length < 2) { setError('请填写问题主题和详细说明'); return; }
    lock.current = true; setBusy(true);
    try { await createSupportTicket(role, { bookingId: router.params.booking || undefined, subject: subject.trim(), body: body.trim(), category: categories[category].id }); setSubject(''); setBody(''); await load(); Taro.showToast({ title: '工单已创建', icon: 'success' }); }
    catch (reason) { setError(reason instanceof Error ? reason.message : '提交失败，内容已保留'); }
    finally { lock.current = false; setBusy(false); }
  };
  const labels: Record<string, string> = { open: '处理中', in_progress: '处理中', waiting_user: '等待回复', resolved: '已解决', closed: '已关闭' };
  return <View className="zg-profile-edit"><View className="zg-detail-nav"><View onClick={() => Taro.navigateBack()}><Text>返回</Text></View><Text>站内工单</Text><View /></View>
    {error ? <View className="zg-inline-error"><Text>{error}</Text><View onClick={() => void load()}><Text>重新读取</Text></View></View> : null}
    <View className="zg-form-section"><Text className="zg-detail-heading">提交问题</Text><Input maxlength={120} placeholder="问题主题" value={subject} onInput={event => setSubject(event.detail.value)} /><Picker range={categories} rangeKey="name" value={category} onChange={event => setCategory(Number(event.detail.value))}><View className="zg-field"><Text>问题类型</Text><Text>{categories[category].name}</Text></View></Picker><Textarea maxlength={3000} placeholder="说明遇到的问题，不填写验证码或无关身份证信息" value={body} onInput={event => setBody(event.detail.value)} /><View className="zg-primary-button" onClick={() => void submit()}><Text>{busy ? '提交中' : '创建工单'}</Text></View></View>
    {tickets.map(item => <View className="zg-form-section" key={item.id}><Text className="zg-detail-heading">{item.subject}</Text><Text>{labels[item.status] || '处理中'}</Text><Text>{item.latest_message || '暂无回复'}</Text></View>)}
  </View>;
}
