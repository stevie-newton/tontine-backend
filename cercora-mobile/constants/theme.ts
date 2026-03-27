import { Platform } from "react-native";

import { BrandColors } from "@/constants/brand";

const tintColorLight = BrandColors.blue;
const tintColorDark = "#F8FBFF";

export const Colors = {
  light: {
    text: BrandColors.ink,
    background: BrandColors.canvas,
    tint: tintColorLight,
    icon: BrandColors.mutedSoft,
    tabIconDefault: BrandColors.mutedSoft,
    tabIconSelected: tintColorLight,
  },
  dark: {
    text: "#F4F7FF",
    background: "#0D1530",
    tint: tintColorDark,
    icon: "#A7B6D4",
    tabIconDefault: "#A7B6D4",
    tabIconSelected: tintColorDark,
  },
};

export const Fonts = Platform.select({
  ios: {
    sans: "system-ui",
    serif: "ui-serif",
    rounded: "ui-rounded",
    mono: "ui-monospace",
  },
  default: {
    sans: "sans-serif",
    serif: "serif",
    rounded: "sans-serif-medium",
    mono: "monospace",
  },
  web: {
    sans: "'Avenir Next', 'Segoe UI', Inter, system-ui, -apple-system, BlinkMacSystemFont, sans-serif",
    serif: "Georgia, 'Times New Roman', serif",
    rounded: "'Avenir Next', 'SF Pro Rounded', 'Hiragino Maru Gothic ProN', sans-serif",
    mono: "SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace",
  },
});
