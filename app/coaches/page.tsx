import type { Metadata } from "next";
import { CoachDirectory } from "../_components/coach-directory";
import { PublicFooter } from "../_components/public-footer";
import { PublicHeader } from "../_components/public-header";
import { loadPublicCoaches } from "../_lib/web-platform";

export const metadata: Metadata = {
  description: "按运动项目、北京区域与训练目标比较逐光试点教练。",
  title: "找教练 | 逐光",
};

export default async function CoachesPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const params = await searchParams;
  const coaches = await loadPublicCoaches();
  const get = (key: string, fallback: string) => typeof params[key] === "string" ? params[key] : fallback;
  return (
    <>
      <PublicHeader />
      <CoachDirectory initialCoaches={coaches} initialDistrict={get("district", "全部区域")} initialGoal={get("goal", "全部目标")} initialSport={get("sport", "全部项目")} />
      <PublicFooter />
    </>
  );
}
