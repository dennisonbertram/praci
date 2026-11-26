import RakazoCore
import RakazoUI
import SwiftUI
import UIKit

/// A bot's identity mark: shape with two eyes, uploaded image, plain colour, or the name initial.
/// Bot colours are identity colours from the stored value, not semantic tokens.
struct BotAvatarView: View {
  let name: String
  let avatar: String?
  let size: CGFloat

  var body: some View {
    content
      .frame(width: size, height: size)
      .accessibilityHidden(true)
  }

  @ViewBuilder private var content: some View {
    switch avatar.map(BotAvatar.presentation) {
    case .shape(let color, let index, let eyeColor):
      shape(color: color, index: index, eyeColor: eyeColor)
    case .color(let color):
      initialText(.white).background(Color(hex: color), in: Circle())
    case .image(let url):
      if let image = Self.image(from: url) {
        Image(uiImage: image).resizable().scaledToFill().clipShape(Circle())
      } else {
        initial
      }
    case .other, nil:
      initial
    }
  }

  private var initial: some View {
    initialText(Color.token(.foreground)).background(Color.token(.muted), in: Circle())
  }

  private func initialText(_ style: Color) -> some View {
    Text(BotAvatar.initial(of: name))
      .font(.system(size: size * 0.45, weight: .semibold))
      .foregroundStyle(style)
      .frame(width: size, height: size)
  }

  private func shape(color: String, index: Int, eyeColor: String) -> some View {
    let unit = size / BotAvatar.viewBoxSize
    let eyeW = 20 * unit
    let eyeH = 62 * unit
    let eyeCenterX = (BotAvatar.center - BotAvatar.viewBoxOrigin) * unit
    let eyeCenterY = (BotAvatar.center + 12 - BotAvatar.viewBoxOrigin) * unit
    return ZStack(alignment: .topLeading) {
      BotAvatarShape(shapeIndex: index).fill(Color(hex: color))
      BotAvatarShape(shapeIndex: index).stroke(Color.black.opacity(0.12), lineWidth: 1)
      ForEach([-1.0, 1.0], id: \.self) { side in
        Capsule().fill(Color(hex: eyeColor))
          .frame(width: eyeW, height: eyeH)
          .position(x: eyeCenterX + side * 34 * unit, y: eyeCenterY)
      }
    }
  }

  private static func image(from dataURL: String) -> UIImage? {
    guard let comma = dataURL.firstIndex(of: ","),
      let data = Data(base64Encoded: String(dataURL[dataURL.index(after: comma)...]))
    else { return nil }
    return UIImage(data: data)
  }
}

extension Color {
  init(hex: String) {
    var digits = String(hex.dropFirst())
    if digits.count == 3 { digits = digits.map { "\($0)\($0)" }.joined() }
    let value = UInt32(digits, radix: 16) ?? 0
    self.init(
      red: Double((value >> 16) & 255) / 255, green: Double((value >> 8) & 255) / 255,
      blue: Double(value & 255) / 255)
  }
}

#Preview {
  HStack {
    ForEach(0..<8, id: \.self) { BotAvatarView(name: "A", avatar: "#8B5CF6::shape_\($0)", size: 40) }
    BotAvatarView(name: "Atlas", avatar: nil, size: 40)
  }
  .padding()
}
