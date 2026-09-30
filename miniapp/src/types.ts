export type AccountMode = "student" | "coach";
export type StudentTab = "home" | "discover" | "bookings" | "messages" | "profile";
export type CoachTab = "workspace" | "requests" | "schedule" | "messages" | "profile";

export type CoachProfile = {
  id: number;
  name: string;
  sport: string;
  sports?: string[];
  title: string;
  city: string;
  serviceCities?: string[];
  serviceAreas?: Array<{ cityId: "beijing" | "changchun"; cityName: string; district: string }>;
  district?: string;
  avatarUrl?: string;
  cardUrl?: string;
  heroUrl?: string;
  verificationLabel?: string;
  goals: string[];
  strengths: string[];
  credentials?: string[];
  audience: string[];
  bookingEnabled?: boolean;
  bookable?: boolean;
  canConsult?: boolean;
  unavailableReason?: string;
  price?: number;
  trialPrice?: number;
};

export type Booking = {
  serviceCityId?: 'beijing' | 'changchun';
  startsAt?: number;
  endsAt?: number;
  paymentStatus?: 'offline_unpaid' | 'offline_paid' | 'online_paid';
  durationMinutes?: number;
  learnerName?: string;
  id: string;
  coachId: number;
  coachName?: string;
  dateLabel: string;
  time: string;
  endTime: string;
  status: "pending_coach" | "confirmed" | "reschedule_requested" | "completed" | "rejected" | "expired" | "cancelled_by_student" | "cancelled_by_coach";
  venueName?: string;
  feeFen: number;
  note?: string;
  locationType?: "venue" | "custom";
  customDistrict?: string;
  customAddress?: string;
  review?: ReviewEligibility;
};

export type ReviewEligibility = {
  canResubmit: boolean;
  canSubmit: boolean;
  eligibleUntil?: number;
  rejectionReason?: string;
  reviewId?: string;
  status: "not_eligible" | "available" | "pending" | "approved" | "rejected" | "expired";
};

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
  tags: string[];
  coachReply?: { body: string; createdAt: number };
};

export type PublicCoachReviews = {
  items: PublicCoachReview[];
  nextCursor: string | null;
  summary: {
    averageRating: number | null;
    ratingDistribution: Record<"1" | "2" | "3" | "4" | "5", number>;
    tagCounts: Array<{ count: number; tag: string }>;
    total: number;
  };
};

export type Message = {
  id: string;
  conversationId: string;
  sender: "coach" | "student" | "system" | "venue";
  body: string;
  createdAt: string;
  read: boolean;
  deliveryStatus?: "pending" | "sent" | "failed";
};

export type Conversation = {
  id: string;
  coachId?: number;
  title: string;
  subtitle: string;
  unreadCount: number;
  updatedAt: string;
  messages: Message[];
};

export type AccountProfile = {
  nickname: string;
  avatarUrl?: string;
  district: string;
  serviceArea?: string;
  serviceCityId?: "beijing" | "changchun";
  completed: boolean;
  bio?: string;
};

export type Session = {
  userId?: string;
  coachOnboarding?: import("../../shared/coach-application").CoachOnboardingSummary;
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
  availableModes: AccountMode[];
  coach?: { id: number; name: string; sport: string; title: string; auditStatus: "approved" | "suspended" };
  profile?: AccountProfile;
  authMethod?: "phone_otp" | "email_otp" | "wechat";
};

export type WechatExchange =
  | { status: "authenticated"; session: Session }
  | { status: "link_required"; linkToken: string; expiresAt: number; methods: { email: true; phone: false } };

export type Bootstrap = {
  accountIdentity?: Pick<Session, "userId" | "availableModes" | "coach" | "coachOnboarding" | "profile">;
  coaches: CoachProfile[];
  bookings: Booking[];
  conversations: Conversation[];
  favoriteCoachIds: number[];
  learnerProfiles: LearnerProfile[];
  profile?: AccountProfile;
  accountProfile?: AccountProfile;
  catalog?: {
    city: "北京" | "长春" | string;
    cityId?: "beijing" | "changchun";
    cities?: Array<{ id: "beijing" | "changchun"; name: string; province: string }>;
    sports: Array<{ id: string; name: string; coachCount?: number; available?: boolean }>;
    regions: Array<{ id: string; name: string }>;
    serviceAreas?: Array<{ id: string; name: string }>;
  };
};

export type LearnerProfile = {
  id: string;
  name: string;
  relation: "self" | "child";
  gender?: "male" | "female" | "unspecified";
  age?: number;
  sport: string;
  level: string;
  goal: string;
};

export type BookingOptions = {
  coachId: number;
  cityId?: "beijing" | "changchun";
  cityName?: string;
  durationMinutes: [60, 90, 120];
  earliestStartsAt: number;
  latestStartsAt: number;
  regularBasePriceFen: number;
  trialBasePriceFen: number;
  trialEligible?: boolean | null;
  venues: Array<{ id: string; name: string; city?: string; district: string; address: string }>;
};

export type CoachApplication = {
  audiences?: string[];
  goals?: string[];
  strengths?: string[];
  honors?: string[];
  credentials?: string[];
  id: string;
  status: "draft" | "pending" | "approved" | "rejected" | "withdrawn";
  real_name: string;
  title: string;
  bio: string;
  experience_years: number;
  price_fen: number;
  trial_price_fen: number;
  review_note?: string;
  avatar_temp_key?: string;
  hero_temp_key?: string;
  credentialTempKeys?: string[];
  sports: Array<{ id: string; name: string; primary: number }>;
  areas: Array<{ id: string; cityId: "beijing" | "changchun"; name: string; primary: number }>;
  venues: Array<{ id: string; areaId: string; name: string; address: string }>;
};

export type CoachOverview = {
  coach: CoachProfile;
  bookings: Booking[];
  conversations: Conversation[];
  venues: Array<{ id: string; name: string; city?: string; district: string; address: string }>;
};

export type RescheduleProposal = {
  id: string;
  booking_id: string;
  status: "pending" | "accepted" | "rejected";
  note?: string;
  starts_at?: number;
  ends_at?: number;
  venue_name?: string;
  venue_address?: string;
  custom_district?: string;
  custom_address?: string;
  created_at?: number;
};
