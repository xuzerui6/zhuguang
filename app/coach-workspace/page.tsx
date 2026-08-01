import { getChatGPTUser } from "../chatgpt-auth";
import CoachWorkspaceClient from "./workspace-client";

export const metadata = {
  description: "逐光北京试点教练私有工作台",
  title: "教练工作台 | 逐光",
};

export default async function CoachWorkspacePage() {
  const user = await getChatGPTUser();
  return <CoachWorkspaceClient signedInEmail={user?.email ?? null} />;
}

