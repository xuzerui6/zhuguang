import { App } from "@capacitor/app";
import { Capacitor } from "@capacitor/core";
import { Haptics, ImpactStyle } from "@capacitor/haptics";
import { Keyboard } from "@capacitor/keyboard";
import { Network } from "@capacitor/network";
import { Preferences } from "@capacitor/preferences";
import { SecureStorage } from "@aparajita/capacitor-secure-storage";
import type { AccountMode, CoachTab, MobileSession, MobileTab } from "./types";

const SESSION_KEY = "zhuguang-mobile-session";
const FAVORITES_KEY = "zhuguang-mobile-favorites";
const PREFERENCES_KEY = "zhuguang-mobile-preferences";
const BOOKING_DRAFT_KEY = "zhuguang-mobile-booking-draft";
const DEVICE_ID_KEY = "zhuguang-mobile-device-id";
const LEGACY_APPOINTMENT_KEY = "zhuguang-demo-appointment";
const ACCOUNT_MODE_KEY = "zhuguang-account-mode";
const STUDENT_TAB_KEY = "zhuguang-student-last-tab";
const COACH_TAB_KEY = "zhuguang-coach-last-tab";
const PRIVACY_CONSENT_KEY = "zhuguang-privacy-consent-v1";
const UPDATE_DEFERRED_UNTIL_KEY = "zhuguang-update-deferred-until";

export function isNativeMobile() {
  return Capacitor.isNativePlatform();
}

export async function showNativeKeyboard() {
  if (!isNativeMobile()) return;
  try {
    await Keyboard.show();
  } catch {
    // The focused input remains usable when an OEM keyboard declines the request.
  }
}

export async function readSession() {
  try {
    if (isNativeMobile()) {
      const session = (await SecureStorage.get(SESSION_KEY)) as MobileSession | null;
      return normalizeSession(session);
    }
    const value = window.sessionStorage.getItem(SESSION_KEY);
    return value ? normalizeSession(JSON.parse(value) as MobileSession) : null;
  } catch {
    return null;
  }
}

function normalizeSession(session: MobileSession | null) {
  if (!session) return null;
  return {
    ...session,
    availableModes: session.availableModes?.length ? session.availableModes : ["student" as const],
  };
}

export async function writeSession(session: MobileSession | null) {
  if (isNativeMobile()) {
    if (session) await SecureStorage.set(SESSION_KEY, session);
    else await SecureStorage.remove(SESSION_KEY);
    return;
  }
  if (session) window.sessionStorage.setItem(SESSION_KEY, JSON.stringify(session));
  else window.sessionStorage.removeItem(SESSION_KEY);
}

export async function readPreference<T>(key: "favorites" | "preferences" | "bookingDraft") {
  const storageKey = key === "favorites" ? FAVORITES_KEY : key === "preferences" ? PREFERENCES_KEY : BOOKING_DRAFT_KEY;
  try {
    const result = await Preferences.get({ key: storageKey });
    return result.value ? (JSON.parse(result.value) as T) : null;
  } catch {
    return null;
  }
}

export async function writePreference(key: "favorites" | "preferences" | "bookingDraft", value: unknown) {
  const storageKey = key === "favorites" ? FAVORITES_KEY : key === "preferences" ? PREFERENCES_KEY : BOOKING_DRAFT_KEY;
  await Preferences.set({ key: storageKey, value: JSON.stringify(value) });
}

async function readStringPreference(key: string) {
  try {
    return (await Preferences.get({ key })).value;
  } catch {
    return null;
  }
}

async function writeStringPreference(key: string, value: string) {
  await Preferences.set({ key, value });
}

export async function readAccountMode(): Promise<AccountMode> {
  return (await readStringPreference(ACCOUNT_MODE_KEY)) === "coach" ? "coach" : "student";
}

export async function writeAccountMode(mode: AccountMode) {
  await writeStringPreference(ACCOUNT_MODE_KEY, mode);
}

export async function readLastStudentTab(): Promise<MobileTab> {
  const value = await readStringPreference(STUDENT_TAB_KEY);
  return new Set(["home", "discover", "bookings", "messages", "profile"]).has(value ?? "")
    ? value as MobileTab
    : "home";
}

