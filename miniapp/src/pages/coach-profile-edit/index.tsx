import Taro from "@tarojs/taro";
import { Picker, Text, Textarea, View } from "@tarojs/components";
import { useEffect, useState } from "react";
import { createCoachProfileChange, listCoachProfileChanges } from "../../services/api";
import "../detail.scss";

const fields = [
  { key: "title", label: "教练头衔", list: false },
  { key: "bio", label: "个人简介", list: false },
  { key: "strengths", label: "擅长方向", list: true },
  { key: "audience", label: "服务对象", list: true },
  { key: "goals", label: "训练目标", list: true },
  { key: "motto", label: "个人格言", list: false },
] as const;

export default function CoachProfileEditPage() {
  const [fieldIndex, setFieldIndex] = useState(0);
  const [value, setValue] = useState("");
  const [busy, setBusy] = useState(false);
  const [history, setHistory] = useState<Array<{ id: string; field: string; status: string; review_note?: string }>>([]);
  const field = fields[fieldIndex];
  const load = () => void listCoachProfileChanges().then(setHistory).catch(() => undefined);
  useEffect(load, []);
  const submit = async () => {
    if (!value.trim()) { Taro.showToast({ title: "请填写变更内容", icon: "none" }); return; }
    setBusy(true);
    try {
      const nextValue = field.list ? value.split(/[、,，]/u).map((item) => item.trim()).filter(Boolean).slice(0, 20) : value.trim();
      await createCoachProfileChange(field.key, nextValue);
      setValue(""); load();
      Taro.showToast({ title: "已提交运营审核", icon: "success" });
    } catch (error) { Taro.showToast({ title: error instanceof Error ? error.message : "提交失败", icon: "none" }); }
    finally { setBusy(false); }
  };
  return <View className="zg-profile-edit"><View className="zg-detail-nav"><View onClick={() => Taro.navigateBack()}><Text>返回</Text></View><Text>教练资料变更</Text><View /></View><View className="zg-form-section"><Text className="zg-helper">公开档案在运营审核通过前保持原内容。同一字段有待审核申请时不能重复提交。</Text><Picker range={fields.map((item) => item.label)} value={fieldIndex} onChange={(event) => { setFieldIndex(Number(event.detail.value)); setValue(""); }}><View className="zg-field"><Text>变更项目</Text><Text>{field.label}</Text></View></Picker><Textarea maxlength={field.list ? 300 : 2000} onInput={(event) => setValue(event.detail.value)} placeholder={field.list ? "使用逗号分隔多个项目" : `填写新的${field.label}`} value={value} /><View className="zg-primary-button" onClick={() => !busy && void submit()}><Text>{busy ? "提交中" : "提交审核"}</Text></View></View><View className="zg-page-content"><View className="zg-section-heading"><Text>申请记录</Text></View>{history.length ? <View className="zg-list-surface">{history.map((item) => <View className="zg-change-row" key={item.id}><View><Text>{fields.find((option) => option.key === item.field)?.label || item.field}</Text><Text>{item.review_note || "线上资料保持不变"}</Text></View><Text className={`zg-status is-${item.status}`}>{item.status === "pending" ? "待审核" : item.status === "approved" ? "已通过" : item.status === "rejected" ? "已拒绝" : "已撤回"}</Text></View>)}</View> : <View className="zg-muted-note"><Text>暂无资料变更申请</Text></View>}</View></View>;
}
