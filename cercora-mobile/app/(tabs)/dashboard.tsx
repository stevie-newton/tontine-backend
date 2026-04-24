import AsyncStorage from "@react-native-async-storage/async-storage";
import { useFocusEffect } from "@react-navigation/native";
import axios from "axios";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
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
import { useAuth } from "@/hooks/use-auth";
import { getErrorMessage } from "@/hooks/error-utils";
import { useResponsiveLayout } from "@/hooks/use-responsive-layout";
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

type AdminOverview = {
  users: {
    total: number;
    new_last_7_days: number;
    new_last_30_days: number;
    global_admins: number;
  };
  tontines: {
    total: number;
    by_status: {
      draft: number;
      active: number;
      completed: number;
    };
    created_last_7_days: number;
    created_last_30_days: number;
  };
  financial: {
    contributions_last_30_days: number;
    contribution_volume_last_30_days: number;
    payout_volume_last_30_days: number;
    open_debts_count: number;
    open_debts_amount: number;
    repaid_debts_count: number;
    repaid_debts_amount: number;
  };
  risk: {
    cycles_blocked_count: number;
    members_with_open_debt: number;
    repeated_defaulters: number;
  };
};

type AdminTontineStats = {
  total: number;
  by_status: {
    draft: number;
    active: number;
    completed: number;
  };
  created_last_7_days: number;
  created_last_30_days: number;
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

function formatAmount(value: number) {
  return new Intl.NumberFormat(getCurrentLocale(), {
    maximumFractionDigits: 2,
  }).format(value);
}

function formatCompactNumber(value: number) {
  return new Intl.NumberFormat(getCurrentLocale(), {
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(value);
}

function isMissingReminderFeedError(error: unknown) {
  return (
    (axios.isAxiosError(error) && error.response?.status === 404) ||
    (error instanceof Error && error.message.trim().toLowerCase() === "not found") ||
    (typeof error === "string" && error.trim().toLowerCase() === "not found")
  );
}

export default function Dashboard() {
  const { user } = useAuth();
  const { t } = useI18n();
  const layout = useResponsiveLayout();
  const nativePushSupported = NATIVE_PUSH_SUPPORTED;

  const [isChecking, setIsChecking] = useState(true);
  const [isHealthy, setIsHealthy] = useState<boolean | null>(null);
  const [backendError, setBackendError] = useState<string | null>(null);
  const [reminders, setReminders] = useState<Reminder[]>([]);
  const [remindersError, setRemindersError] = useState<string | null>(null);
  const [remindersLoading, setRemindersLoading] = useState(true);
  const [adminOverview, setAdminOverview] = useState<AdminOverview | null>(null);
  const [adminTontineStats, setAdminTontineStats] = useState<AdminTontineStats | null>(
    null
  );
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

  const checkBackend = useCallback(async () => {
    setIsChecking(true);
    setBackendError(null);
    try {
      await api.get("/health");
      setIsHealthy(true);
    } catch (e) {
      setIsHealthy(false);
      setBackendError(getErrorMessage(e));
    } finally {
      setIsChecking(false);
    }
  }, []);

  const loadReminders = useCallback(async () => {
    setRemindersLoading(true);
    setRemindersError(null);
    try {
      const res = await api.get<{ reminders: Reminder[] }>(
        "/reminders/pre-deadline/me"
      );
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
    }
  }, []);

  const loadAdminData = useCallback(async () => {
    if (!user?.is_global_admin) {
      setAdminOverview(null);
      setAdminTontineStats(null);
      setAdminReminderPreview(null);
      setAdminReminderResult(null);
      setAdminError(null);
      setAdminLoading(false);
      return;
    }

    setAdminLoading(true);
    setAdminError(null);
    try {
      const [overviewRes, tontinesRes, previewRes] = await Promise.all([
        api.get<AdminOverview>("/admin/stats/overview"),
        api.get<AdminTontineStats>("/admin/stats/tontines"),
        api.get<AdminReminderPreview>(
          "/admin/stats/reminders/pre-deadline/preview"
        ),
      ]);
      setAdminOverview(overviewRes.data);
      setAdminTontineStats(tontinesRes.data);
      setAdminReminderPreview(previewRes.data);
    } catch (e) {
      setAdminError(getErrorMessage(e));
      setAdminOverview(null);
      setAdminTontineStats(null);
      setAdminReminderPreview(null);
    } finally {
      setAdminLoading(false);
    }
  }, [user?.is_global_admin]);

  useFocusEffect(
    useCallback(() => {
      void checkBackend();
      void loadReminders();
      void loadAdminData();
    }, [checkBackend, loadAdminData, loadReminders])
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

  const nextReminder = reminders[0] ?? null;
  const overdueCount = reminders.filter((reminder) => reminder.is_overdue).length;
  const upcomingCount = reminders.length - overdueCount;
  const greetingName = user?.name?.split(" ")[0] ?? t("there");
  const reminderSummary = useMemo(() => {
    if (remindersLoading) return t("Checking your upcoming contribution windows.");
    if (remindersError) return t("Reminder feed needs attention right now.");
    if (!reminders.length) return t("You are clear for now. No outstanding reminders.");
    if (overdueCount > 0 && upcomingCount > 0) {
      return t("{{overdue}} overdue and {{upcoming}} upcoming reminders.", {
        overdue: overdueCount,
        upcoming: upcomingCount,
      });
    }
    if (overdueCount === 1) return t("1 overdue reminder needs attention.");
    if (overdueCount > 1) {
      return t("{{count}} overdue reminders need attention.", { count: overdueCount });
    }
    return reminders.length === 1
      ? t("1 reminder waiting across your groups.")
      : t("{{count}} reminders waiting across your groups.", { count: reminders.length });
  }, [overdueCount, upcomingCount, reminders.length, remindersError, remindersLoading, t]);

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
    <ThemedView style={styles.container} lightColor={BrandColors.canvas}>
      <BrandBackdrop />
      <ScrollView contentContainerStyle={styles.content}>
        <View
          style={[
            styles.page,
            layout.maxWidth ? { maxWidth: layout.maxWidth } : null,
          ]}
        >
        <View style={styles.hero}>
          <View style={styles.heroGlowTop} />
          <View style={styles.heroGlowBottom} />

          <View style={styles.heroHeader}>
            <View style={styles.heroTitleWrap}>
              <ThemedText style={styles.eyebrow}>Cercora dashboard</ThemedText>
              <ThemedText style={styles.heroTitle}>
                {t("Welcome back, {{name}}", { name: greetingName })}
              </ThemedText>
              <ThemedText style={styles.heroSubtitle}>{reminderSummary}</ThemedText>
            </View>
            <View style={styles.heroPills}>
              {user?.is_global_admin ? (
                <View style={[styles.heroPill, styles.heroPillAdmin]}>
                  <ThemedText style={[styles.heroPillText, styles.heroPillTextAdmin]}>
                    Global admin
                  </ThemedText>
                </View>
              ) : null}
            </View>
          </View>

          <View style={styles.heroStats}>
            <View style={styles.heroStatCard}>
              <ThemedText style={styles.heroStatValue}>
                {remindersLoading ? "..." : String(reminders.length)}
              </ThemedText>
              <ThemedText style={styles.heroStatLabel}>Pending reminders</ThemedText>
            </View>
            <View style={styles.heroStatCard}>
              <ThemedText style={styles.heroStatValue}>
                {nativePushSupported
                  ? pushSubscribed
                    ? "On"
                    : "Off"
                  : permission === "unsupported"
                  ? "Web only"
                  : pushSubscribed
                    ? "On"
                    : "Off"}
              </ThemedText>
              <ThemedText style={styles.heroStatLabel}>Push status</ThemedText>
            </View>
            <View style={styles.heroStatCard}>
              <ThemedText style={styles.heroStatValue}>
                {nextReminder ? getReminderUrgencyText(nextReminder) : "Clear"}
              </ThemedText>
              <ThemedText style={styles.heroStatLabel}>Next deadline</ThemedText>
            </View>
          </View>
        </View>

        <View style={[styles.tabletSectionGrid, layout.isTablet ? styles.tabletSectionGridOn : null]}>
          <View style={[styles.section, layout.isTablet ? styles.tabletSectionColumn : null]}>
            <View style={styles.sectionHeader}>
              <ThemedText type="subtitle">System pulse</ThemedText>
              <ThemedText style={styles.sectionCaption}>Live health and delivery controls</ThemedText>
            </View>

            <View style={styles.card}>
            <View style={styles.cardTopRow}>
              <View>
                <ThemedText style={styles.cardLabel}>Push notifications</ThemedText>
                <ThemedText style={styles.supportText}>
                  {nativePushSupported
                    ? t("Native mobile delivery")
                    : webPushSupported
                    ? t("Permission: {{permission}}{{subscription}}", {
                        permission,
                        subscription: pushSubscribed ? ` - ${t("subscribed")}` : "",
                      })
                    : t("Available on secure web only.")}
                </ThemedText>
              </View>
              <Pressable
                style={styles.actionButtonGhost}
                disabled={pushBusy || (!nativePushSupported && !webPushSupported)}
                onPress={() =>
                  void (pushSubscribed ? disablePush() : enablePush())
                }
              >
                <ThemedText style={styles.actionButtonGhostText}>
                  {pushBusy ? "..." : pushSubscribed ? "Disable" : "Enable"}
                </ThemedText>
              </Pressable>
            </View>

            {pushError ? <ThemedText style={styles.errorText}>{pushError}</ThemedText> : null}
            </View>
          </View>

          <View style={[styles.section, layout.isTablet ? styles.tabletSectionColumn : null]}>
            <View style={styles.sectionHeader}>
              <ThemedText type="subtitle">Your reminders</ThemedText>
              <ThemedText style={styles.sectionCaption}>Upcoming contributions that need attention</ThemedText>
            </View>

            <View style={styles.card}>
            {remindersLoading ? (
              <View style={styles.loadingRow}>
                <ActivityIndicator />
                <ThemedText style={styles.supportText}>Loading reminder feed...</ThemedText>
              </View>
            ) : remindersError ? (
              remindersError.trim().toLowerCase() === "not found" ? null : (
                <ThemedText style={styles.errorText}>{remindersError}</ThemedText>
              )
            ) : reminders.length === 0 ? (
              <ThemedText style={styles.supportText}>{t("No reminder")}</ThemedText>
            ) : (
              reminders.slice(0, 5).map((reminder, index) => (
                <View
                  key={reminder.cycle_id}
                  style={[
                    styles.reminderCard,
                    index === 0 ? styles.reminderCardPriority : null,
                    reminder.is_overdue ? styles.reminderCardOverdue : null,
                  ]}
                >
                  <View style={styles.reminderMetaRow}>
                    <ThemedText style={styles.reminderTitle}>
                      {reminder.tontine_name}
                    </ThemedText>
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
                  <ThemedText style={styles.supportText}>
                    Cycle {reminder.cycle_number}
                  </ThemedText>
                  <ThemedText style={styles.supportText}>
                    Due {formatShortDate(reminder.deadline)}
                  </ThemedText>
                </View>
              ))
            )}
            </View>
          </View>
        </View>

        {user?.is_global_admin ? (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <ThemedText type="subtitle">Admin command</ThemedText>
              <ThemedText style={styles.sectionCaption}>Operational visibility for the whole platform</ThemedText>
            </View>

            <View style={[styles.card, styles.adminCard]}>
              <View style={styles.cardTopRow}>
                <View>
                  <ThemedText style={styles.cardLabel}>Global admin session</ThemedText>
                  <ThemedText style={styles.supportText}>
                    Platform-wide risk, growth, and reminder controls
                  </ThemedText>
                </View>
                <View style={[styles.statusBadge, styles.statusBadgeSuccess]}>
                  <ThemedText
                    style={[styles.statusBadgeText, styles.statusBadgeTextSuccess]}
                  >
                    Active
                  </ThemedText>
                </View>
              </View>

              {adminLoading ? (
                <View style={styles.loadingRow}>
                  <ActivityIndicator />
                  <ThemedText style={styles.supportText}>Loading admin data...</ThemedText>
                </View>
              ) : adminError ? (
                <ThemedText style={styles.errorText}>{adminError}</ThemedText>
              ) : adminOverview ? (
                <>
                  <View style={styles.metricGrid}>
                    <View style={styles.metricPanel}>
                      <ThemedText style={styles.metricValue}>
                        {formatCompactNumber(adminOverview.users.total)}
                      </ThemedText>
                      <ThemedText style={styles.metricLabel}>Users</ThemedText>
                    </View>
                    <View style={styles.metricPanel}>
                      <ThemedText style={styles.metricValue}>
                        {formatCompactNumber(adminOverview.tontines.total)}
                      </ThemedText>
                      <ThemedText style={styles.metricLabel}>Tontines</ThemedText>
                    </View>
                    <View style={styles.metricPanel}>
                      <ThemedText style={styles.metricValue}>
                        {formatCompactNumber(adminOverview.financial.open_debts_count)}
                      </ThemedText>
                      <ThemedText style={styles.metricLabel}>Open debts</ThemedText>
                    </View>
                    <View style={styles.metricPanel}>
                      <ThemedText style={styles.metricValue}>
                        {formatCompactNumber(adminOverview.risk.cycles_blocked_count)}
                      </ThemedText>
                      <ThemedText style={styles.metricLabel}>Blocked cycles</ThemedText>
                    </View>
                  </View>

                  <View style={styles.adminFacts}>
                    <ThemedText style={styles.supportText}>
                      {t("New users 7d: {{count}}", { count: adminOverview.users.new_last_7_days })}
                    </ThemedText>
                    <ThemedText style={styles.supportText}>
                      {t("New tontines 7d: {{count}}", {
                        count: adminOverview.tontines.created_last_7_days,
                      })}
                    </ThemedText>
                    <ThemedText style={styles.supportText}>
                      {t("Contribution volume 30d: {{amount}}", {
                        amount: formatAmount(adminOverview.financial.contribution_volume_last_30_days),
                      })}
                    </ThemedText>
                    <ThemedText style={styles.supportText}>
                      {t("Payout volume 30d: {{amount}}", {
                        amount: formatAmount(adminOverview.financial.payout_volume_last_30_days),
                      })}
                    </ThemedText>
                  </View>

                  {adminTontineStats ? (
                    <View style={styles.subsection}>
                      <ThemedText style={styles.subsectionTitle}>Tontine status mix</ThemedText>
                      <View style={styles.metricGrid}>
                        <View style={styles.metricPanel}>
                          <ThemedText style={styles.metricValue}>
                            {adminTontineStats.by_status.draft}
                          </ThemedText>
                          <ThemedText style={styles.metricLabel}>Draft</ThemedText>
                        </View>
                        <View style={styles.metricPanel}>
                          <ThemedText style={styles.metricValue}>
                            {adminTontineStats.by_status.active}
                          </ThemedText>
                          <ThemedText style={styles.metricLabel}>Active</ThemedText>
                        </View>
                        <View style={styles.metricPanel}>
                          <ThemedText style={styles.metricValue}>
                            {adminTontineStats.by_status.completed}
                          </ThemedText>
                          <ThemedText style={styles.metricLabel}>Completed</ThemedText>
                        </View>
                      </View>
                    </View>
                  ) : null}

                  <View style={styles.subsection}>
                    <View style={styles.cardTopRow}>
                      <View>
                        <ThemedText style={styles.subsectionTitle}>Reminder operations</ThemedText>
                        <ThemedText style={styles.supportText}>
                          Preview and trigger pre-deadline SMS from mobile
                        </ThemedText>
                      </View>
                      <View style={styles.actionsRow}>
                        <Pressable
                          style={styles.actionButtonGhost}
                          disabled={adminLoading || adminActionBusy}
                          onPress={() => void loadAdminData()}
                        >
                          <ThemedText style={styles.actionButtonGhostText}>
                            {adminLoading ? "..." : "Refresh"}
                          </ThemedText>
                        </Pressable>
                        <Pressable
                          style={styles.actionButtonPrimary}
                          disabled={adminActionBusy}
                          onPress={() => void sendAdminReminders()}
                        >
                          <ThemedText style={styles.actionButtonPrimaryText}>
                            {adminActionBusy ? "Sending..." : "Send now"}
                          </ThemedText>
                        </Pressable>
                      </View>
                    </View>

                    {adminReminderPreview ? (
                      <>
                        <View style={styles.metricGrid}>
                          <View style={styles.metricPanel}>
                            <ThemedText style={styles.metricValue}>
                              {adminReminderPreview.cycles_count}
                            </ThemedText>
                            <ThemedText style={styles.metricLabel}>Cycles in window</ThemedText>
                          </View>
                          <View style={styles.metricPanel}>
                            <ThemedText style={styles.metricValue}>
                              {adminReminderPreview.targets_count}
                            </ThemedText>
                            <ThemedText style={styles.metricLabel}>Targets</ThemedText>
                          </View>
                          <View style={styles.metricPanel}>
                            <ThemedText style={styles.metricValue}>
                              {adminReminderPreview.lookahead_hours}h
                            </ThemedText>
                            <ThemedText style={styles.metricLabel}>Lookahead</ThemedText>
                          </View>
                        </View>

                        {adminReminderPreview.cycles.slice(0, 3).map((cycle) => (
                          <View key={cycle.cycle_id} style={styles.previewRow}>
                            <ThemedText style={styles.previewTitle}>
                              {cycle.tontine_name} - Cycle {cycle.cycle_number}
                            </ThemedText>
                            <ThemedText style={styles.supportText}>
                              Due {formatShortDate(cycle.deadline)}
                            </ThemedText>
                            <ThemedText style={styles.supportText}>
                              {cycle.targets_count === 1
                                ? t("1 recipient")
                                : t("{{count}} recipients", { count: cycle.targets_count })}
                            </ThemedText>
                          </View>
                        ))}
                      </>
                    ) : (
                      <ThemedText style={styles.supportText}>
                        No reminder preview available.
                      </ThemedText>
                    )}

                    {adminReminderResult ? (
                      <View style={styles.resultStrip}>
                        <ThemedText style={styles.resultText}>
                          {t("Last send: {{sent}} sent, {{failed}} failed, {{marked}} cycle(s) marked.", {
                            sent: adminReminderResult.sms_sent,
                            failed: adminReminderResult.sms_failed,
                            marked: adminReminderResult.cycles_marked,
                          })}
                        </ThemedText>
                      </View>
                    ) : null}
                  </View>
                </>
              ) : (
                <ThemedText style={styles.supportText}>No admin overview available.</ThemedText>
              )}
            </View>
          </View>
        ) : null}
        </View>
      </ScrollView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    padding: 18,
    paddingBottom: 128,
    alignItems: "center",
  },
  page: {
    width: "100%",
    gap: 22,
  },
  hero: {
    position: "relative",
    overflow: "hidden",
    borderRadius: 34,
    backgroundColor: BrandColors.blueNight,
    padding: 24,
    gap: 20,
    ...BrandShadow,
  },
  heroGlowTop: {
    position: "absolute",
    top: -36,
    right: -24,
    width: 150,
    height: 150,
    borderRadius: 999,
    backgroundColor: BrandColors.blue,
    opacity: 0.3,
  },
  heroGlowBottom: {
    position: "absolute",
    bottom: -52,
    left: -18,
    width: 140,
    height: 140,
    borderRadius: 999,
    backgroundColor: BrandColors.violet,
    opacity: 0.16,
  },
  heroHeader: {
    gap: 14,
  },
  heroTitleWrap: {
    gap: 8,
  },
  eyebrow: {
    color: "#D7E7FF",
    fontSize: 12,
    lineHeight: 16,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 1.1,
  },
  heroTitle: {
    color: "#FFFFFF",
    fontSize: 35,
    lineHeight: 39,
    fontWeight: "800",
    letterSpacing: -0.8,
  },
  heroSubtitle: {
    color: "#DBE8FF",
    fontSize: 15,
    lineHeight: 23,
  },
  heroPills: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  heroPill: {
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderWidth: 1,
  },
  heroPillSuccess: {
    backgroundColor: "rgba(236, 253, 243, 0.14)",
    borderColor: "rgba(171, 239, 198, 0.45)",
  },
  heroPillMuted: {
    backgroundColor: "rgba(255, 255, 255, 0.08)",
    borderColor: "rgba(255, 255, 255, 0.14)",
  },
  heroPillAdmin: {
    backgroundColor: "rgba(138, 55, 201, 0.16)",
    borderColor: "rgba(138, 55, 201, 0.36)",
  },
  heroPillText: {
    color: "#EAF1FF",
    fontSize: 12,
    lineHeight: 16,
    fontWeight: "700",
  },
  heroPillTextSuccess: {
    color: "#D9FBE8",
  },
  heroPillTextAdmin: {
    color: "#F0D9FF",
  },
  heroStats: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  heroStatCard: {
    minWidth: 100,
    flexGrow: 1,
    borderRadius: 20,
    backgroundColor: "rgba(255, 255, 255, 0.1)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.16)",
    padding: 15,
    gap: 6,
  },
  heroStatValue: {
    color: "#FFFFFF",
    fontSize: 24,
    lineHeight: 28,
    fontWeight: "800",
  },
  heroStatLabel: {
    color: "#CFE0FF",
    fontSize: 13,
    lineHeight: 18,
  },
  section: {
    gap: 14,
  },
  tabletSectionGrid: {
    width: "100%",
    gap: 16,
  },
  tabletSectionGridOn: {
    flexDirection: "row",
    alignItems: "flex-start",
  },
  tabletSectionColumn: {
    flex: 1,
  },
  sectionHeader: {
    gap: 5,
    paddingHorizontal: 4,
  },
  sectionCaption: {
    color: BrandColors.muted,
    fontSize: 13,
    lineHeight: 19,
    letterSpacing: 0.1,
  },
  card: {
    borderRadius: 30,
    backgroundColor: BrandColors.surface,
    borderWidth: 1,
    borderColor: BrandColors.border,
    padding: 20,
    gap: 16,
    ...BrandShadow,
  },
  adminCard: {
    backgroundColor: "rgba(255,255,255,0.86)",
  },
  cardTopRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 12,
  },
  cardLabel: {
    color: BrandColors.muted,
    fontSize: 13,
    lineHeight: 18,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.6,
  },
  supportText: {
    color: BrandColors.muted,
    fontSize: 14,
    lineHeight: 20,
  },
  errorText: {
    color: "#B42318",
    fontSize: 14,
    lineHeight: 20,
    fontWeight: "600",
  },
  statusBadge: {
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderWidth: 1,
  },
  statusBadgeSuccess: {
    backgroundColor: BrandColors.successBg,
    borderColor: BrandColors.successBorder,
  },
  statusBadgeWarning: {
    backgroundColor: BrandColors.warningBg,
    borderColor: BrandColors.warningBorder,
  },
  statusBadgeText: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: "800",
  },
  statusBadgeTextSuccess: {
    color: BrandColors.successText,
  },
  statusBadgeTextWarning: {
    color: BrandColors.warningText,
  },
  actionButtonPrimary: {
    alignSelf: "flex-start",
    borderRadius: 18,
    backgroundColor: BrandColors.blueDeep,
    paddingHorizontal: 15,
    paddingVertical: 12,
    ...BrandShadow,
  },
  actionButtonPrimaryText: {
    color: "#FFFFFF",
    fontWeight: "700",
    fontSize: 14,
  },
  actionButtonGhost: {
    alignSelf: "flex-start",
    borderRadius: 18,
    backgroundColor: BrandColors.surfaceMuted,
    borderWidth: 1,
    borderColor: BrandColors.borderStrong,
    paddingHorizontal: 15,
    paddingVertical: 12,
  },
  actionButtonGhostText: {
    color: BrandColors.inkSoft,
    fontWeight: "700",
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
    fontWeight: "700",
  },
  reminderCard: {
    borderRadius: 22,
    backgroundColor: "rgba(255,255,255,0.8)",
    borderWidth: 1,
    borderColor: BrandColors.border,
    padding: 15,
    gap: 7,
  },
  reminderCardPriority: {
    backgroundColor: "rgba(46,207,227,0.12)",
    borderColor: BrandColors.borderStrong,
  },
  reminderCardOverdue: {
    backgroundColor: BrandColors.dangerBg,
    borderColor: BrandColors.dangerBorder,
  },
  reminderMetaRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 12,
  },
  reminderTitle: {
    color: BrandColors.ink,
    fontSize: 16,
    lineHeight: 22,
    fontWeight: "700",
    flex: 1,
  },
  reminderHoursBadge: {
    borderRadius: 999,
    backgroundColor: BrandColors.blueDeep,
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
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: BrandColors.dangerBorder,
  },
  reminderHoursTextOverdue: {
    color: BrandColors.dangerText,
  },
  metricGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  metricPanel: {
    minWidth: 110,
    flexGrow: 1,
    borderRadius: 22,
    backgroundColor: "rgba(255,255,255,0.92)",
    borderWidth: 1,
    borderColor: BrandColors.border,
    padding: 15,
    gap: 5,
  },
  metricValue: {
    color: BrandColors.ink,
    fontSize: 24,
    lineHeight: 28,
    fontWeight: "800",
  },
  metricLabel: {
    color: BrandColors.muted,
    fontSize: 13,
    lineHeight: 18,
  },
  adminFacts: {
    gap: 4,
  },
  subsection: {
    gap: 12,
    marginTop: 4,
  },
  subsectionTitle: {
    color: BrandColors.ink,
    fontSize: 18,
    lineHeight: 24,
    fontWeight: "700",
  },
  actionsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    justifyContent: "flex-end",
  },
  previewRow: {
    borderTopWidth: 1,
    borderTopColor: BrandColors.border,
    paddingTop: 12,
    gap: 4,
  },
  previewTitle: {
    color: BrandColors.ink,
    fontSize: 15,
    lineHeight: 22,
    fontWeight: "700",
  },
  resultStrip: {
    borderRadius: 18,
    backgroundColor: "rgba(46,207,227,0.08)",
    borderWidth: 1,
    borderColor: BrandColors.borderStrong,
    padding: 12,
  },
  resultText: {
    color: BrandColors.blue,
    fontSize: 13,
    lineHeight: 18,
    fontWeight: "700",
  },
});
