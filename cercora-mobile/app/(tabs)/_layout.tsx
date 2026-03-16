import Ionicons from "@expo/vector-icons/Ionicons";
import { Tabs } from "expo-router";

import { HapticTab } from "@/components/haptic-tab";
import { BrandColors } from "@/constants/brand";
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
          backgroundColor: BrandColors.surfaceStrong,
        },
        headerShadowVisible: false,
        headerTintColor: BrandColors.ink,
        headerTitleStyle: {
          fontWeight: "700",
        },
        tabBarStyle: {
          backgroundColor: "rgba(255,255,255,0.92)",
          borderTopColor: BrandColors.border,
          height: 72,
          paddingTop: 8,
          paddingBottom: 10,
          position: "absolute",
        },
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: "700",
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
