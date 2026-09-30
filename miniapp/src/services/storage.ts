import Taro from "@tarojs/taro";
import type { AccountMode, Session } from "../types";

const SESSION_KEY = "zhuguang-miniapp-session";
const MODE_KEY = "zhuguang-miniapp-mode";
const DEVICE_KEY = "zhuguang-miniapp-device";
const WECHAT_LINK_KEY = "zhuguang-miniapp-wechat-link";
const FAVORITES_KEY = "zhuguang-miniapp-favorites";
const OWNER_KEY = "zhuguang-miniapp-session-owner";
let revision = 0;

export function getSession(): Session | null {
  return Taro.getStorageSync<Session | null>(SESSION_KEY) || null;
}

export function setSession(session: Session | null, rotating = false) {
  revision++;
  if (!rotating) {
    if (session) Taro.setStorageSync(OWNER_KEY, `owner_${Date.now()}_${Math.random().toString(36).slice(2)}`);
    else Taro.removeStorageSync(OWNER_KEY);
  }
  if (session) Taro.setStorageSync(SESSION_KEY, session);
  else Taro.removeStorageSync(SESSION_KEY);
}

export function getSessionRevision() { return revision; }
export function getSessionOwner() {
  if (!getSession()) return 'guest';
  const owner = Taro.getStorageSync<string>(OWNER_KEY);
  if (owner) return owner;
  const next = `owner_${Date.now()}_${Math.random().toString(36).slice(2)}`;
  Taro.setStorageSync(OWNER_KEY, next);
  return next;
}

export function getMode(): AccountMode {
  return Taro.getStorageSync<AccountMode>(MODE_KEY) === "coach" ? "coach" : "student";
}

export function setMode(mode: AccountMode) {
  Taro.setStorageSync(MODE_KEY, mode);
}

export function getDeviceId() {
  const existing = Taro.getStorageSync<string>(DEVICE_KEY);
  if (existing) return existing;
  const id = `wx_${Date.now()}_${Math.random().toString(36).slice(2, 12)}`;
  Taro.setStorageSync(DEVICE_KEY, id);
  return id;
}

export function getPendingWechatLink(): { linkToken: string; expiresAt: number } | null {
  const value = Taro.getStorageSync<{ linkToken: string; expiresAt: number } | null>(WECHAT_LINK_KEY) || null;
  if (value && value.expiresAt > Date.now()) return value;
  if (value) Taro.removeStorageSync(WECHAT_LINK_KEY);
  return null;
}

export function setPendingWechatLink(value: { linkToken: string; expiresAt: number } | null) {
  if (value) Taro.setStorageSync(WECHAT_LINK_KEY, value);
  else Taro.removeStorageSync(WECHAT_LINK_KEY);
}

export function getLocalFavoriteCoachIds(): number[] {
  const value = Taro.getStorageSync<unknown>(FAVORITES_KEY);
  return Array.isArray(value) ? value.filter((id): id is number => Number.isInteger(id) && id > 0) : [];
}

export function setLocalFavoriteCoachIds(ids: number[]) {
  Taro.setStorageSync(FAVORITES_KEY, [...new Set(ids)].filter((id) => Number.isInteger(id) && id > 0));
}
