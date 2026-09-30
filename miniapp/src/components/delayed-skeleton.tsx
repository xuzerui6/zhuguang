import { View } from '@tarojs/components';
import { useEffect, useState } from 'react';

export function DelayedSkeleton() {
  const [visible, setVisible] = useState(false);
  useEffect(() => { const timer = setTimeout(() => setVisible(true), 150); return () => clearTimeout(timer); }, []);
  return <View className="zg-delayed-skeleton" ariaLabel="正在读取内容">{visible ? <><View className="zg-skeleton-line is-wide" /><View className="zg-skeleton-line" /></> : null}</View>;
}
