import React from "react";
import { StyleSheet, Text, type TextProps } from "react-native";

import { Fonts } from "@/constants/theme";
import { translateText, useI18n } from "@/hooks/use-i18n";
import { useThemeColor } from "@/hooks/use-theme-color";

export type ThemedTextProps = TextProps & {
  lightColor?: string;
  darkColor?: string;
  type?: "default" | "title" | "defaultSemiBold" | "subtitle" | "link";
};

function translateChildren(children: React.ReactNode): React.ReactNode {
  return React.Children.map(children, (child) => {
    if (typeof child === "string") return translateText(child);
    if (Array.isArray(child)) return translateChildren(child);
    return child;
  });
}

export function ThemedText({
  style,
  lightColor,
  darkColor,
  type = "default",
  ...rest
}: ThemedTextProps) {
  const { locale } = useI18n();
  const color = useThemeColor({ light: lightColor, dark: darkColor }, "text");
  void locale;

  return (
    <Text
      style={[
        { color },
        type === "default" ? styles.default : undefined,
        type === "title" ? styles.title : undefined,
        type === "defaultSemiBold" ? styles.defaultSemiBold : undefined,
        type === "subtitle" ? styles.subtitle : undefined,
        type === "link" ? styles.link : undefined,
        style,
      ]}
      {...rest}
    >
      {translateChildren(rest.children)}
    </Text>
  );
}

const styles = StyleSheet.create({
  default: {
    fontSize: 16,
    lineHeight: 24,
    fontFamily: Fonts.sans,
    flexShrink: 1,
  },
  defaultSemiBold: {
    fontSize: 16,
    lineHeight: 24,
    fontWeight: "700",
    fontFamily: Fonts.sans,
    flexShrink: 1,
  },
  title: {
    fontSize: 34,
    fontWeight: "800",
    lineHeight: 38,
    letterSpacing: -0.8,
    fontFamily: Fonts.rounded,
    flexShrink: 1,
  },
  subtitle: {
    fontSize: 21,
    lineHeight: 26,
    fontWeight: "800",
    letterSpacing: -0.3,
    fontFamily: Fonts.rounded,
    flexShrink: 1,
  },
  link: {
    lineHeight: 24,
    fontSize: 15,
    color: "#0a7ea4",
    fontWeight: "700",
    fontFamily: Fonts.sans,
    flexShrink: 1,
  },
});
