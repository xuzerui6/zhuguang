package com.zhuguang.coachos;

import android.os.Bundle;
import androidx.core.splashscreen.SplashScreen;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        SplashScreen splashScreen = SplashScreen.installSplashScreen(this);
        registerPlugin(AppUpdaterPlugin.class);
        registerPlugin(PushBridgePlugin.class);
        super.onCreate(savedInstanceState);
        splashScreen.setOnExitAnimationListener(provider -> provider.getView()
            .animate()
            .alpha(0f)
            .scaleX(0.98f)
            .scaleY(0.98f)
            .setDuration(180L)
            .withEndAction(provider::remove)
            .start());
    }
}
