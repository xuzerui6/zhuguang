import { notFound } from "next/navigation";
import { CoachPage, type CoachSection } from "../../_components/coach-pages";

const sections = new Set<CoachSection>(["bookings", "schedule", "messages", "courses", "payments", "credentials"]);

export default async function CoachSectionPage({ params }: { params: Promise<{ section: string }> }) {
  const { section } = await params;
  if (!sections.has(section as CoachSection)) notFound();
  return <CoachPage section={section as CoachSection} />;
}

