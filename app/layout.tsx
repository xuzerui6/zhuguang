import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL("https://zhuguang-coach-platform.xuzerui6.chatgpt.site"),
  title: "逐光教练平台",
  description: "覆盖网页介绍、学员端、教练端和运营端的退役运动员教练服务平台。",
  openGraph: {
    title: "逐光教练平台",
    description: "教练核验、学员匹配、教练入驻、试课跟进与运营看板一体化平台。",
    images: ["/og.png"],
  },
  twitter: {
    card: "summary_large_image",
    title: "逐光教练平台",
    description: "退役运动员教练服务平台。",
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
