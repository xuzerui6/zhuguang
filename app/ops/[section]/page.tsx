import { notFound } from "next/navigation";
import { OpsPage, type OpsSection } from "../../_components/ops-pages";

const sections = new Set<OpsSection>(["matching", "coaches", "profile-reviews", "bookings", "catalog", "users", "reviews", "support", "content", "audit", "transactions", "releases"]);

export default async function OpsSectionPage({ params }: { params: Promise<{ section: string }> }) {
  const { section } = await params;
  if (!sections.has(section as OpsSection)) notFound();
  return <OpsPage section={section as OpsSection} />;
}
