import Ionicons from "@expo/vector-icons/Ionicons";
import { Redirect, Tabs, usePathname } from "expo-router";
import { Icon, Label, NativeTabs } from "expo-router/unstable-native-tabs";
import { Platform } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useSurfaceColors } from "@/components/ui/app-surface";

import { HapticTab } from "@/components/haptic-tab";
import { BrandColors, BrandShadow } from "@/constants/brand";
import { Fonts } from "@/constants/theme";
import { useAuth } from "@/hooks/use-auth";
import { useI18n } from "@/hooks/use-i18n";

export default function TabLayout() {
  const { t } = useI18n();
  const { user } = useAuth();
  const colors = useSurfaceColors();
  const insets = useSafeAreaInsets();
  const pathname = usePathname();

  if (Platform.OS === "ios" && Number.parseInt(String(Platform.Version), 10) >= 26) {
    // Native tabs cannot focus the hidden index redirect route.
    if (pathname === "/" || (pathname === "/admin" && !user?.is_global_admin)) {
      return <Redirect href="/(tabs)/dashboard" />;
    }

    return (
      <NativeTabs tintColor={colors.accent} minimizeBehavior="onScrollDown">
        <NativeTabs.Trigger name="dashboard">
          <Icon sf={{ default: "house", selected: "house.fill" }} />
          <Label>{t("Home")}</Label>
        </NativeTabs.Trigger>
        <NativeTabs.Trigger name="reminders">
          <Icon sf={{ default: "bell", selected: "bell.fill" }} />
          <Label>{t("Reminders")}</Label>
        </NativeTabs.Trigger>
        <NativeTabs.Trigger name="tontines">
          <Icon sf={{ default: "person.3", selected: "person.3.fill" }} />
          <Label>{t("Tontines")}</Label>
        </NativeTabs.Trigger>
        <NativeTabs.Trigger name="profile">
          <Icon sf={{ default: "person.crop.circle", selected: "person.crop.circle.fill" }} />
          <Label>{t("Profile")}</Label>
        </NativeTabs.Trigger>
        <NativeTabs.Trigger name="admin" hidden={!user?.is_global_admin}>
          <Icon sf={{ default: "checkmark.shield", selected: "checkmark.shield.fill" }} />
          <Label>{t("Admin")}</Label>
        </NativeTabs.Trigger>
      </NativeTabs>
    );
  }

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        headerTitleAlign: "center",
        tabBarActiveTintColor: colors.accent,
        tabBarInactiveTintColor: colors.muted,
        tabBarButton: HapticTab,
        headerStyle: {
          backgroundColor: "rgba(255,255,255,0.9)",
        },
        headerShadowVisible: false,
        headerTintColor: BrandColors.ink,
        headerTitleStyle: {
          fontWeight: "800",
          fontFamily: Fonts.rounded,
          fontSize: 18,
          letterSpacing: -0.3,
        },
        tabBarStyle: {
          backgroundColor: colors.surface,
          borderTopColor: "rgba(255,255,255,0.2)",
          borderTopWidth: 0,
          height: 78,
          paddingTop: 8,
          paddingBottom: 12,
          marginHorizontal: 14,
          marginBottom: Math.max(insets.bottom, 14),
          borderRadius: 26,
          position: "absolute",
          ...BrandShadow,
        },
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: "800",
          fontFamily: Fonts.sans,
        },
      }}
    >
      <Tabs.Screen name="index" options={{ href: null }} />

      <Tabs.Screen
        name="dashboard"
        options={{
          title: t("Home"),
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="home-outline" size={size} color={color} />
          ),
        }}
      />

      <Tabs.Screen
        name="reminders"
        options={{
          title: t("Reminders"),
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="notifications-outline" size={size} color={color} />
          ),
        }}
      />

      <Tabs.Screen
        name="tontines"
        options={{
          title: t("Tontines"),
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="people-outline" size={size} color={color} />
          ),
        }}
      />

      <Tabs.Screen
        name="profile"
        options={{
          title: t("Profile"),
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="person-outline" size={size} color={color} />
          ),
        }}
      />

      <Tabs.Screen
        name="admin"
        options={{
          href: user?.is_global_admin ? undefined : null,
          title: t("Admin"),
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="shield-checkmark-outline" size={size} color={color} />
          ),
        }}
      />
    </Tabs>
  );
}
