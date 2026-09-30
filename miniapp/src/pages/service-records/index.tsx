import Taro, { useDidHide, useDidShow, useRouter } from '@tarojs/taro';
import { Text, View } from '@tarojs/components';
import { useCallback, useRef, useState } from 'react';
import { LatestRead } from '../../../../shared/product-flow';
import { DelayedSkeleton } from '../../components/delayed-skeleton';
import { listTrainingRecords } from '../../services/api';
import '../detail.scss';
export default function ServiceRecordsPage() {
  const bookingId = String(useRouter().params.booking || '');
  const reads = useRef(new LatestRead());
  const [records, setRecords] = useState<Awaited<ReturnType<typeof listTrainingRecords>>>([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const load = useCallback(async () => {
    const ticket = reads.current.begin();
    try { const next = await listTrainingRecords(); if (reads.current.isCurrent(ticket)) { setRecords(next); setError(''); } }
    catch (reason) { if (reads.current.isCurrent(ticket)) setError(reason instanceof Error ? reason.message : '训练记录读取失败'); }
    finally { if (reads.current.isCurrent(ticket)) setLoading(false); }
  }, []);
  useDidShow(() => { void load(); });
  useDidHide(() => reads.current.cancel());
  const shown = bookingId ? records.filter(item => item.booking_id === bookingId) : records;
  return <View className="zg-profile-edit"><View className="zg-detail-nav"><View onClick={() => Taro.navigateBack()}><Text>返回</Text></View><Text>训练记录</Text><View /></View>
    {error ? <View className="zg-inline-error"><Text>{error}</Text><View onClick={() => void load()}><Text>重试</Text></View></View> : null}
    {shown.map(item => <View className="zg-form-section" key={item.id}><Text className="zg-detail-heading">训练总结</Text><Text>{item.summary}</Text><Text className="zg-helper">预约 #{item.booking_id.slice(-8)}</Text></View>)}
    {!shown.length && !error ? loading ? <View className="zg-form-section"><DelayedSkeleton /></View> : <View className="zg-empty"><Text>暂无已发布训练记录</Text></View> : null}
  </View>;
}
