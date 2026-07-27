import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "逐光教练平台",
  description: "连接退役运动员教练与学员的专业体育训练撮合平台。",
  openGraph: {
    title: "逐光教练平台",
    description: "让优秀退役运动员教练被看见，让学员找到可信赖的专项训练。",
    images: ["/og.png"],
  },
  twitter: {
    card: "summary_large_image",
    title: "逐光教练平台",
    description: "退役运动员教练入驻、学员匹配、创业方案一体化原型。",
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
