import React, { useEffect, useState } from "react";
import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";

import { AppErrorBoundary } from "@/components/app-error-boundary";
import { ErrorBannerHost } from "@/components/error-banner";
import { PushBridge } from "@/components/push-bridge";
import { AuthProvider, useAuth } from "@/hooks/use-auth";
import { I18nProvider, useI18n } from "@/hooks/use-i18n";

void SplashScreen.preventAutoHideAsync();

const MIN_SPLASH_MS = 1200;

function RootNavigator() {
  const { isLoading } = useAuth();
  const { t } = useI18n();
  const [minSplashElapsed, setMinSplashElapsed] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => {
      setMinSplashElapsed(true);
    }, MIN_SPLASH_MS);

    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (!isLoading && minSplashElapsed) {
      void SplashScreen.hideAsync();
    }
  }, [isLoading, minSplashElapsed]);

  if (isLoading || !minSplashElapsed) {
    return null;
  }

  return (
    <Stack>
      <Stack.Screen name="(auth)" options={{ headerShown: false }} />
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen
        name="modal"
        options={{ presentation: "modal", title: t("Modal") }}
      />
    </Stack>
  );
}

export default function RootLayout() {
  return (
    <I18nProvider>
      <AppErrorBoundary>
        <AuthProvider>
          <RootNavigator />
          <PushBridge />
          <ErrorBannerHost />
        </AuthProvider>
      </AppErrorBoundary>
    </I18nProvider>
  );
}
