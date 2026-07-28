import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL("https://zhuguang-coach-platform.xuzerui6.chatgpt.site"),
  title: "逐光 Coach OS",
  description: "面向退役运动员教练与学员的全平台服务系统，覆盖浏览器介绍、PC 工作台、手机端、教练端和运营端。",
  openGraph: {
    title: "逐光 Coach OS",
    description: "教练核验、学员匹配、试课排期、教练经营与运营审核一体化平台。",
    images: ["/og.png"],
  },
  twitter: {
    card: "summary_large_image",
    title: "逐光 Coach OS",
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
