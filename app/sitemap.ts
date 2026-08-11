import type { MetadataRoute } from "next";
import { coaches } from "./_lib/web-platform";

const origin = "https://beijingzhuguang.top";

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();
  return [
    { url: origin, lastModified: now, changeFrequency: "weekly", priority: 1 },
    { url: `${origin}/coaches`, lastModified: now, changeFrequency: "daily", priority: 0.9 },
    ...coaches.map((coach) => ({ url: `${origin}/coaches/${coach.id}`, lastModified: now, changeFrequency: "weekly" as const, priority: 0.8 })),
    { url: `${origin}/service-guarantee`, lastModified: now, changeFrequency: "monthly", priority: 0.6 },
    { url: `${origin}/coach-partnership`, lastModified: now, changeFrequency: "monthly", priority: 0.5 },
  ];
}
