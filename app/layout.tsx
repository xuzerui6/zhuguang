import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL("https://zhuguang-coach-platform.xuzerui6.chatgpt.site"),
  applicationName: "逐光 Coach OS",
  title: "逐光 Coach OS",
  description: "连接退役运动员教练与学员家庭的全平台服务系统，覆盖公开官网、智能匹配、教练入驻、PC 工作台、手机端和原生应用。",
  manifest: "/manifest.webmanifest",
  openGraph: {
    title: "逐光 Coach OS",
    description: "让专业运动员，成为每个学员的长期教练。教练核验、学员匹配、试课排期、教练经营与运营审核一体化平台。",
    images: ["/og.png"],
  },
  twitter: {
    card: "summary_large_image",
    title: "逐光 Coach OS",
    description: "退役运动员教练与学员家庭的一体化服务平台。",
    images: ["/og.png"],
  },
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
    apple: "/app-icon-192.png",
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "逐光 Coach OS",
  },
};

export const viewport: Viewport = {
  themeColor: "#07120e",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
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
