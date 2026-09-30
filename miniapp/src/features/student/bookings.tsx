import Taro from "@tarojs/taro";
import { Text, View } from "@tarojs/components";
import { useState } from "react";
import { EmptyState } from "../../components/empty-state";
import type { Booking, RescheduleProposal } from "../../types";
import { cancelBooking, respondRescheduleProposal } from "../../services/api";
import { BOOKING_LABELS } from '../../../../shared/booking-rules';

const labels = BOOKING_LABELS;

function proposalTime(value?: number) {
  if (!value) return "时间待确认";
  return new Date(value).toLocaleString("zh-CN", {
    day: "2-digit",
    hour: "2-digit",
    hour12: false,
    minute: "2-digit",
    month: "2-digit",
    timeZone: "Asia/Shanghai",
  });
}

export function StudentBookings({
  bookings,
  proposals,
  onChanged,
  onDiscover,
}: {
  bookings: Booking[];
  proposals: RescheduleProposal[];
  onChanged: () => void;
  onDiscover: () => void;
}) {
  const [busy, setBusy] = useState("");

  const cancel = async (booking: Booking) => {
    const result = await Taro.showModal({ title: "取消预约申请", content: "取消后本次申请将结束，是否继续？", confirmText: "确认取消" });
    if (!result.confirm) return;
    setBusy(booking.id);
    try {
      await cancelBooking(booking.id);
      Taro.showToast({ title: "已取消", icon: "success" });
      onChanged();
    } catch (error) {
      Taro.showToast({ title: error instanceof Error ? error.message : "取消失败", icon: "none" });
    } finally {
      setBusy("");
    }
  };

  const respond = async (proposal: RescheduleProposal, decision: "accepted" | "rejected") => {
    const result = await Taro.showModal({
      title: decision === "accepted" ? "确认接受新方案" : "拒绝新方案",
      content: decision === "accepted" ? "接受后预约将按新时间和地点确认。" : "拒绝后将恢复到教练提出方案前的状态。",
      confirmText: decision === "accepted" ? "接受方案" : "确认拒绝",
    });
    if (!result.confirm) return;
    setBusy(proposal.id);
    try {
      await respondRescheduleProposal(proposal.id, decision);
      Taro.showToast({ title: decision === "accepted" ? "预约已确认" : "已拒绝方案", icon: "success" });
      onChanged();
    } catch (error) {
      Taro.showToast({ title: error instanceof Error ? error.message : "处理失败，请重试", icon: "none" });
    } finally {
      setBusy("");
    }
  };

  return (
    <View className="zg-page-content zg-subpage">
      <View className="zg-page-title"><Text>我的预约</Text><Text>申请、协商和课程状态都以服务端记录为准</Text></View>
      {bookings.length
        ? <View className="zg-list-surface">
            {bookings.map((booking) => {
              const proposal = booking.status === "reschedule_requested" ? proposals.find((item) => item.booking_id === booking.id && item.status === "pending") : undefined;
              return (
                <View className="zg-booking-row" key={booking.id}>
                  <View>
                    <Text className="zg-booking-title">{booking.coachName || "教练服务"}</Text>
                    <Text>{booking.dateLabel} {booking.time}–{booking.endTime}</Text>
                    <Text>{booking.customAddress || booking.venueName || "地点待双方确认"}</Text>
                    {proposal
                      ? <View className="zg-proposal-panel">
                          <Text>教练提出：{proposalTime(proposal.starts_at)}–{proposalTime(proposal.ends_at)}</Text>
                          <Text>{proposal.custom_address || proposal.venue_name || "地点待确认"}</Text>
                          {proposal.note ? <Text>{proposal.note}</Text> : null}
                          <View className="zg-proposal-actions">
                            <View className="zg-outline-button" onClick={() => !busy && void respond(proposal, "rejected")}><Text>拒绝</Text></View>
                            <View className="zg-primary-button" onClick={() => !busy && void respond(proposal, "accepted")}><Text>{busy === proposal.id ? "处理中" : "接受方案"}</Text></View>
                          </View>
                        </View>
                      : null}
                    {booking.status === "pending_coach" && !proposal
                      ? <Text className="zg-booking-action" onClick={() => !busy && void cancel(booking)}>{busy === booking.id ? "正在取消" : "取消申请"}</Text>
                      : null}
                    {booking.review?.canSubmit || booking.review?.canResubmit
                      ? <Text className="zg-booking-action" onClick={() => Taro.navigateTo({ url: `/pages/review/index?booking=${encodeURIComponent(booking.id)}&coach=${encodeURIComponent(booking.coachName || "教练")}${booking.review?.canResubmit && booking.review.reviewId ? `&review=${encodeURIComponent(booking.review.reviewId)}` : ""}` })}>{booking.review.canResubmit ? "根据审核意见重新评价" : "评价教练"}</Text>
                      : null}
                    <Text className="zg-booking-action" onClick={() => Taro.navigateTo({ url: '/pages/support/index?booking=' + encodeURIComponent(booking.id) })}>预约工单</Text>{booking.status === 'completed' ? <Text className="zg-booking-action" onClick={() => Taro.navigateTo({ url: '/pages/service-records/index?booking=' + encodeURIComponent(booking.id) })}>训练记录</Text> : null}{booking.review?.status === "pending" ? <Text className="zg-review-state">评价审核中</Text> : null}
                    {booking.review?.status === "approved" ? <Text className="zg-review-state">评价已公开</Text> : null}
                    {booking.review?.status === "rejected" && !booking.review.canResubmit ? <Text className="zg-review-state">评价未通过审核</Text> : null}
                    {booking.review?.rejectionReason ? <Text className="zg-review-reason">审核意见：{booking.review.rejectionReason}</Text> : null}
                  </View>
                  <Text className={`zg-status is-${booking.status}`}>{labels[booking.status]}</Text>
                </View>
              );
            })}
          </View>
        : <EmptyState action="选择教练" description="选择教练并指定时间与地点，提交后等待教练确认。" onAction={onDiscover} title="还没有预约申请" />}
    </View>
  );
}
