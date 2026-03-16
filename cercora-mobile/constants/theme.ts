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
    /** iOS `UIFontDescriptorSystemDesignDefault` */
    sans: "system-ui",
    /** iOS `UIFontDescriptorSystemDesignSerif` */
    serif: "ui-serif",
    /** iOS `UIFontDescriptorSystemDesignRounded` */
    rounded: "ui-rounded",
    /** iOS `UIFontDescriptorSystemDesignMonospaced` */
    mono: "ui-monospace",
  },
  default: {
    sans: "normal",
    serif: "serif",
    rounded: "normal",
    mono: "monospace",
  },
  web: {
    sans: "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
    serif: "Georgia, 'Times New Roman', serif",
    rounded: "'SF Pro Rounded', 'Hiragino Maru Gothic ProN', Meiryo, 'MS PGothic', sans-serif",
    mono: "SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace",
  },
});
