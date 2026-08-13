export type MobileTab = "home" | "discover" | "bookings" | "messages" | "profile";

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
  fit?: number;
  audience: string[];
  goals: string[];
  strengths: string[];
  proof: string[];
  availability: string[];
  note: string;
  accent: string;
  district?: string;
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
  canConsult?: boolean;
  profileCompleteness?: "complete" | "partial" | "demo";
  profileKind?: "real" | "demo";
};

export type CoachVenue = {
  id: string;
  coachId: number;
  name: string;
  address: string;
  district: string;
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
  venueId: string;
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
};

export type MobileMessage = {
  id: string;
  conversationId: string;
  sender: "coach" | "student" | "system" | "venue";
  body: string;
  createdAt: string;
  read: boolean;
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

export type MobileSession = {
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
  contactMasked: string;
  phoneMasked?: string;
  authMethod?: "phone_otp" | "email_otp";
  availableModes: AccountMode[];
  coach?: CoachAccountSummary;
};

export type MobileIdentity = {
  availableModes: AccountMode[];
  coach?: CoachAccountSummary;
  contactMasked: string;
  phoneMasked?: string;
  authMethod?: "phone_otp" | "email_otp";
  userId?: string;
  roles?: Array<"student" | "coach" | "operator">;
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
  conversations: Array<Pick<MobileConversation, "id" | "title"> & { last_message_at?: number }>;
  slots: BookingSlot[];
  venues?: CoachVenue[];
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
