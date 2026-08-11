import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL("https://beijingzhuguang.top"),
  applicationName: "逐光运动教练服务平台",
  title: "逐光 | 运动教练服务平台",
  description: "连接经过资料核验的退役运动员教练与学员家庭，提供透明、可预约、可持续的训练服务。",
  alternates: { canonical: "/" },
  manifest: "/manifest.webmanifest",
  openGraph: {
    title: "逐光 | 运动教练服务平台",
    description: "找经过资料核验的专业运动教练，比较经历、场馆、价格和可约时间。",
    images: ["/og.png"],
    siteName: "逐光运动教练服务平台",
    type: "website",
    url: "/",
  },
  twitter: {
    card: "summary_large_image",
    title: "逐光 | 运动教练服务平台",
    description: "透明比较专业教练，提交试课预约，持续记录训练。",
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
    title: "逐光",
  },
};

export const viewport: Viewport = {
  themeColor: "#ffffff",
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
