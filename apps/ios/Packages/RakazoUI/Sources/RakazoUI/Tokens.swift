// Generated from packages/ui-tokens/src/index.ts by pnpm ios:tokens. Do not edit.
import SwiftUI

public enum SemanticColor: String, CaseIterable {
    case background
    case foreground
    case card
    case cardForeground
    case popover
    case popoverForeground
    case primary
    case primaryForeground
    case secondary
    case secondaryForeground
    case chatUser
    case chatUserForeground
    case muted
    case mutedForeground
    case accent
    case accentForeground
    case destructive
    case destructiveForeground
    case border
    case input
    case ring
    case sidebar
    case sidebarForeground
    case sidebarBorder
    case sidebarAccent
    case sidebarAccentForeground
    case link
    case faviconPlate
    case success
    case warning
    case statusWorking
    case overlay
    case scrollbar
    case scrollbarHover
}

public enum RakazoTokens {
    public static let botColors: [Color] = [
        Color(red: 62/255, green: 197/255, blue: 168/255),
        Color(red: 245/255, green: 160/255, blue: 60/255),
        Color(red: 106/255, green: 107/255, blue: 245/255),
        Color(red: 155/255, green: 92/255, blue: 246/255),
        Color(red: 59/255, green: 130/255, blue: 246/255),
        Color(red: 242/255, green: 98/255, blue: 42/255),
        Color(red: 217/255, green: 80/255, blue: 138/255)
    ]

    private static let light: [SemanticColor: Color] = [
        .background: Color(red: 250/255, green: 250/255, blue: 248/255),
        .foreground: Color(red: 26/255, green: 26/255, blue: 26/255),
        .card: Color(red: 255/255, green: 255/255, blue: 255/255),
        .cardForeground: Color(red: 26/255, green: 26/255, blue: 26/255),
        .popover: Color(red: 255/255, green: 255/255, blue: 255/255),
        .popoverForeground: Color(red: 26/255, green: 26/255, blue: 26/255),
        .primary: Color(red: 26/255, green: 26/255, blue: 26/255),
        .primaryForeground: Color(red: 241/255, green: 241/255, blue: 239/255),
        .secondary: Color(red: 240/255, green: 240/255, blue: 237/255),
        .secondaryForeground: Color(red: 26/255, green: 26/255, blue: 26/255),
        .chatUser: Color(red: 226/255, green: 226/255, blue: 220/255),
        .chatUserForeground: Color(red: 26/255, green: 26/255, blue: 26/255),
        .muted: Color(red: 240/255, green: 240/255, blue: 237/255),
        .mutedForeground: Color(red: 102/255, green: 102/255, blue: 105/255),
        .accent: Color(red: 234/255, green: 234/255, blue: 230/255),
        .accentForeground: Color(red: 26/255, green: 26/255, blue: 26/255),
        .destructive: Color(red: 220/255, green: 38/255, blue: 38/255),
        .destructiveForeground: Color(red: 255/255, green: 255/255, blue: 255/255),
        .border: Color(red: 240/255, green: 240/255, blue: 237/255),
        .input: Color(red: 200/255, green: 200/255, blue: 196/255),
        .ring: Color(red: 26/255, green: 26/255, blue: 26/255),
        .sidebar: Color(red: 236/255, green: 236/255, blue: 233/255),
        .sidebarForeground: Color(red: 26/255, green: 26/255, blue: 26/255),
        .sidebarBorder: Color(red: 232/255, green: 232/255, blue: 228/255),
        .sidebarAccent: Color(red: 255/255, green: 255/255, blue: 255/255),
        .sidebarAccentForeground: Color(red: 26/255, green: 26/255, blue: 26/255),
        .link: Color(red: 37/255, green: 99/255, blue: 235/255),
        .faviconPlate: Color(red: 255/255, green: 255/255, blue: 255/255),
        .success: Color(red: 34/255, green: 139/255, blue: 59/255),
        .warning: Color(red: 183/255, green: 121/255, blue: 31/255),
        .statusWorking: Color(red: 37/255, green: 99/255, blue: 235/255),
        .overlay: Color(red: 20/255, green: 20/255, blue: 22/255, opacity: 0.45),
        .scrollbar: Color(red: 200/255, green: 200/255, blue: 196/255),
        .scrollbarHover: Color(red: 168/255, green: 168/255, blue: 164/255),
    ]

    private static let dark: [SemanticColor: Color] = [
        .background: Color(red: 28/255, green: 28/255, blue: 26/255),
        .foreground: Color(red: 236/255, green: 235/255, blue: 230/255),
        .card: Color(red: 37/255, green: 37/255, blue: 35/255),
        .cardForeground: Color(red: 236/255, green: 235/255, blue: 230/255),
        .popover: Color(red: 37/255, green: 37/255, blue: 35/255),
        .popoverForeground: Color(red: 236/255, green: 235/255, blue: 230/255),
        .primary: Color(red: 241/255, green: 240/255, blue: 235/255),
        .primaryForeground: Color(red: 28/255, green: 28/255, blue: 26/255),
        .secondary: Color(red: 40/255, green: 40/255, blue: 38/255),
        .secondaryForeground: Color(red: 236/255, green: 235/255, blue: 230/255),
        .chatUser: Color(red: 51/255, green: 50/255, blue: 47/255),
        .chatUserForeground: Color(red: 236/255, green: 235/255, blue: 230/255),
        .muted: Color(red: 37/255, green: 37/255, blue: 35/255),
        .mutedForeground: Color(red: 156/255, green: 154/255, blue: 147/255),
        .accent: Color(red: 42/255, green: 41/255, blue: 39/255),
        .accentForeground: Color(red: 236/255, green: 235/255, blue: 230/255),
        .destructive: Color(red: 244/255, green: 98/255, blue: 98/255),
        .destructiveForeground: Color(red: 28/255, green: 28/255, blue: 26/255),
        .border: Color(red: 46/255, green: 45/255, blue: 42/255),
        .input: Color(red: 74/255, green: 73/255, blue: 68/255),
        .ring: Color(red: 236/255, green: 235/255, blue: 230/255),
        .sidebar: Color(red: 34/255, green: 34/255, blue: 32/255),
        .sidebarForeground: Color(red: 236/255, green: 235/255, blue: 230/255),
        .sidebarBorder: Color(red: 42/255, green: 41/255, blue: 38/255),
        .sidebarAccent: Color(red: 42/255, green: 41/255, blue: 39/255),
        .sidebarAccentForeground: Color(red: 236/255, green: 235/255, blue: 230/255),
        .link: Color(red: 79/255, green: 143/255, blue: 247/255),
        .faviconPlate: Color(red: 255/255, green: 255/255, blue: 255/255),
        .success: Color(red: 78/255, green: 203/255, blue: 113/255),
        .warning: Color(red: 233/255, green: 196/255, blue: 106/255),
        .statusWorking: Color(red: 79/255, green: 143/255, blue: 247/255),
        .overlay: Color(red: 8/255, green: 8/255, blue: 7/255, opacity: 0.72),
        .scrollbar: Color(red: 46/255, green: 45/255, blue: 42/255),
        .scrollbarHover: Color(red: 69/255, green: 68/255, blue: 63/255),
    ]

    public static func color(_ token: SemanticColor, for scheme: ColorScheme) -> Color {
        (scheme == .light ? light : dark)[token]!
    }
}
