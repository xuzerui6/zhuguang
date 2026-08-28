export type MobileTab = "home" | "discover" | "bookings" | "messages" | "profile";

export type PullRefreshState = "idle" | "pulling" | "armed" | "refreshing" | "success" | "error";

export type PullRefreshResult = {
  status: "success" | "error";
  message?: string;
  updatedAt?: number;
};

export type MobileView = MobileTab | "coach" | "booking" | "conversation";

export type AccountMode = "student" | "coach";

export type CoachTab = "workspace" | "appointments" | "schedule" | "messages" | "profile";

export type CoachAccountSummary = {
  id: number;
  name: string;
  sport: string;
  title: string;
  auditStatus: "approved" | "suspended";
  pendingBookingCount: number;
};

export type BookingStatus =
  | "pending_coach"
  | "confirmed"
  | "reschedule_requested"
  | "completed"
  | "rejected"
  | "expired"
  | "cancelled_by_student"
  | "cancelled_by_coach";

export type MobileCoach = {
  id: number;
  name: string;
  sport: string;
  city: string;
  level: string;
  title: string;
  price?: number;
  trialPrice?: number;
  rating: number;
  lessons: number;
  reviewCount: number;
  reviewSummary?: {
    averageRating: number | null;
    topTags: Array<{ count: number; tag: string }>;
  };
  fit?: number;
  audience: string[];
  goals: string[];
  honors?: string[];
  strengths: string[];
  credentials?: string[];
  proof: string[];
  availability: string[];
  note: string;
  motto?: string;
  accent: string;
  district?: string;
  venue?: string;
  distanceKm?: number;
  experienceYears?: number;
  verified?: boolean;
  responseMinutes?: number;
  avatarUrl?: string;
  cardUrl?: string;
  heroUrl?: string;
  verificationLabel?: "平台试点教练" | "资料已核验" | "资料待补充" | "演示资料";
  isNew?: boolean;
  bookable?: boolean;
  bookingEnabled?: boolean;
  canConsult?: boolean;
  pricingStatus?: "published" | "unavailable";
  unavailableReason?: string;
  profileCompleteness?: "complete" | "partial" | "demo";
  profileKind?: "real" | "demo";
};

export type CoachVenue = {
  id: string;
  coachId: number;
  name: string;
  address: string;
  district: string;
  active?: boolean;
};

export type BookingSlot = {
  id: string;
  coachId: number;
  venueId?: string;
  venueName?: string;
  venueAddress?: string;
  venueDistrict?: string;
  date: string;
  dateLabel: string;
  time: string;
  endTime: string;
  available: boolean;
  durationMinutes: number;
  regularFeeFen?: number;
  trialFeeFen?: number;
};

export type LearnerProfile = {
  id: string;
  name: string;
  relation: "self" | "child";
  gender: "male" | "female" | "unspecified";
  age: number;
  sport: string;
  level: string;
  goal: string;
  guardianName?: string;
  guardianPhone?: string;
};

export type MobileBooking = {
  id: string;
  coachId: number;
  learnerId: string;
  learnerName?: string;
  coachName?: string;
  sport?: string;
  venueId: string;
  venueName?: string;
  slotId: string;
  date: string;
  dateLabel: string;
  time: string;
  endTime: string;
  status: BookingStatus;
  submittedAt: string;
  feeFen: number;
  paymentStatus: "offline_unpaid" | "offline_paid";
  note: string;
  durationMinutes?: number;
  expiresAt?: number;
  locationType?: "venue" | "custom";
  customDistrict?: string;
  customAddress?: string;
  customLocationNote?: string;
  review: ReviewEligibility;
};

export type ReviewEligibility = {
  canResubmit: boolean;
  canSubmit: boolean;
  eligibleUntil?: number;
  rejectionReason?: string;
  reviewId?: string;
  status: "not_eligible" | "available" | "pending" | "approved" | "rejected" | "expired";
};

export type BookingOptions = {
  coachId: number;
  durationMinutes: [60, 90, 120];
  earliestStartsAt: number;
  latestStartsAt: number;
  regularBasePriceFen: number;
  trialBasePriceFen: number;
  venues: CoachVenue[];
};

export type MobileMessage = {
  id: string;
  conversationId: string;
  sender: "coach" | "student" | "system" | "venue";
  body: string;
  createdAt: string;
  read: boolean;
  deliveryStatus?: "pending" | "sent" | "failed";
};

export type MobileConversation = {
  id: string;
  coachId?: number;
  title: string;
  subtitle: string;
  kind: "coach" | "system" | "venue";
  unreadCount: number;
  updatedAt: string;
  messages: MobileMessage[];
};

export type MobileNotification = {
  body: string;
  createdAt: number | string;
  id: string;
  read: boolean;
  title: string;
  type: string;
  targetMode?: AccountMode;
  deepLink?: string;
};

export type MatchPreferences = {
  sport: string;
  city: string;
  district: string;
  goal: string;
  audience: string;
  budget: number;
  desiredTime: "不限" | "工作日" | "周末" | "晚间";
};

export type MatchResult = {
  eligible: boolean;
  score: number;
  reasons: string[];
};

export type AccountProfile = {
  avatarUrl?: string;
  bio: string;
  completed: boolean;
  contact: {
    emailMasked?: string;
    emailVerified: boolean;
    phoneMasked?: string;
    phoneVerified: boolean;
  };
  district: string;
  nickname: string;
  updatedAt: number;
  userId: string;
};

export type MobileSession = {
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
  contactMasked: string;
  phoneMasked?: string;
  authMethod?: "phone_otp" | "email_otp";
  availableModes: AccountMode[];
  coach?: CoachAccountSummary;
  profile?: AccountProfile;
};

export type MobileIdentity = {
  availableModes: AccountMode[];
  coach?: CoachAccountSummary;
  contactMasked: string;
  phoneMasked?: string;
  authMethod?: "phone_otp" | "email_otp";
  userId?: string;
  roles?: Array<"student" | "coach" | "operator">;
  profile?: AccountProfile;
};

export type AppRelease = {
  certificateSha256: string;
  downloadUrl?: string;
  forced: boolean;
  minimumSupportedVersionCode: number;
  notes: string[];
  packageId: string;
  publishedAt: number | string;
  sha256: string;
  sizeBytes: number;
  versionCode: number;
  versionName: string;
};

export type CoachOverview = {
  bookings: MobileBooking[];
  coach: MobileCoach;
  conversations: MobileConversation[];
  slots: BookingSlot[];
  venues: CoachVenue[];
};

export type OperatorCoachBusinessSettings = {
  bookingEnabled: boolean;
  coachId: number;
  district: string;
  priceFen: number;
  pricingStatus: "published" | "unavailable";
  trialPriceFen: number;
  venues: CoachVenue[];
};

export type MobileStudentAppProps = {
  audience: string;
  city: string;
  coaches: MobileCoach[];
  goal: string;
  savedCoachIds: number[];
  selectedCoachId: number;
  sport: string;
  onBook: (coachName: string) => void;
  onChangeAudience: (value: string) => void;
  onChangeCity: (value: string) => void;
  onChangeGoal: (value: string) => void;
  onChangeSport: (value: string) => void;
  onSelectCoach: (id: number) => void;
  onToggleSaved: (id: number) => void;
  coachSummary?: CoachAccountSummary;
  onOpenCoachMode?: () => void;
  onOpenUpdates?: () => void;
  onSessionChange?: (session: MobileSession | null) => void;
  initialTab?: MobileTab;
  onTabChange?: (tab: MobileTab) => void;
};
