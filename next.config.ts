import type { NextConfig } from "next";
import { webSecurityHeaders } from "./app/_lib/web-security";

const nextConfig: NextConfig = {
  async headers() {
    return [{
      headers: [
        ...webSecurityHeaders,
      ],
      source: "/:path*",
    }];
  },
  images: {
    // Site imagery is already exported as optimized WebP/AVIF assets. Serving it
    // directly also keeps local preview independent of Cloudflare Images.
    unoptimized: true,
  },
};

export default nextConfig;
