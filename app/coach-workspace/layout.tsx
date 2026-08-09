import type { Metadata } from "next";
import { AccessDenied } from "../_components/access-denied";
import { WorkspaceShell } from "../_components/workspace-shell";
import { canAccessArea, getWebSession } from "../_lib/web-session";

export const metadata: Metadata = {
  description: "逐光认证教练私有工作台。",
  title: "教练工作台 | 逐光",
};

export default async function CoachWorkspaceLayout({ children }: { children: React.ReactNode }) {
  const session = await getWebSession();
  if (!canAccessArea(session, "coach")) return <AccessDenied area="coach" />;
  return <WorkspaceShell area="coach" session={session}>{children}</WorkspaceShell>;
}
