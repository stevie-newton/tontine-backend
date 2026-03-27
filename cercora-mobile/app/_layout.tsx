import React, { useEffect } from "react";
import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";

import { AppErrorBoundary } from "@/components/app-error-boundary";
import { ErrorBannerHost } from "@/components/error-banner";
import { PushBridge } from "@/components/push-bridge";
import { AuthProvider, useAuth } from "@/hooks/use-auth";
import { I18nProvider, useI18n } from "@/hooks/use-i18n";

void SplashScreen.preventAutoHideAsync();

function RootNavigator() {
  const { isLoading } = useAuth();
  const { t } = useI18n();

  useEffect(() => {
    if (!isLoading) {
      void SplashScreen.hideAsync();
    }
  }, [isLoading]);

  if (isLoading) {
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
