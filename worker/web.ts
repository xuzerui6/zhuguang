import handler from "vinext/server/app-router-entry";

interface WebEnv {
  ASSETS: Fetcher;
}

interface ExecutionContext {
  waitUntil(promise: Promise<unknown>): void;
  passThroughOnException(): void;
}

export default {
  fetch(request: Request, env: WebEnv, ctx: ExecutionContext) {
    const url = new URL(request.url);
    if (url.hostname === "www.beijingzhuguang.top") {
      url.hostname = "beijingzhuguang.top";
      return Response.redirect(url, 301);
    }
    return handler.fetch(request, env, ctx);
  },
};
