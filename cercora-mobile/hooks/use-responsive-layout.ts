import { useWindowDimensions } from "react-native";

export function useResponsiveLayout() {
  const { width } = useWindowDimensions();

  const isTablet = width >= 768;
  const isLargeTablet = width >= 1100;
  const maxWidth = isLargeTablet ? 1180 : isTablet ? 980 : undefined;

  return {
    width,
    isTablet,
    isLargeTablet,
    maxWidth,
  };
}
