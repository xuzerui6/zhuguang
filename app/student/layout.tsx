import type { Metadata } from "next";
import { AccessDenied } from "../_components/access-denied";
import { WorkspaceShell } from "../_components/workspace-shell";
import { canAccessArea, getWebSession } from "../_lib/web-session";

export const metadata: Metadata = {
  description: "逐光学员服务：找教练、预约、消息与训练档案。",
  title: "学员服务 | 逐光",
};

export const dynamic = "force-dynamic";

export default async function StudentLayout({ children }: { children: React.ReactNode }) {
  const session = await getWebSession();
  if (!canAccessArea(session, "student")) return <AccessDenied area="student" authenticated={session.isAuthenticated} recoverable={session.serviceStatus === "token_invalid"} unavailable={session.serviceStatus === "upstream_unavailable"} />;
  return <WorkspaceShell area="student" session={session}>{children}</WorkspaceShell>;
}
