import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    // Site imagery is already exported as optimized WebP/AVIF assets. Serving it
    // directly also keeps local preview independent of Cloudflare Images.
    unoptimized: true,
  },
};

export default nextConfig;
