import React from "react";
import { ActivityIndicator, StyleSheet } from "react-native";
import { Stack } from "expo-router";

import { BrandBackdrop } from "@/components/brand-backdrop";
import { AppErrorBoundary } from "@/components/app-error-boundary";
import { ErrorBannerHost } from "@/components/error-banner";
import { ThemedView } from "@/components/themed-view";
import { BrandColors } from "@/constants/brand";
import { AuthProvider, useAuth } from "@/hooks/use-auth";
import { I18nProvider, useI18n } from "@/hooks/use-i18n";

function RootNavigator() {
  const { isLoading } = useAuth();
  const { t } = useI18n();

  if (isLoading) {
    return (
      <ThemedView style={styles.loading} lightColor={BrandColors.canvas}>
        <BrandBackdrop />
        <ActivityIndicator color={BrandColors.blue} />
      </ThemedView>
    );
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
          <ErrorBannerHost />
        </AuthProvider>
      </AppErrorBoundary>
    </I18nProvider>
  );
}

const styles = StyleSheet.create({
  loading: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
});
