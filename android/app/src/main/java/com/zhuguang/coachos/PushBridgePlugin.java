package com.zhuguang.coachos;

import android.Manifest;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Intent;
import android.content.pm.ApplicationInfo;
import android.content.pm.PackageManager;
import android.net.Uri;
import android.os.Build;
import androidx.core.app.NotificationCompat;
import androidx.core.app.NotificationManagerCompat;
import cn.jiguang.api.utils.JCollectionAuth;
import cn.jpush.android.api.JPushInterface;
import com.getcapacitor.JSObject;
import com.getcapacitor.PermissionState;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;
import com.getcapacitor.annotation.PermissionCallback;

@CapacitorPlugin(
    name = "PushBridge",
    permissions = @Permission(alias = "notifications", strings = { Manifest.permission.POST_NOTIFICATIONS })
)
public class PushBridgePlugin extends Plugin {
    private static final String CHANNEL_BOOKING = "zhuguang_booking";
    private static final String CHANNEL_MESSAGE = "zhuguang_message";
    private static final String CHANNEL_UPDATE = "zhuguang_update";

    @Override
    public void load() {
        createNotificationChannels();
    }

    @PluginMethod
    public void setPrivacyConsent(PluginCall call) {
        boolean accepted = Boolean.TRUE.equals(call.getBoolean("accepted", false));
        JSObject result = new JSObject();
        if (!accepted) {
            result.put("initialized", false);
            result.put("provider", "disabled-before-consent");
            call.resolve(result);
            return;
        }
        String appKey = configuredAppKey();
        if (appKey.isBlank() || "NOT_CONFIGURED".equals(appKey)) {
            result.put("initialized", false);
            result.put("provider", "jpush-unconfigured");
            call.resolve(result);
            return;
        }
        try {
            JCollectionAuth.setAuth(getContext(), true);
            JPushInterface.setDebugMode(false);
            JPushInterface.init(getContext());
            result.put("initialized", true);
            result.put("provider", "jpush");
            result.put("registrationId", JPushInterface.getRegistrationID(getContext()));
            call.resolve(result);
        } catch (Exception error) {
            call.reject("推送服务初始化失败", "PUSH_INIT_FAILED", error);
        }
    }

    @PluginMethod
    public void getPermissionStatus(PluginCall call) {
        call.resolve(permissionResult());
    }

    @PluginMethod
    public void requestPermission(PluginCall call) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.TIRAMISU) {
            call.resolve(permissionResult());
            return;
        }
        requestPermissionForAlias("notifications", call, "notificationsPermissionCallback");
    }

    @PermissionCallback
    private void notificationsPermissionCallback(PluginCall call) {
        call.resolve(permissionResult());
    }

    @PluginMethod
    public void simulateNotification(PluginCall call) {
        if (!NotificationManagerCompat.from(getContext()).areNotificationsEnabled()) {
            call.reject("通知权限尚未开启", "NOTIFICATION_PERMISSION_REQUIRED");
            return;
        }
        String type = call.getString("type", "message");
        String targetMode = call.getString("targetMode", "student");
        String title = call.getString("title", "逐光");
        String body = call.getString("body", "你有一条新的服务通知");
        String deepLink = call.getString("deepLink", "zhuguang://" + targetMode + "/messages");
        int notificationId = (int) (System.currentTimeMillis() & 0x7fffffff);
        Intent intent = new Intent(Intent.ACTION_VIEW, Uri.parse(deepLink), getContext(), MainActivity.class);
        intent.addFlags(Intent.FLAG_ACTIVITY_CLEAR_TOP | Intent.FLAG_ACTIVITY_SINGLE_TOP);
        PendingIntent pendingIntent = PendingIntent.getActivity(
            getContext(),
            notificationId,
            intent,
            PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
        );
        NotificationCompat.Builder builder = new NotificationCompat.Builder(getContext(), channelFor(type))
            .setSmallIcon(R.drawable.ic_notification_zhuguang)
            .setContentTitle(title)
            .setContentText(body)
            .setStyle(new NotificationCompat.BigTextStyle().bigText(body))
            .setAutoCancel(true)
            .setContentIntent(pendingIntent)
            .setPriority(NotificationCompat.PRIORITY_HIGH);
        NotificationManagerCompat.from(getContext()).notify(notificationId, builder.build());
        call.resolve();
    }

    private JSObject permissionResult() {
        boolean granted = Build.VERSION.SDK_INT < Build.VERSION_CODES.TIRAMISU
            ? NotificationManagerCompat.from(getContext()).areNotificationsEnabled()
            : getPermissionState("notifications") == PermissionState.GRANTED;
        JSObject result = new JSObject();
        result.put("granted", granted);
        result.put("canAskAgain", Build.VERSION.SDK_INT < Build.VERSION_CODES.TIRAMISU || getPermissionState("notifications") == PermissionState.PROMPT);
        return result;
    }

    private String configuredAppKey() {
        try {
            ApplicationInfo info = getContext().getPackageManager().getApplicationInfo(getContext().getPackageName(), PackageManager.GET_META_DATA);
            return info.metaData == null ? "" : info.metaData.getString("JPUSH_APPKEY", "");
        } catch (PackageManager.NameNotFoundException error) {
            return "";
        }
    }

    private void createNotificationChannels() {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return;
        NotificationManager manager = getContext().getSystemService(NotificationManager.class);
        NotificationChannel booking = new NotificationChannel(CHANNEL_BOOKING, "预约进度", NotificationManager.IMPORTANCE_HIGH);
        booking.setDescription("预约确认、改期、取消与课程完成状态");
        NotificationChannel message = new NotificationChannel(CHANNEL_MESSAGE, "服务消息", NotificationManager.IMPORTANCE_DEFAULT);
        message.setDescription("教练与学员的服务沟通消息");
        NotificationChannel update = new NotificationChannel(CHANNEL_UPDATE, "版本更新", NotificationManager.IMPORTANCE_DEFAULT);
        update.setDescription("逐光安全版本更新提醒");
        manager.createNotificationChannel(booking);
        manager.createNotificationChannel(message);
        manager.createNotificationChannel(update);
    }

    private String channelFor(String type) {
        if ("booking".equals(type)) return CHANNEL_BOOKING;
        if ("update".equals(type)) return CHANNEL_UPDATE;
        return CHANNEL_MESSAGE;
    }
}
