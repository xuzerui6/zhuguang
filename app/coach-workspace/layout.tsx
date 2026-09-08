import type { Metadata } from "next";
import { AccessDenied } from "../_components/access-denied";
import { WorkspaceShell } from "../_components/workspace-shell";
import { canAccessArea, getWebSession } from "../_lib/web-session";

export const metadata: Metadata = {
  description: "逐光认证教练工作台。",
  title: "教练工作台 | 逐光",
};

export const dynamic = "force-dynamic";

export default async function CoachWorkspaceLayout({ children }: { children: React.ReactNode }) {
  const session = await getWebSession();
  if (!canAccessArea(session, "coach")) return <AccessDenied area="coach" authenticated={session.isAuthenticated} recoverable={session.serviceStatus === "token_invalid"} unavailable={session.serviceStatus === "upstream_unavailable"} />;
  return <WorkspaceShell area="coach" session={session}>{children}</WorkspaceShell>;
}
