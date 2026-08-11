export interface TurnstileApi {
  remove(widgetId: string): void;
  render(element: HTMLElement, options: Record<string, unknown>): string;
  reset(widgetId: string): void;
}

declare global {
  interface Window {
    turnstile?: TurnstileApi;
  }
}

export function removeTurnstileWidget(api: Pick<TurnstileApi, "remove"> | undefined, widgetId: string | null) {
  if (!api || !widgetId) return false;
  try {
    api.remove(widgetId);
    return true;
  } catch {
    return false;
  }
}
