import { Capacitor, registerPlugin, type PluginListenerHandle } from "@capacitor/core";
import type { AccountMode } from "./types";
import { getMobilePlatform } from "./device";

export type InstalledAppInfo = {
  certificateSha256: string;
  packageId: string;
  versionCode: number;
  versionName: string;
};

export type UpdateDownloadProgress = {
  downloadedBytes: number;
  percent: number;
  state: "downloading" | "verified" | "installing" | "failed";
  totalBytes: number;
  message?: string;
};

type AppUpdaterPlugin = {
  getInstalledInfo(): Promise<InstalledAppInfo>;
  canInstallPackages(): Promise<{ allowed: boolean }>;
  openInstallPermission(): Promise<void>;
  downloadAndInstall(options: {
    certificateSha256: string;
    packageId: string;
    sha256: string;
    url: string;
    versionCode: number;
  }): Promise<{ launchedInstaller: boolean }>;
  addListener(
    eventName: "downloadProgress",
    listener: (event: UpdateDownloadProgress) => void,
  ): Promise<PluginListenerHandle>;
};

type PushBridgePlugin = {
  setPrivacyConsent(options: { accepted: boolean }): Promise<{ initialized: boolean; provider: string; registrationId?: string; registrationReady?: boolean }>;
  getPermissionStatus(): Promise<{ granted: boolean; canAskAgain: boolean }>;
  requestPermission(): Promise<{ granted: boolean; canAskAgain: boolean }>;
  consumePendingDeepLink(): Promise<{ deepLink: string }>;
  simulateNotification(options: {
    body: string;
    deepLink: string;
    targetMode: AccountMode;
    title: string;
    type: "booking" | "message" | "update";
  }): Promise<void>;
  addListener(
    eventName: "pushOpened",
    listener: (event: { deepLink: string }) => void,
  ): Promise<PluginListenerHandle>;
};

const NativeAppUpdater = registerPlugin<AppUpdaterPlugin>("AppUpdater");
const NativePushBridge = registerPlugin<PushBridgePlugin>("PushBridge");

function buildValue(key: string, fallback: string) {
  return typeof import.meta !== "undefined"
    ? (import.meta as ImportMeta & { env?: Record<string, string> }).env?.[key] ?? fallback
    : fallback;
}

function webInstalledInfo(): InstalledAppInfo {
  return {
    certificateSha256: buildValue("VITE_CERTIFICATE_SHA256", "浏览器预览不适用"),
    packageId: "com.zhuguang.coachos",
    versionCode: Number(buildValue("VITE_APP_VERSION_CODE", "3")),
    versionName: buildValue("VITE_APP_VERSION", "1.1.0"),
  };
}

export const appUpdater = {
  isSupported() {
    return getMobilePlatform() === "android";
  },
  async getInstalledInfo() {
    return getMobilePlatform() === "android" ? NativeAppUpdater.getInstalledInfo() : webInstalledInfo();
  },
  async canInstallPackages() {
    return getMobilePlatform() === "android" ? NativeAppUpdater.canInstallPackages() : { allowed: false };
  },
  async openInstallPermission() {
    if (getMobilePlatform() === "android") await NativeAppUpdater.openInstallPermission();
  },
  async downloadAndInstall(options: Parameters<AppUpdaterPlugin["downloadAndInstall"]>[0]) {
    if (getMobilePlatform() !== "android") throw new Error("iOS 版本请通过 TestFlight 更新");
    return NativeAppUpdater.downloadAndInstall(options);
  },
  async onProgress(listener: (event: UpdateDownloadProgress) => void) {
    if (getMobilePlatform() !== "android") return { remove: async () => {} } satisfies PluginListenerHandle;
    return NativeAppUpdater.addListener("downloadProgress", listener);
  },
};

export const pushBridge = {
  isSupported() {
    return getMobilePlatform() === "android";
  },
  async setPrivacyConsent(accepted: boolean) {
    if (!Capacitor.isNativePlatform()) return { initialized: accepted, provider: "web-preview" };
    if (getMobilePlatform() !== "android") return { initialized: false, provider: "unavailable", registrationReady: false };
    return NativePushBridge.setPrivacyConsent({ accepted });
  },
  async getPermissionStatus() {
    if (!Capacitor.isNativePlatform()) {
      return { granted: typeof Notification !== "undefined" && Notification.permission === "granted", canAskAgain: true };
    }
    if (getMobilePlatform() !== "android") return { granted: false, canAskAgain: false };
    return NativePushBridge.getPermissionStatus();
  },
  async requestPermission() {
    if (!Capacitor.isNativePlatform()) {
      const permission = typeof Notification === "undefined" ? "denied" : await Notification.requestPermission();
      return { granted: permission === "granted", canAskAgain: permission !== "denied" };
    }
    if (getMobilePlatform() !== "android") return { granted: false, canAskAgain: false };
    return NativePushBridge.requestPermission();
  },
  async consumePendingDeepLink() {
    if (!Capacitor.isNativePlatform()) return { deepLink: "" };
    if (getMobilePlatform() !== "android") return { deepLink: "" };
    return NativePushBridge.consumePendingDeepLink();
  },
  async simulateNotification(options: Parameters<PushBridgePlugin["simulateNotification"]>[0]) {
    if (getMobilePlatform() === "android") await NativePushBridge.simulateNotification(options);
  },
  async onOpen(listener: (deepLink: string) => void) {
    if (!Capacitor.isNativePlatform() || getMobilePlatform() !== "android") return { remove: async () => {} } satisfies PluginListenerHandle;
    return NativePushBridge.addListener("pushOpened", ({ deepLink }) => listener(deepLink));
  },
};
