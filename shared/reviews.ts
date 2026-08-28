export const REVIEW_TAGS = [
  "专业可靠",
  "讲解清晰",
  "耐心负责",
  "计划有针对性",
  "沟通顺畅",
  "准时守约",
] as const;

export type ReviewTag = typeof REVIEW_TAGS[number];

export type PublicCoachReview = {
  body: string;
  completedMonth: string;
  createdAt: number;
  durationMinutes: number;
  helpfulCount: number;
  id: string;
  rating: number;
  reviewerLabel: "平台履约学员";
  sport: string;
  tags: ReviewTag[];
  coachReply?: { body: string; createdAt: number };
};

export type CoachReviewSummary = {
  averageRating: number | null;
  ratingDistribution: Record<"1" | "2" | "3" | "4" | "5", number>;
  tagCounts: Array<{ count: number; tag: ReviewTag }>;
  total: number;
};

export type PublicCoachReviews = {
  items: PublicCoachReview[];
  nextCursor: string | null;
  summary: CoachReviewSummary;
};
