import AsyncStorage from "@react-native-async-storage/async-storage";
import { useFocusEffect } from "@react-navigation/native";
import { Stack } from "expo-router";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  View,
} from "react-native";

import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { api } from "@/hooks/api-client";
import { useAuth } from "@/hooks/use-auth";
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
};

type AdminReminderPreview = {
  window_start: string;
  window_end: string;
  lookahead_hours: number;
  cycles_count: number;
  targets_count: number;
  cycles: Array<{
    cycle_id: number;
    tontine_id: number;
    tontine_name: string;
    cycle_number: number;
    deadline: string;
    targets_count: number;
    targets: Array<{
      membership_id: number;
      user_id: number;
      name: string;
      phone: string;
    }>;
  }>;
};

type AdminReminderSendResult = {
  sms_configured: boolean;
  cycles_checked: number;
  cycles_marked: number;
  sms_sent: number;
  sms_failed: number;
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

export default function RemindersScreen() {
  const { user } = useAuth();
  const { t } = useI18n();

  const [reminders, setReminders] = useState<Reminder[]>([]);
  const [remindersError, setRemindersError] = useState<string | null>(null);
  const [remindersLoading, setRemindersLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const [adminReminderPreview, setAdminReminderPreview] =
    useState<AdminReminderPreview | null>(null);
  const [adminReminderResult, setAdminReminderResult] =
    useState<AdminReminderSendResult | null>(null);
  const [adminLoading, setAdminLoading] = useState(false);
  const [adminActionBusy, setAdminActionBusy] = useState(false);
  const [adminError, setAdminError] = useState<string | null>(null);

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
      setRemindersError(getErrorMessage(e));
      setReminders([]);
    } finally {
      setRemindersLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  const loadAdminData = useCallback(async () => {
    if (!user?.is_global_admin) {
      setAdminReminderPreview(null);
      setAdminReminderResult(null);
      setAdminError(null);
      setAdminLoading(false);
      return;
    }

    setAdminLoading(true);
    setAdminError(null);
    try {
      const previewRes = await api.get<AdminReminderPreview>(
        "/admin/stats/reminders/pre-deadline/preview"
      );
      setAdminReminderPreview(previewRes.data);
    } catch (e) {
      setAdminError(getErrorMessage(e));
      setAdminReminderPreview(null);
    } finally {
      setAdminLoading(false);
    }
  }, [user?.is_global_admin]);

  useFocusEffect(
    useCallback(() => {
      void loadReminders();
      void loadAdminData();
    }, [loadAdminData, loadReminders])
  );

  useEffect(() => {
    if (!webPushSupported) return;
    setPermission(
      (globalThis as any).Notification.permission as NotificationPermission
    );
  }, [webPushSupported]);

  const refreshPushSubscriptionState = useCallback(async () => {
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
  }, [webPushSupported]);

  useEffect(() => {
    void refreshPushSubscriptionState();
  }, [refreshPushSubscriptionState]);

  const nextReminder = reminders[0] ?? null;

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
    await Promise.all([loadReminders(), loadAdminData()]);
  }

  async function enableWebPush() {
    if (!webPushSupported) return;
    setPushBusy(true);
    setPushError(null);
    try {
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

  async function disableWebPush() {
    if (!webPushSupported) return;
    setPushBusy(true);
    setPushError(null);
    try {
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

  async function sendTestPush() {
    if (!webPushSupported) return;
    setPushBusy(true);
    setPushError(null);
    try {
      await api.post("/push/test");
    } catch (e) {
      setPushError(getErrorMessage(e));
    } finally {
      setPushBusy(false);
    }
  }

  async function sendAdminReminders() {
    setAdminActionBusy(true);
    setAdminError(null);
    try {
      const res = await api.post<AdminReminderSendResult>(
        "/admin/stats/reminders/pre-deadline/send"
      );
      setAdminReminderResult(res.data);
      await loadAdminData();
    } catch (e) {
      setAdminError(getErrorMessage(e));
    } finally {
      setAdminActionBusy(false);
    }
  }

  return (
    <ThemedView style={styles.container} lightColor="#F4F7FB">
      <Stack.Screen options={{ title: t("Reminders") }} />

      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={onRefresh} />}
      >
        <View style={styles.hero}>
          <View style={styles.heroGlowTop} />
          <View style={styles.heroGlowBottom} />

          <ThemedText style={styles.eyebrow}>Reminder center</ThemedText>
          <ThemedText style={styles.heroTitle}>Stay ahead of every deadline</ThemedText>
          <ThemedText style={styles.heroSubtitle}>
            Manage your upcoming contribution reminders, web push delivery, and platform reminder operations in one place.
          </ThemedText>

          <View style={styles.heroBadges}>
            <View style={styles.heroBadgeWarm}>
              <ThemedText style={styles.heroBadgeWarmText}>
                {remindersLoading ? "Loading" : `${reminders.length} queued`}
              </ThemedText>
            </View>
            <View style={styles.heroBadgeCool}>
              <ThemedText style={styles.heroBadgeCoolText}>
                {permission === "unsupported"
                  ? "Web only"
                  : pushSubscribed
                    ? "Push on"
                    : "Push off"}
              </ThemedText>
            </View>
            {user?.is_global_admin ? (
              <View style={styles.heroBadgeNeutral}>
                <ThemedText style={styles.heroBadgeNeutralText}>Global admin</ThemedText>
              </View>
            ) : null}
          </View>

          <View style={styles.heroStats}>
            <View style={styles.heroStat}>
              <ThemedText style={styles.heroStatValue}>
                {nextReminder ? `${nextReminder.hours_remaining}h` : "Clear"}
              </ThemedText>
              <ThemedText style={styles.heroStatLabel}>Next urgency</ThemedText>
            </View>
            <View style={styles.heroStat}>
              <ThemedText style={styles.heroStatValue}>
                {nextReminder ? formatShortDate(nextReminder.deadline) : "No due date"}
              </ThemedText>
              <ThemedText style={styles.heroStatLabel}>Next deadline</ThemedText>
            </View>
          </View>
        </View>

        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <ThemedText type="subtitle">Push notifications</ThemedText>
            <ThemedText style={styles.supportText}>
              {webPushSupported ? "Secure web delivery" : "Available on secure web only"}
            </ThemedText>
          </View>

          <View style={styles.metricGrid}>
            <View style={styles.metricTile}>
              <ThemedText style={styles.metricValue}>
                {permission === "unsupported" ? "N/A" : permission}
              </ThemedText>
              <ThemedText style={styles.metricLabel}>Permission</ThemedText>
            </View>
            <View style={styles.metricTile}>
              <ThemedText style={styles.metricValue}>{pushSubscribed ? "Subscribed" : "Idle"}</ThemedText>
              <ThemedText style={styles.metricLabel}>Delivery state</ThemedText>
            </View>
          </View>

          <View style={styles.actionsRow}>
            <Pressable
              style={styles.secondaryButton}
              disabled={pushBusy || !webPushSupported}
              onPress={() => void (pushSubscribed ? disableWebPush() : enableWebPush())}
            >
              <ThemedText style={styles.secondaryButtonText}>
                {pushBusy ? "Working..." : pushSubscribed ? "Disable push" : "Enable push"}
              </ThemedText>
            </Pressable>

            {webPushSupported && permission === "granted" && pushSubscribed ? (
              <Pressable
                style={styles.primaryButton}
                disabled={pushBusy}
                onPress={() => void sendTestPush()}
              >
                <ThemedText style={styles.primaryButtonText}>
                  {pushBusy ? "Sending..." : "Send test push"}
                </ThemedText>
              </Pressable>
            ) : null}
          </View>

          {pushError ? <ThemedText style={styles.errorText}>{pushError}</ThemedText> : null}
        </View>

        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <ThemedText type="subtitle">Your reminders</ThemedText>
            <ThemedText style={styles.supportText}>
              {remindersLoading ? "Checking feed" : `${reminders.length} upcoming`}
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
            <View style={styles.emptyState}>
              <ThemedText style={styles.emptyTitle}>Nothing urgent right now</ThemedText>
              <ThemedText style={styles.supportText}>
                You are caught up. New contribution reminders will show here automatically.
              </ThemedText>
            </View>
          ) : (
            reminders.map((reminder, index) => (
              <View
                key={`${reminder.cycle_id}-${reminder.tontine_id}`}
                style={[
                  styles.reminderCard,
                  index === 0 ? styles.reminderCardPriority : null,
                ]}
              >
                <View style={styles.reminderMetaRow}>
                  <View style={styles.reminderHeading}>
                    <ThemedText style={styles.reminderTitle}>{reminder.tontine_name}</ThemedText>
                    <ThemedText style={styles.supportText}>Cycle {reminder.cycle_number}</ThemedText>
                  </View>
                  <View style={styles.reminderHoursBadge}>
                    <ThemedText style={styles.reminderHoursText}>
                      {reminder.hours_remaining}h left
                    </ThemedText>
                  </View>
                </View>

                <View style={styles.metricGrid}>
                  <View style={styles.metricTileCompact}>
                    <ThemedText style={styles.metricValueCompact}>
                      {formatShortDate(reminder.deadline)}
                    </ThemedText>
                    <ThemedText style={styles.metricLabel}>Deadline</ThemedText>
                  </View>
                  <View style={styles.metricTileCompact}>
                    <ThemedText style={styles.metricValueCompact}>{reminder.tontine_id}</ThemedText>
                    <ThemedText style={styles.metricLabel}>Tontine ID</ThemedText>
                  </View>
                </View>
              </View>
            ))
          )}
        </View>

        {user?.is_global_admin ? (
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <ThemedText type="subtitle">Admin reminder operations</ThemedText>
              <ThemedText style={styles.supportText}>Platform-wide delivery controls</ThemedText>
            </View>

            {adminLoading ? (
              <View style={styles.loadingRow}>
                <ActivityIndicator />
                <ThemedText style={styles.supportText}>Loading admin reminder preview...</ThemedText>
              </View>
            ) : adminError ? (
              <ThemedText style={styles.errorText}>{adminError}</ThemedText>
            ) : adminReminderPreview ? (
              <>
                <View style={styles.metricGrid}>
                  <View style={styles.metricTile}>
                    <ThemedText style={styles.metricValue}>{adminReminderPreview.cycles_count}</ThemedText>
                    <ThemedText style={styles.metricLabel}>Cycles in window</ThemedText>
                  </View>
                  <View style={styles.metricTile}>
                    <ThemedText style={styles.metricValue}>{adminReminderPreview.targets_count}</ThemedText>
                    <ThemedText style={styles.metricLabel}>Members targeted</ThemedText>
                  </View>
                </View>

                <ThemedText style={styles.supportText}>
                  Window {formatShortDate(adminReminderPreview.window_start)} to{" "}
                  {formatShortDate(adminReminderPreview.window_end)}
                </ThemedText>

                <Pressable
                  style={styles.primaryButton}
                  disabled={adminActionBusy}
                  onPress={() => void sendAdminReminders()}
                >
                  <ThemedText style={styles.primaryButtonText}>
                    {adminActionBusy ? "Sending..." : "Send reminder batch"}
                  </ThemedText>
                </Pressable>

                {adminReminderResult ? (
                  <View style={styles.helperCard}>
                    <ThemedText style={styles.helperTitle}>Last batch result</ThemedText>
                    <ThemedText style={styles.supportText}>
                      SMS configured: {adminReminderResult.sms_configured ? "Yes" : "No"}
                    </ThemedText>
                    <ThemedText style={styles.supportText}>
                      Cycles checked: {adminReminderResult.cycles_checked}
                    </ThemedText>
                    <ThemedText style={styles.supportText}>
                      Cycles marked: {adminReminderResult.cycles_marked}
                    </ThemedText>
                    <ThemedText style={styles.supportText}>
                      SMS sent: {adminReminderResult.sms_sent}
                    </ThemedText>
                    <ThemedText style={styles.supportText}>
                      SMS failed: {adminReminderResult.sms_failed}
                    </ThemedText>
                  </View>
                ) : null}

                {adminReminderPreview.cycles.length === 0 ? (
                  <ThemedText style={styles.supportText}>No reminder preview available.</ThemedText>
                ) : (
                  adminReminderPreview.cycles.slice(0, 6).map((cycle) => (
                    <View key={cycle.cycle_id} style={styles.previewCard}>
                      <View style={styles.reminderMetaRow}>
                        <View style={styles.reminderHeading}>
                          <ThemedText style={styles.reminderTitle}>{cycle.tontine_name}</ThemedText>
                          <ThemedText style={styles.supportText}>Cycle {cycle.cycle_number}</ThemedText>
                        </View>
                        <View style={styles.previewBadge}>
                          <ThemedText style={styles.previewBadgeText}>
                            {cycle.targets_count} targets
                          </ThemedText>
                        </View>
                      </View>
                      <ThemedText style={styles.supportText}>
                        Due {formatShortDate(cycle.deadline)}
                      </ThemedText>
                      <ThemedText style={styles.supportText}>
                        {cycle.targets
                          .slice(0, 3)
                          .map((target) => target.name)
                          .join(", ")}
                        {cycle.targets_count > 3 ? ` +${cycle.targets_count - 3} more` : ""}
                      </ThemedText>
                    </View>
                  ))
                )}
              </>
            ) : (
              <ThemedText style={styles.supportText}>No preview data available.</ThemedText>
            )}
          </View>
        ) : null}
      </ScrollView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: {
    padding: 18,
    paddingBottom: 28,
    gap: 18,
  },
  hero: {
    position: "relative",
    overflow: "hidden",
    borderRadius: 28,
    backgroundColor: "#21304F",
    padding: 22,
    gap: 14,
  },
  heroGlowTop: {
    position: "absolute",
    top: -30,
    right: -18,
    width: 148,
    height: 148,
    borderRadius: 999,
    backgroundColor: "#4B68A8",
    opacity: 0.24,
  },
  heroGlowBottom: {
    position: "absolute",
    left: -12,
    bottom: -56,
    width: 148,
    height: 148,
    borderRadius: 999,
    backgroundColor: "#9DD1C4",
    opacity: 0.16,
  },
  eyebrow: {
    color: "#CDD7F2",
    fontSize: 12,
    lineHeight: 16,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 1.1,
  },
  heroTitle: {
    color: "#FFFFFF",
    fontSize: 30,
    lineHeight: 34,
    fontWeight: "800",
  },
  heroSubtitle: {
    color: "#DEE6FA",
    fontSize: 15,
    lineHeight: 22,
  },
  heroBadges: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  heroBadgeWarm: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "rgba(254, 215, 170, 0.38)",
    backgroundColor: "rgba(255, 247, 237, 0.12)",
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  heroBadgeWarmText: {
    color: "#FFE7CC",
    fontSize: 12,
    lineHeight: 16,
    fontWeight: "800",
  },
  heroBadgeCool: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "rgba(171, 239, 198, 0.38)",
    backgroundColor: "rgba(236, 253, 243, 0.12)",
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  heroBadgeCoolText: {
    color: "#D9FBE8",
    fontSize: 12,
    lineHeight: 16,
    fontWeight: "800",
  },
  heroBadgeNeutral: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.16)",
    backgroundColor: "rgba(255, 255, 255, 0.08)",
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  heroBadgeNeutralText: {
    color: "#EFF6FF",
    fontSize: 12,
    lineHeight: 16,
    fontWeight: "800",
  },
  heroStats: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  heroStat: {
    minWidth: 100,
    flexGrow: 1,
    borderRadius: 18,
    backgroundColor: "rgba(255, 255, 255, 0.08)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.12)",
    padding: 14,
    gap: 4,
  },
  heroStatValue: {
    color: "#FFFFFF",
    fontSize: 22,
    lineHeight: 26,
    fontWeight: "800",
  },
  heroStatLabel: {
    color: "#D6E0FA",
    fontSize: 13,
    lineHeight: 18,
  },
  card: {
    borderRadius: 24,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E6ECF5",
    padding: 16,
    gap: 14,
  },
  cardHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  supportText: {
    color: "#475467",
    fontSize: 14,
    lineHeight: 20,
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
    backgroundColor: "#F8FAFC",
    borderWidth: 1,
    borderColor: "#E7EEF7",
    padding: 14,
    gap: 4,
  },
  metricTileCompact: {
    minWidth: 110,
    flexGrow: 1,
    borderRadius: 16,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E2E8F0",
    padding: 12,
    gap: 2,
  },
  metricValue: {
    color: "#0F172A",
    fontSize: 20,
    lineHeight: 24,
    fontWeight: "800",
    textTransform: "capitalize",
  },
  metricValueCompact: {
    color: "#0F172A",
    fontSize: 16,
    lineHeight: 20,
    fontWeight: "800",
  },
  metricLabel: {
    color: "#667085",
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
    backgroundColor: "#0A2A66",
    paddingVertical: 14,
    alignItems: "center",
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
    borderColor: "#0A2A66",
    backgroundColor: "#FFFFFF",
    paddingVertical: 14,
    alignItems: "center",
  },
  secondaryButtonText: {
    color: "#0A2A66",
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
    color: "#101828",
    fontSize: 18,
    lineHeight: 24,
    fontWeight: "800",
  },
  reminderCard: {
    borderRadius: 18,
    backgroundColor: "#F8FAFC",
    borderWidth: 1,
    borderColor: "#E7EEF7",
    padding: 14,
    gap: 10,
  },
  reminderCardPriority: {
    backgroundColor: "#FFF7ED",
    borderColor: "#FED7AA",
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
    color: "#101828",
    fontSize: 16,
    lineHeight: 22,
    fontWeight: "800",
  },
  reminderHoursBadge: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#FEDF89",
    backgroundColor: "#FFFAEB",
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  reminderHoursText: {
    color: "#B54708",
    fontSize: 12,
    lineHeight: 16,
    fontWeight: "800",
  },
  helperCard: {
    borderRadius: 18,
    backgroundColor: "#F8FAFC",
    borderWidth: 1,
    borderColor: "#E7EEF7",
    padding: 14,
    gap: 4,
  },
  helperTitle: {
    color: "#101828",
    fontSize: 15,
    lineHeight: 20,
    fontWeight: "800",
  },
  previewCard: {
    borderRadius: 18,
    backgroundColor: "#FBFCFE",
    borderWidth: 1,
    borderColor: "#E8EDF5",
    padding: 14,
    gap: 8,
  },
  previewBadge: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#B2DDFF",
    backgroundColor: "#EFF8FF",
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  previewBadgeText: {
    color: "#175CD3",
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
