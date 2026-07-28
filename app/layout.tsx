import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "逐光教练平台",
  description: "面向退役运动员教练与学员的专业训练服务工作台。",
  openGraph: {
    title: "逐光教练平台",
    description: "教练库、履历审核、试课跟进与运营看板一体化服务平台。",
    images: ["/og.png"],
  },
  twitter: {
    card: "summary_large_image",
    title: "逐光教练平台",
    description: "专业体育教练服务平台。",
    images: ["/og.png"],
  },
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  );
}
