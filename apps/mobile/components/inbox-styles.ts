import { StyleSheet } from "react-native";
import { mobileTokens } from "../lib/appearance";
import { native } from "../lib/native";

export function createHomeStyles() {
  const tokens = mobileTokens();
  return StyleSheet.create({
    screen: {
      flex: 1,
      backgroundColor: native.page,
    },
    centered: {
      alignItems: "center",
      justifyContent: "center",
    },
    header: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingHorizontal: 16,
      paddingTop: 8,
      paddingBottom: 10,
    },
    headerActions: {
      flexDirection: "row",
      alignItems: "center",
      padding: 2,
      borderRadius: 22,
      backgroundColor: native.fillPressed,
    },
    circleButton: {
      width: 44,
      height: 44,
      borderRadius: 22,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: native.fillPressed,
    },
    headerButton: {
      width: 40,
      height: 40,
      borderRadius: 20,
      alignItems: "center",
      justifyContent: "center",
      overflow: "hidden",
    },
    headerButtonActive: {
      backgroundColor: native.fill,
    },
    headerButtonAccent: {
      backgroundColor: tokens.primary,
    },
    profileInitials: {
      color: native.label,
      fontSize: 15,
      fontWeight: "600",
    },
    searchField: {
      marginHorizontal: 16,
      marginBottom: 8,
      minHeight: 44,
      paddingVertical: 10,
      textAlignVertical: "center",
      borderRadius: 10,
      backgroundColor: native.fill,
      color: native.label,
      paddingHorizontal: 12,
      fontSize: 17,
      writingDirection: "auto",
    },
    error: {
      color: native.secondaryLabel,
      paddingHorizontal: 20,
      paddingBottom: 8,
    },
    list: {
      flexGrow: 1,
      paddingBottom: 32,
    },
    empty: {
      color: native.secondaryLabel,
      fontSize: 16,
      paddingHorizontal: 20,
      paddingTop: 28,
    },
    row: {
      flexDirection: "row",
      alignItems: "center",
      paddingHorizontal: 16,
      paddingVertical: 10,
      gap: 12,
    },
    mailInboxIcon: {
      width: 54,
      height: 54,
      borderRadius: 27,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: native.fill,
    },
    treeToggle: {
      width: 20,
      height: 20,
      alignItems: "center",
      justifyContent: "center",
      marginRight: -4,
    },
    rowPressed: {
      opacity: 0.55,
    },
    rowBody: {
      flex: 1,
      minWidth: 0,
      gap: 2,
    },
    rowTop: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
    },
    titleRow: {
      flex: 1,
      minWidth: 0,
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
    },
    rowMeta: {
      flexDirection: "row",
      alignItems: "center",
      gap: 7,
    },
    name: {
      flexShrink: 1,
      color: native.label,
      fontSize: 17,
      fontWeight: "600",
      writingDirection: "auto",
    },
    tag: {
      flexShrink: 1,
      borderRadius: 999,
      backgroundColor: native.fill,
      paddingHorizontal: 7,
      paddingVertical: 2,
    },
    tagLabel: {
      color: native.secondaryLabel,
      fontSize: 11,
      fontWeight: "500",
      writingDirection: "auto",
    },
    time: {
      color: native.secondaryLabel,
      fontSize: 15,
    },
    preview: {
      color: native.secondaryLabel,
      fontSize: 15,
      lineHeight: 20,
      writingDirection: "auto",
    },
    unreadPreview: {
      color: native.label,
      fontWeight: "600",
    },
    unreadDot: {
      width: 8,
      height: 8,
      borderRadius: 4,
      backgroundColor: tokens.foreground,
    },
    spaceHeading: {
      flexDirection: "row",
      alignItems: "center",
      paddingHorizontal: 16,
      paddingTop: 8,
    },
    spaceSelect: {
      flex: 1,
      minHeight: 44,
      justifyContent: "center",
    },
    spaceTitle: {
      color: native.label,
      fontSize: 14,
      fontWeight: "600",
      writingDirection: "auto",
    },
    spaceActions: {
      width: 44,
      height: 44,
      alignItems: "center",
      justifyContent: "center",
    },
    recoveryAction: {
      minHeight: 44,
      paddingHorizontal: 20,
      justifyContent: "center",
    },
    sectionHeading: {
      color: native.secondaryLabel,
      fontSize: 14,
      fontWeight: "600",
      paddingHorizontal: 16,
      paddingTop: 12,
      paddingBottom: 4,
    },
    activitySection: {
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: native.fillPressed,
      marginBottom: 4,
      paddingBottom: 4,
    },
    activityGap: {
      paddingTop: 16,
    },
    groupAvatar: {
      width: 48,
      height: 48,
      borderRadius: 24,
      backgroundColor: native.fill,
      alignItems: "center",
      justifyContent: "center",
    },
    groupAvatarLabel: {
      color: native.secondaryLabel,
      fontSize: 16,
      fontWeight: "600",
    },
  });
}
