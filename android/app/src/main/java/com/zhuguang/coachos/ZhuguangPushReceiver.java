package com.zhuguang.coachos;

import android.content.Context;
import android.content.Intent;
import android.net.Uri;
import cn.jpush.android.api.NotificationMessage;
import cn.jpush.android.service.JPushMessageReceiver;
import org.json.JSONObject;

public class ZhuguangPushReceiver extends JPushMessageReceiver {
    @Override
    public void onNotifyMessageOpened(Context context, NotificationMessage message) {
        String deepLink = "zhuguang://student/messages";
        try {
            JSONObject extras = new JSONObject(message.notificationExtras == null ? "{}" : message.notificationExtras);
            deepLink = extras.optString("deepLink", deepLink);
        } catch (Exception ignored) {
            // A malformed provider payload falls back to the safe message inbox route.
        }
        Intent intent = new Intent(Intent.ACTION_VIEW, Uri.parse(deepLink), context, MainActivity.class);
        intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP | Intent.FLAG_ACTIVITY_SINGLE_TOP);
        context.startActivity(intent);
    }
}

