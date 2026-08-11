package com.zhuguang.coachos;

import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.view.View;
import androidx.core.splashscreen.SplashScreen;
import com.getcapacitor.BridgeActivity;
import java.util.concurrent.atomic.AtomicBoolean;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        SplashScreen splashScreen = SplashScreen.installSplashScreen(this);
        AtomicBoolean firstFrameReady = new AtomicBoolean(false);
        splashScreen.setKeepOnScreenCondition(() -> !firstFrameReady.get());
        registerPlugin(AppUpdaterPlugin.class);
        registerPlugin(PushBridgePlugin.class);
        super.onCreate(savedInstanceState);

        View webView = getBridge().getWebView();
        webView.post(() -> webView.postOnAnimation(() -> firstFrameReady.set(true)));
        new Handler(Looper.getMainLooper()).postDelayed(() -> firstFrameReady.set(true), 1200L);

        splashScreen.setOnExitAnimationListener(provider -> {
            provider.getView().animate()
                .alpha(0f)
                .setDuration(170L)
                .withEndAction(provider::remove)
                .start();
        });
    }
}
