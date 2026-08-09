type UpdateErrorLike = {
  code?: unknown;
  message?: unknown;
  name?: unknown;
};

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
