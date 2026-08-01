import { ApiError, type ApiEnv } from "./contracts";
import { randomId } from "./security";

type Row = Record<string, unknown>;

function db(env: ApiEnv) {
  if (!env.DB) throw new ApiError(503, "database_unavailable", "业务数据库暂时不可用");
  return env.DB;
}

function text(value: unknown) {
  return typeof value === "string" ? value : String(value ?? "");
}

function number(value: unknown) {
  return typeof value === "number" ? value : Number(value ?? 0);
}

export function pushLockScreenBody(type: string, body: string) {
  if (type.includes("message")) return "你有一条新的服务消息，请进入逐光查看。";
  return body;
}

export async function enqueuePendingPushDeliveriesD1(env: ApiEnv) {
  const now = Date.now();
  await db(env).prepare(`
    INSERT OR IGNORE INTO push_deliveries
      (id, notification_id, installation_id, provider, status, attempt_count, created_at, updated_at)
    SELECT 'push_' || lower(hex(randomblob(16))), n.id, i.id, 'jpush', 'pending', 0, ?, ?
    FROM notifications n
    JOIN app_installations i ON i.user_id = n.user_id AND i.status = 'active' AND i.push_enabled = 1 AND i.push_registration_id IS NOT NULL
    LEFT JOIN notification_preferences p ON p.user_id = n.user_id
    WHERE (n.type LIKE 'booking%' AND coalesce(p.booking_enabled, 1) = 1)
       OR (n.type LIKE '%message%' AND coalesce(p.message_enabled, 1) = 1)
       OR (n.type = 'version_update' AND coalesce(p.update_enabled, 1) = 1)
  `).bind(now, now).run();
}

async function sendJPush(row: Row, env: ApiEnv) {
  if (!env.JPUSH_APP_KEY || !env.JPUSH_MASTER_SECRET) {
    throw new Error("JPush credentials are not configured");
  }
  const authorization = btoa(`${env.JPUSH_APP_KEY}:${env.JPUSH_MASTER_SECRET}`);
  const response = await fetch("https://api.jpush.cn/v3/push", {
    body: JSON.stringify({
      audience: { registration_id: [text(row.push_registration_id)] },
      notification: {
        android: {
          alert: pushLockScreenBody(text(row.type), text(row.body)),
          extras: {
            deepLink: text(row.deep_link),
            notificationId: text(row.notification_id),
            targetMode: text(row.target_mode),
            type: text(row.type),
          },
          title: text(row.title),
        },
      },
      options: { apns_production: true, time_to_live: 86_400 },
      platform: ["android"],
    }),
    headers: { authorization: `Basic ${authorization}`, "content-type": "application/json" },
    method: "POST",
  });
  const payload = await response.json().catch(() => ({})) as { msg_id?: string; error?: { message?: string } };
  if (!response.ok) throw new Error(payload.error?.message || `JPush HTTP ${response.status}`);
  return payload.msg_id ? String(payload.msg_id) : "accepted";
}

export async function dispatchPushDeliveriesD1(env: ApiEnv) {
  if (!env.DB) return;
  await enqueuePendingPushDeliveriesD1(env);
  const rows = await db(env).prepare(`
    SELECT d.id, d.notification_id, d.attempt_count, i.push_registration_id,
      n.type, n.title, n.body, n.target_mode, n.deep_link
    FROM push_deliveries d
    JOIN app_installations i ON i.id = d.installation_id
    JOIN notifications n ON n.id = d.notification_id
    WHERE d.status IN ('pending', 'failed') AND coalesce(d.next_attempt_at, 0) <= ?
    ORDER BY d.created_at LIMIT 50
  `).bind(Date.now()).all<Row>();
  for (const row of rows.results ?? []) {
    const attempts = number(row.attempt_count) + 1;
    try {
      const messageId = await sendJPush(row, env);
      await db(env).prepare("UPDATE push_deliveries SET status = 'sent', attempt_count = ?, provider_message_id = ?, last_error = NULL, updated_at = ? WHERE id = ?").bind(attempts, messageId, Date.now(), row.id).run();
    } catch (error) {
      const terminal = attempts >= 3;
      const retryAt = terminal ? null : Date.now() + (2 ** attempts) * 60_000;
      await db(env).prepare("UPDATE push_deliveries SET status = ?, attempt_count = ?, last_error = ?, next_attempt_at = ?, updated_at = ? WHERE id = ?").bind(
        terminal ? "dead" : "failed",
        attempts,
        error instanceof Error ? error.message.slice(0, 500) : "Unknown push error",
        retryAt,
        Date.now(),
        row.id,
      ).run();
    }
  }
}

export async function queueVersionNotificationsD1(versionName: string, env: ApiEnv) {
  const users = await db(env).prepare("SELECT id FROM users WHERE status = 'active' AND deleted_at IS NULL").all<Row>();
  const now = Date.now();
  const statements = (users.results ?? []).map((user) => db(env).prepare(`
    INSERT INTO notifications (id, user_id, type, title, body, entity_type, entity_id, target_mode, deep_link, created_at)
    VALUES (?, ?, 'version_update', '逐光有新版本', ?, 'app_release', ?, 'student', 'zhuguang://updates/latest', ?)
  `).bind(randomId("notification"), user.id, `版本 ${versionName} 已发布，可前往版本中心安全更新。`, versionName, now));
  for (let index = 0; index < statements.length; index += 80) {
    await db(env).batch(statements.slice(index, index + 80));
  }
  await enqueuePendingPushDeliveriesD1(env);
  return { queuedUsers: statements.length, versionName };
}
