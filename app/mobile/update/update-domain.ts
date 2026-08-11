type UpdateErrorLike = {
  code?: unknown;
  message?: unknown;
  name?: unknown;
};

type InstallPermissionBridge = {
  canInstallPackages(): Promise<{ allowed: boolean }>;
  openInstallPermission(): Promise<void>;
};

export function createUpdateResumeGate() {
  let waitingForPermission = false;

  return {
    claim(allowed: boolean) {
      if (!allowed || !waitingForPermission) return false;
      waitingForPermission = false;
      return true;
    },
    clear() {
      waitingForPermission = false;
    },
    isWaiting() {
      return waitingForPermission;
    },
    wait() {
      waitingForPermission = true;
    },
  };
}

export async function ensureUpdateInstallPermission(
  updater: InstallPermissionBridge,
  resumeGate: ReturnType<typeof createUpdateResumeGate>,
) {
  const { allowed } = await updater.canInstallPackages();
  if (allowed) {
    resumeGate.clear();
    return true;
  }

  resumeGate.wait();
  await updater.openInstallPermission();
  return false;
}

function errorLike(error: unknown): UpdateErrorLike {
  return error && typeof error === "object" ? error as UpdateErrorLike : {};
}

export function isNoNewReleaseError(error: unknown) {
  return errorLike(error).code === "release_not_available";
}

export function updateCheckErrorMessage(error: unknown) {
  const normalized = errorLike(error);
  const message = typeof normalized.message === "string" ? normalized.message : "";
  if (normalized.name === "AbortError" || /abort|network|timeout|failed to fetch/iu.test(message)) {
    return "暂时无法连接更新服务，请检查网络后重试";
  }
  return message || "检查更新失败，请稍后重试";
}
