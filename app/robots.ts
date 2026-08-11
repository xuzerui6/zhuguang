import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      allow: ["/", "/coaches/", "/service-guarantee", "/coach-partnership"],
      disallow: ["/api/", "/student/", "/coach-workspace/", "/ops/"],
      userAgent: "*",
    },
    sitemap: "https://beijingzhuguang.top/sitemap.xml",
  };
}
