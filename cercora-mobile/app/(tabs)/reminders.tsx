import AsyncStorage from "@react-native-async-storage/async-storage";
import Ionicons from "@expo/vector-icons/Ionicons";
import { useFocusEffect } from "@react-navigation/native";
import axios from "axios";
import { Stack } from "expo-router";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Platform,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Switch,
  View,
} from "react-native";

import { BrandBackdrop } from "@/components/brand-backdrop";
import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { BrandColors, BrandShadow } from "@/constants/brand";
import { api } from "@/hooks/api-client";
import {
  disableNativePush,
  enableNativePush,
  getNativePushStatus,
  NATIVE_PUSH_SUPPORTED,
} from "@/hooks/native-push";
import { getErrorMessage } from "@/hooks/error-utils";
import { getCurrentLocale, useI18n } from "@/hooks/use-i18n";

const WEB_PUSH_VAPID_PUBLIC_KEY =
  process.env.EXPO_PUBLIC_WEB_PUSH_VAPID_PUBLIC_KEY ?? "";

type Reminder = {
  cycle_id: number;
  tontine_id: number;
  tontine_name: string;
  cycle_number: number;
  deadline: string;
  hours_remaining: number;
  is_overdue: boolean;
  hours_overdue: number;
};

function formatShortDate(value: string) {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return new Intl.DateTimeFormat(getCurrentLocale(), {
    month: "short",
    day: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(d);
}

function isMissingReminderFeedError(error: unknown) {
  return (
    (axios.isAxiosError(error) && error.response?.status === 404) ||
    (error instanceof Error && error.message.trim().toLowerCase() === "not found") ||
    (typeof error === "string" && error.trim().toLowerCase() === "not found")
  );
}

export default function RemindersScreen() {
  const { t } = useI18n();
  const nativePushSupported = NATIVE_PUSH_SUPPORTED;

  const [reminders, setReminders] = useState<Reminder[]>([]);
  const [remindersError, setRemindersError] = useState<string | null>(null);
  const [remindersLoading, setRemindersLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const webPushSupported = useMemo(() => {
    if (Platform.OS !== "web") return false;
    const w = globalThis as any;
    const hasNotification = typeof w.Notification !== "undefined";
    const hasServiceWorker = typeof w.navigator?.serviceWorker !== "undefined";
    const hasPushManager = typeof w.PushManager !== "undefined";
    const isSecure = Boolean(w.isSecureContext);
    return hasNotification && hasServiceWorker && hasPushManager && isSecure;
  }, []);

  const [permission, setPermission] = useState<
    "unsupported" | NotificationPermission
  >(() => {
    if (!webPushSupported) return "unsupported";
    return (globalThis as any).Notification.permission as NotificationPermission;
  });
  const [pushSubscribed, setPushSubscribed] = useState(false);
  const [pushBusy, setPushBusy] = useState(false);
  const [pushError, setPushError] = useState<string | null>(null);

  const loadReminders = useCallback(async () => {
    setRemindersLoading(true);
    setRemindersError(null);
    try {
      const res = await api.get<{ reminders: Reminder[] }>("/reminders/pre-deadline/me");
      setReminders(res.data.reminders ?? []);
    } catch (e) {
      if (isMissingReminderFeedError(e)) {
        setRemindersError(null);
        setReminders([]);
        return;
      }
      setRemindersError(getErrorMessage(e));
      setReminders([]);
    } finally {
      setRemindersLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void loadReminders();
    }, [loadReminders])
  );

  useEffect(() => {
    if (nativePushSupported || !webPushSupported) return;
    setPermission(
      (globalThis as any).Notification.permission as NotificationPermission
    );
  }, [nativePushSupported, webPushSupported]);

  const refreshPushSubscriptionState = useCallback(async () => {
    if (nativePushSupported) {
      try {
        const status = await getNativePushStatus();
        setPushSubscribed(status.subscribed);
      } catch {
        setPushSubscribed(false);
      }
      return;
    }
    if (!webPushSupported) return;
    try {
      const reg = await (globalThis as any).navigator.serviceWorker.getRegistration();
      if (!reg) {
        setPushSubscribed(false);
        return;
      }
      const sub = await reg.pushManager.getSubscription();
      setPushSubscribed(Boolean(sub));
    } catch {
      setPushSubscribed(false);
    }
  }, [nativePushSupported, webPushSupported]);

  useEffect(() => {
    void refreshPushSubscriptionState();
  }, [refreshPushSubscriptionState]);

  const overdueCount = reminders.filter((reminder) => reminder.is_overdue).length;

  function urlBase64ToUint8Array(base64String: string) {
    const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
    const base64 = (base64String + padding)
      .replace(/-/g, "+")
      .replace(/_/g, "/");
    const rawData = (globalThis as any).atob(base64);
    const outputArray = new Uint8Array(rawData.length);
    for (let i = 0; i < rawData.length; ++i) {
      outputArray[i] = rawData.charCodeAt(i);
    }
    return outputArray;
  }

  async function onRefresh() {
    setIsRefreshing(true);
    await loadReminders();
  }

  async function enablePush() {
    setPushBusy(true);
    setPushError(null);
    try {
      if (nativePushSupported) {
        const result = await enableNativePush();
        setPushSubscribed(result.subscribed);
        if (result.message) {
          setPushError(t(result.message));
        }
        return;
      }

      if (!webPushSupported) return;
      const next = (await (globalThis as any).Notification.requestPermission()) as NotificationPermission;
      setPermission(next);
      if (next !== "granted") {
        setPushError("Notification permission not granted.");
        return;
      }
      if (!WEB_PUSH_VAPID_PUBLIC_KEY) {
        setPushError("Missing EXPO_PUBLIC_WEB_PUSH_VAPID_PUBLIC_KEY");
        return;
      }
      const navigatorAny = (globalThis as any).navigator;
      const reg = await navigatorAny.serviceWorker.register("/service-worker.js");
      await navigatorAny.serviceWorker.ready;
      let sub = await reg.pushManager.getSubscription();
      if (!sub) {
        sub = await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(WEB_PUSH_VAPID_PUBLIC_KEY),
        });
      }
      await api.post("/push/subscribe", sub.toJSON());
      await AsyncStorage.setItem("push.web.enabled", "true");
      await refreshPushSubscriptionState();
    } catch (e) {
      setPushError(getErrorMessage(e));
    } finally {
      setPushBusy(false);
    }
  }

  async function disablePush() {
    setPushBusy(true);
    setPushError(null);
    try {
      if (nativePushSupported) {
        await disableNativePush();
        setPushSubscribed(false);
        return;
      }

      if (!webPushSupported) return;
      const reg = await (globalThis as any).navigator.serviceWorker.getRegistration();
      const sub = reg ? await reg.pushManager.getSubscription() : null;
      if (!sub) {
        setPushSubscribed(false);
        return;
      }
      const endpoint = sub.endpoint;
      await sub.unsubscribe();
      await api.post("/push/unsubscribe", { endpoint });
      await AsyncStorage.removeItem("push.web.enabled");
      await refreshPushSubscriptionState();
    } catch (e) {
      setPushError(getErrorMessage(e));
    } finally {
      setPushBusy(false);
    }
  }

  function getReminderUrgencyText(reminder: Reminder) {
    if (reminder.is_overdue) {
      if (reminder.hours_overdue > 0) {
        return t("{{count}}h late", { count: reminder.hours_overdue });
      }
      return t("Overdue");
    }
    if (reminder.hours_remaining > 0) {
      return t("{{count}}h left", { count: reminder.hours_remaining });
    }
    return t("Due now");
  }

  return (
    <ThemedView style={styles.container} lightColor={BrandColors.canvas}>
      <BrandBackdrop />
      <Stack.Screen options={{ title: t("Reminders") }} />

      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={onRefresh} />}
      >
        <View style={styles.hero}>
          <View style={styles.heroIcon}>
            <Ionicons name="notifications" size={22} color="#FFFFFF" />
          </View>
          <View style={styles.heroCopy}>
            <ThemedText style={styles.eyebrow}>{t("Reminder center")}</ThemedText>
            <ThemedText style={styles.heroTitle}>{t("Your reminders")}</ThemedText>
            <ThemedText style={styles.heroSubtitle}>
              {remindersLoading
                ? t("Checking upcoming deadlines...")
                : overdueCount > 0
                  ? t("{{count}} overdue reminder(s) need attention.", { count: overdueCount })
                  : reminders.length > 0
                    ? t("{{count}} upcoming reminder(s).", { count: reminders.length })
                    : t("You are all caught up.")}
            </ThemedText>
          </View>
          <View style={styles.heroCount}>
            <ThemedText style={styles.heroCountValue}>
              {remindersLoading ? "—" : reminders.length}
            </ThemedText>
            <ThemedText style={styles.heroCountLabel}>{t("Open")}</ThemedText>
          </View>
        </View>

        <View style={styles.card}>
          <View style={styles.notificationRow}>
            <View style={styles.notificationCopy}>
              <ThemedText style={styles.notificationTitle}>Push notifications</ThemedText>
              <ThemedText style={styles.supportText}>
                {nativePushSupported
                  ? t("Get contribution reminders and important Cercora updates.")
                  : webPushSupported
                    ? t("Permission: {{permission}}{{subscription}}", {
                        permission,
                        subscription: pushSubscribed ? ` - ${t("subscribed")}` : "",
                      })
                    : t("Available on secure web only.")}
              </ThemedText>
            </View>
            <View style={styles.notificationControl}>
              {pushBusy ? <ActivityIndicator size="small" color={BrandColors.blueDeep} /> : null}
              <ThemedText style={styles.notificationStatus}>
                {pushSubscribed ? t("On") : t("Off")}
              </ThemedText>
              <Switch
                accessibilityLabel={t("Push notifications")}
                accessibilityHint={t("Turns push notifications on or off")}
                disabled={pushBusy || (!nativePushSupported && !webPushSupported)}
                onValueChange={(enabled) => void (enabled ? enablePush() : disablePush())}
                trackColor={{ false: BrandColors.borderStrong, true: BrandColors.blue }}
                thumbColor="#FFFFFF"
                value={pushSubscribed}
              />
            </View>
          </View>

          {pushError ? <ThemedText style={styles.errorText}>{pushError}</ThemedText> : null}
        </View>

        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <ThemedText type="subtitle">Your reminders</ThemedText>
            <ThemedText style={styles.supportText}>
              {remindersLoading
                ? "Checking feed"
                : overdueCount > 0
                  ? `${overdueCount} ${t("Overdue").toLowerCase()}`
                  : `${reminders.length} ${t("open")}`}
            </ThemedText>
          </View>

          {remindersLoading ? (
            <View style={styles.loadingRow}>
              <ActivityIndicator />
              <ThemedText style={styles.supportText}>Loading reminder feed...</ThemedText>
            </View>
          ) : remindersError ? (
            <ThemedText style={styles.errorText}>{remindersError}</ThemedText>
          ) : reminders.length === 0 ? (
            <ThemedText style={styles.supportText}>{t("No reminder")}</ThemedText>
          ) : (
            reminders.map((reminder, index) => (
              <View
                key={`${reminder.cycle_id}-${reminder.tontine_id}`}
                style={[
                  styles.reminderCard,
                  index === 0 ? styles.reminderCardPriority : null,
                  reminder.is_overdue ? styles.reminderCardOverdue : null,
                ]}
              >
                <View style={styles.reminderMetaRow}>
                  <View style={styles.reminderHeading}>
                    <ThemedText style={styles.reminderTitle}>{reminder.tontine_name}</ThemedText>
                    <ThemedText style={styles.supportText}>Cycle {reminder.cycle_number}</ThemedText>
                  </View>
                  <View
                    style={[
                      styles.reminderHoursBadge,
                      reminder.is_overdue ? styles.reminderHoursBadgeOverdue : null,
                    ]}
                  >
                    <ThemedText
                      style={[
                        styles.reminderHoursText,
                        reminder.is_overdue ? styles.reminderHoursTextOverdue : null,
                      ]}
                    >
                      {getReminderUrgencyText(reminder)}
                    </ThemedText>
                  </View>
                </View>

                <View style={styles.deadlineRow}>
                  <Ionicons name="calendar-outline" size={17} color={BrandColors.muted} />
                  <ThemedText style={styles.deadlineText}>
                    {t("Due {{date}}", { date: formatShortDate(reminder.deadline) })}
                  </ThemedText>
                </View>
              </View>
            ))
          )}
        </View>

      </ScrollView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: {
    padding: 18,
    paddingBottom: 120,
    gap: 18,
  },
  hero: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 24,
    backgroundColor: BrandColors.blueDeep,
    padding: 16,
    gap: 12,
    ...BrandShadow,
  },
  heroIcon: {
    width: 44,
    height: 44,
    borderRadius: 15,
    backgroundColor: BrandColors.blue,
    alignItems: "center",
    justifyContent: "center",
  },
  heroCopy: {
    flex: 1,
    gap: 2,
  },
  eyebrow: {
    color: "#CDD7F2",
    fontSize: 11,
    lineHeight: 15,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.8,
  },
  heroTitle: {
    color: "#FFFFFF",
    fontSize: 21,
    lineHeight: 26,
    fontWeight: "800",
  },
  heroSubtitle: {
    color: "#DEE6FA",
    fontSize: 13,
    lineHeight: 18,
  },
  heroCount: {
    minWidth: 52,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.14)",
    backgroundColor: "rgba(255,255,255,0.08)",
    paddingHorizontal: 10,
    paddingVertical: 8,
    alignItems: "center",
  },
  heroCountValue: {
    color: "#FFFFFF",
    fontSize: 18,
    lineHeight: 22,
    fontWeight: "800",
  },
  heroCountLabel: {
    color: "#D6E0FA",
    fontSize: 10,
    lineHeight: 14,
    fontWeight: "700",
  },
  card: {
    borderRadius: 28,
    backgroundColor: BrandColors.surface,
    borderWidth: 1,
    borderColor: BrandColors.border,
    padding: 18,
    gap: 14,
    ...BrandShadow,
  },
  cardHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  notificationRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 16,
  },
  notificationCopy: {
    flex: 1,
    gap: 5,
  },
  notificationTitle: {
    color: BrandColors.ink,
    fontSize: 17,
    lineHeight: 23,
    fontWeight: "700",
  },
  notificationControl: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  notificationStatus: {
    color: BrandColors.inkSoft,
    fontSize: 13,
    lineHeight: 18,
    fontWeight: "700",
  },
  supportText: {
    color: BrandColors.muted,
    fontSize: 14,
    lineHeight: 20,
  },
  deadlineRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
  },
  deadlineText: {
    color: BrandColors.inkSoft,
    fontSize: 13,
    lineHeight: 18,
    fontWeight: "600",
  },
  metricGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  metricTile: {
    minWidth: 110,
    flexGrow: 1,
    borderRadius: 18,
    backgroundColor: "rgba(255,255,255,0.88)",
    borderWidth: 1,
    borderColor: BrandColors.border,
    padding: 14,
    gap: 4,
  },
  metricTileCompact: {
    minWidth: 110,
    flexGrow: 1,
    borderRadius: 16,
    backgroundColor: "rgba(255,255,255,0.78)",
    borderWidth: 1,
    borderColor: BrandColors.border,
    padding: 12,
    gap: 2,
  },
  metricValue: {
    color: BrandColors.ink,
    fontSize: 20,
    lineHeight: 24,
    fontWeight: "800",
    textTransform: "capitalize",
  },
  metricValueCompact: {
    color: BrandColors.ink,
    fontSize: 16,
    lineHeight: 20,
    fontWeight: "800",
  },
  metricLabel: {
    color: BrandColors.muted,
    fontSize: 13,
    lineHeight: 18,
  },
  actionsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  primaryButton: {
    flex: 1,
    minWidth: 150,
    borderRadius: 16,
    backgroundColor: BrandColors.blueDeep,
    paddingVertical: 14,
    alignItems: "center",
    ...BrandShadow,
  },
  primaryButtonText: {
    color: "#FFFFFF",
    fontWeight: "800",
    fontSize: 14,
  },
  secondaryButton: {
    flex: 1,
    minWidth: 150,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: BrandColors.borderStrong,
    backgroundColor: BrandColors.surfaceStrong,
    paddingVertical: 14,
    alignItems: "center",
  },
  secondaryButtonText: {
    color: BrandColors.inkSoft,
    fontWeight: "800",
    fontSize: 14,
  },
  loadingRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  emptyState: {
    gap: 8,
  },
  emptyTitle: {
    color: BrandColors.ink,
    fontSize: 18,
    lineHeight: 24,
    fontWeight: "800",
  },
  reminderCard: {
    borderRadius: 18,
    backgroundColor: "rgba(255,255,255,0.74)",
    borderWidth: 1,
    borderColor: BrandColors.border,
    padding: 14,
    gap: 10,
  },
  reminderCardPriority: {
    backgroundColor: "rgba(46,207,227,0.08)",
    borderColor: BrandColors.borderStrong,
  },
  reminderCardOverdue: {
    backgroundColor: BrandColors.dangerBg,
    borderColor: BrandColors.dangerBorder,
  },
  reminderMetaRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 12,
  },
  reminderHeading: {
    flex: 1,
    gap: 2,
  },
  reminderTitle: {
    color: BrandColors.ink,
    fontSize: 16,
    lineHeight: 22,
    fontWeight: "800",
  },
  reminderHoursBadge: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: BrandColors.borderStrong,
    backgroundColor: "rgba(16,36,72,0.92)",
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  reminderHoursText: {
    color: "#FFFFFF",
    fontSize: 12,
    lineHeight: 16,
    fontWeight: "800",
  },
  reminderHoursBadgeOverdue: {
    borderColor: BrandColors.dangerBorder,
    backgroundColor: "#FFFFFF",
  },
  reminderHoursTextOverdue: {
    color: BrandColors.dangerText,
  },
  helperCard: {
    borderRadius: 18,
    backgroundColor: "rgba(255,255,255,0.8)",
    borderWidth: 1,
    borderColor: BrandColors.borderStrong,
    padding: 14,
    gap: 4,
  },
  helperTitle: {
    color: BrandColors.ink,
    fontSize: 15,
    lineHeight: 20,
    fontWeight: "800",
  },
  previewCard: {
    borderRadius: 18,
    backgroundColor: "rgba(255,255,255,0.78)",
    borderWidth: 1,
    borderColor: BrandColors.border,
    padding: 14,
    gap: 8,
  },
  previewBadge: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: BrandColors.borderStrong,
    backgroundColor: "rgba(46,207,227,0.12)",
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  previewBadgeText: {
    color: BrandColors.blue,
    fontSize: 12,
    lineHeight: 16,
    fontWeight: "800",
  },
  errorText: {
    color: "#B42318",
    fontWeight: "700",
    fontSize: 14,
  },
});
