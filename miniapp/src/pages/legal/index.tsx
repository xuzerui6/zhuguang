import { DelayedSkeleton } from '../../components/delayed-skeleton';
import Taro, { useRouter } from '@tarojs/taro';
import { Text, View } from '@tarojs/components';
import { useEffect, useState } from 'react';
import { legalDocuments } from '../../services/api';
import type { LegalDocument } from '../../../../shared/legal-documents';
import '../detail.scss';

export default function LegalPage() {
  const router = useRouter();
  const [slug, setSlug] = useState(router.params.slug === 'privacy' || router.params.document === 'privacy' ? 'privacy' : 'terms');
  const [documents, setDocuments] = useState<LegalDocument[]>([]);
  const [error, setError] = useState('');
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    let active = true;
    void legalDocuments().then(value => { if (active) { setDocuments(value as LegalDocument[]); setError(''); } })
      .catch(reason => { if (active) setError(reason instanceof Error ? reason.message : '协议读取失败'); });
    return () => { active = false; };
  }, [retry]);
  const document = documents.find(item => item.slug === slug);
  return <View className="zg-profile-edit"><View className="zg-detail-nav"><View onClick={() => Taro.navigateBack()}><Text>返回</Text></View><Text>协议与隐私</Text><View /></View>
    <View className="zg-segments is-two">{['terms', 'privacy'].map(item => <View className={slug === item ? 'is-active' : ''} key={item} onClick={() => setSlug(item)}><Text>{item === 'terms' ? '服务协议' : '隐私政策'}</Text></View>)}</View>
    {error ? <View className="zg-inline-error"><Text>{error}</Text><View onClick={() => setRetry(value => value + 1)}><Text>重新读取</Text></View></View> : null}
    {document ? <View className="zg-form-section"><Text className="zg-detail-heading">{document.title}</Text><Text className="zg-helper">版本 {document.version}</Text><Text className="zg-legal-body" selectable>{document.body}</Text></View> : !error ? <View className="zg-form-section"><DelayedSkeleton /></View> : null}
  </View>;
}
