import Ionicons from "@expo/vector-icons/Ionicons";
import { Tabs } from "expo-router";

import { HapticTab } from "@/components/haptic-tab";
import { BrandColors, BrandShadow } from "@/constants/brand";
import { Fonts } from "@/constants/theme";
import { useI18n } from "@/hooks/use-i18n";

export default function TabLayout() {
  const { t } = useI18n();

  return (
    <Tabs
      screenOptions={{
        headerTitleAlign: "center",
        tabBarActiveTintColor: BrandColors.blue,
        tabBarInactiveTintColor: BrandColors.muted,
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
          backgroundColor: "rgba(255,255,255,0.96)",
          borderTopColor: "rgba(255,255,255,0.2)",
          borderTopWidth: 0,
          height: 78,
          paddingTop: 8,
          paddingBottom: 12,
          marginHorizontal: 14,
          marginBottom: 14,
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
          title: t("Dashboard"),
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
    </Tabs>
  );
}
