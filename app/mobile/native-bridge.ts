import { Capacitor, registerPlugin, type PluginListenerHandle } from "@capacitor/core";
import type { AccountMode } from "./types";

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
  async getInstalledInfo() {
    return Capacitor.isNativePlatform() ? NativeAppUpdater.getInstalledInfo() : webInstalledInfo();
  },
  async canInstallPackages() {
    return Capacitor.isNativePlatform() ? NativeAppUpdater.canInstallPackages() : { allowed: false };
  },
  async openInstallPermission() {
    if (Capacitor.isNativePlatform()) await NativeAppUpdater.openInstallPermission();
  },
  async downloadAndInstall(options: Parameters<AppUpdaterPlugin["downloadAndInstall"]>[0]) {
    if (!Capacitor.isNativePlatform()) throw new Error("请在 Android App 中完成安全更新");
    return NativeAppUpdater.downloadAndInstall(options);
  },
  async onProgress(listener: (event: UpdateDownloadProgress) => void) {
    if (!Capacitor.isNativePlatform()) return { remove: async () => {} } satisfies PluginListenerHandle;
    return NativeAppUpdater.addListener("downloadProgress", listener);
  },
};

export const pushBridge = {
  async setPrivacyConsent(accepted: boolean) {
    if (!Capacitor.isNativePlatform()) return { initialized: accepted, provider: "web-preview" };
    return NativePushBridge.setPrivacyConsent({ accepted });
  },
  async getPermissionStatus() {
    if (!Capacitor.isNativePlatform()) {
      return { granted: typeof Notification !== "undefined" && Notification.permission === "granted", canAskAgain: true };
    }
    return NativePushBridge.getPermissionStatus();
  },
  async requestPermission() {
    if (!Capacitor.isNativePlatform()) {
      const permission = typeof Notification === "undefined" ? "denied" : await Notification.requestPermission();
      return { granted: permission === "granted", canAskAgain: permission !== "denied" };
    }
    return NativePushBridge.requestPermission();
  },
  async consumePendingDeepLink() {
    if (!Capacitor.isNativePlatform()) return { deepLink: "" };
    return NativePushBridge.consumePendingDeepLink();
  },
  async simulateNotification(options: Parameters<PushBridgePlugin["simulateNotification"]>[0]) {
    if (Capacitor.isNativePlatform()) await NativePushBridge.simulateNotification(options);
  },
  async onOpen(listener: (deepLink: string) => void) {
    if (!Capacitor.isNativePlatform()) return { remove: async () => {} } satisfies PluginListenerHandle;
    return NativePushBridge.addListener("pushOpened", ({ deepLink }) => listener(deepLink));
  },
};