export async function writeLastStudentTab(tab: MobileTab) {
  await writeStringPreference(STUDENT_TAB_KEY, tab);
}

export async function readLastCoachTab(): Promise<CoachTab> {
  const value = await readStringPreference(COACH_TAB_KEY);
  return new Set(["workspace", "appointments", "schedule", "messages", "profile"]).has(value ?? "")
    ? value as CoachTab
    : "workspace";
}

export async function writeLastCoachTab(tab: CoachTab) {
  await writeStringPreference(COACH_TAB_KEY, tab);
}

export async function hasPrivacyConsent() {
  return (await readStringPreference(PRIVACY_CONSENT_KEY)) === "accepted";
}

export async function acceptPrivacyConsent() {
  await writeStringPreference(PRIVACY_CONSENT_KEY, "accepted");
}

export async function readUpdateDeferredUntil() {
  return Number(await readStringPreference(UPDATE_DEFERRED_UNTIL_KEY)) || 0;
}

export async function deferUpdateFor24Hours() {
  const deferredUntil = Date.now() + 24 * 60 * 60_000;
  await writeStringPreference(UPDATE_DEFERRED_UNTIL_KEY, String(deferredUntil));
  return deferredUntil;
}

export async function getOrCreateDeviceId() {
  try {
    const stored = await Preferences.get({ key: DEVICE_ID_KEY });
    if (stored.value) return stored.value;
    const deviceId = `device_${crypto.randomUUID()}`;
    await Preferences.set({ key: DEVICE_ID_KEY, value: deviceId });
    return deviceId;
  } catch {
    const fallbackKey = "zhuguang-web-device-id";
    const stored = window.localStorage.getItem(fallbackKey);
    if (stored) return stored;
    const deviceId = `device_${crypto.randomUUID()}`;
    window.localStorage.setItem(fallbackKey, deviceId);
    return deviceId;
  }
}

export async function clearLegacyAppointment() {
  try {
    window.localStorage.removeItem(LEGACY_APPOINTMENT_KEY);
    await Preferences.remove({ key: LEGACY_APPOINTMENT_KEY });
  } catch {
    // Legacy cleanup is best-effort and must never block app startup.
  }
}

export async function impact(style: "light" | "medium" = "light") {
  if (!isNativeMobile()) return;
  try {
    await Haptics.impact({ style: style === "medium" ? ImpactStyle.Medium : ImpactStyle.Light });
  } catch {
    // Haptics are an enhancement and may be disabled by the device.
  }
}

export async function getNetworkStatus() {
  try {
    return await Network.getStatus();
  } catch {
    return { connected: navigator.onLine, connectionType: "unknown" as const };
  }
}

export function listenForAppResume(onResume: () => void) {
  if (!isNativeMobile()) {
    const listener = () => {
      if (document.visibilityState === "visible") onResume();
    };
    document.addEventListener("visibilitychange", listener);
    return () => document.removeEventListener("visibilitychange", listener);
  }

  let disposed = false;
  let remove: (() => Promise<void>) | undefined;
  void App.addListener("appStateChange", ({ isActive }) => {
    if (isActive && !disposed) onResume();
  }).then((handle) => {
    remove = () => handle.remove();
  });
  return () => {
    disposed = true;
    void remove?.();
  };
}

export function listenForAppUrl(onUrl: (url: string) => void) {
  if (!isNativeMobile()) return () => {};
  let disposed = false;
  let remove: (() => Promise<void>) | undefined;
  void App.addListener("appUrlOpen", ({ url }) => {
    if (!disposed) onUrl(url);
  }).then((handle) => {
    remove = () => handle.remove();
  });
  void App.getLaunchUrl().then((result) => {
    if (!disposed && result?.url) onUrl(result.url);
  });
  return () => {
    disposed = true;
    void remove?.();
  };
}

export function listenForBackButton(onBack: () => boolean) {
  if (!isNativeMobile()) return () => {};
  let disposed = false;
  let remove: (() => Promise<void>) | undefined;
  void App.addListener("backButton", () => {
    if (!disposed) onBack();
  }).then((handle) => {
    remove = () => handle.remove();
  });
  return () => {
    disposed = true;
    void remove?.();
  };
}
