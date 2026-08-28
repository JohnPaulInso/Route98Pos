package com.route98.pos;

import com.getcapacitor.BridgeActivity;

// (2026-07-13) Disable WebView overscroll rubber band stretch; prev: default
public class MainActivity extends BridgeActivity {
    @Override
    public void onResume() {
        super.onResume();
        if (getBridge() != null && getBridge().getWebView() != null) {
            getBridge().getWebView().setOverScrollMode(android.view.View.OVER_SCROLL_NEVER);
        }
    }
}
