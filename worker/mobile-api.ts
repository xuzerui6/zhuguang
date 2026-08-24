import type { ApiEnv, ApiExecutionContext } from "../server/api/contracts";
import { dispatchPushDeliveriesD1 } from "../server/api/push";
import { handleApiRequest } from "../server/api/router";
import { expirePendingBookingRequestsD1 } from "../server/api/repository";

interface MobileApiExecutionContext extends ApiExecutionContext {
  passThroughOnException(): void;
}

interface ScheduledController {
  cron: string;
  scheduledTime: number;
}

function notFound() {
  return new Response(JSON.stringify({
    error: {
      code: "not_found",
      message: "接口不存在",
      requestId: crypto.randomUUID(),
    },
  }), {
    headers: {
      "cache-control": "no-store",
      "content-type": "application/json; charset=utf-8",
      "strict-transport-security": "max-age=31536000; includeSubDomains",
      "x-content-type-options": "nosniff",
    },
    status: 404,
  });
}

const mobileApiWorker = {
  async fetch(request: Request, env: ApiEnv, ctx: MobileApiExecutionContext): Promise<Response> {
    const response = await handleApiRequest(request, env, ctx);
    return response ?? notFound();
  },
  async scheduled(_controller: ScheduledController, env: ApiEnv, ctx: MobileApiExecutionContext) {
    ctx.waitUntil(expirePendingBookingRequestsD1(env).then(() => dispatchPushDeliveriesD1(env)));
  },
};

export default mobileApiWorker;
