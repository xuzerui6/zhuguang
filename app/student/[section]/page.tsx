import { notFound } from "next/navigation";
import { StudentPage, type StudentSection } from "../../_components/student-pages";

const sections = new Set<StudentSection>(["coaches", "bookings", "messages", "training", "profile"]);

export default async function StudentSectionPage({ params, searchParams }: { params: Promise<{ section: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { section } = await params;
  if (!sections.has(section as StudentSection)) notFound();
  const query = await searchParams;
  const coachId = typeof query.coach === "string" ? Number(query.coach) : undefined;
  const slotId = typeof query.slot === "string" ? query.slot : undefined;
  return <StudentPage initialCoachId={Number.isFinite(coachId) ? coachId : undefined} initialSlotId={slotId} section={section as StudentSection} />;
}
