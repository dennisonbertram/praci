// swiftlint:disable identifier_name
import RakazoCore
import SwiftUI

/// One of the eight shipped avatar silhouettes, scaled from the 259 x 259 view box.
struct BotAvatarShape: Shape {
  let shapeIndex: Int

  func path(in rect: CGRect) -> Path {
    let box = BotAvatar.viewBoxSize
    let origin = BotAvatar.viewBoxOrigin
    let scale = min(rect.width, rect.height) / box
    func point(_ x: Double, _ y: Double) -> CGPoint {
      CGPoint(x: rect.minX + (x - origin) * scale, y: rect.minY + (y - origin) * scale)
    }
    var path = Path()
    for segment in BotAvatar.segments(of: BotAvatar.shapePath(shapeIndex)) {
      switch segment {
      case .move(let x, let y): path.move(to: point(x, y))
      case .line(let x, let y): path.addLine(to: point(x, y))
      case .quad(let cx, let cy, let x, let y):
        path.addQuadCurve(to: point(x, y), control: point(cx, cy))
      case .curve(let c1x, let c1y, let c2x, let c2y, let x, let y):
        path.addCurve(to: point(x, y), control1: point(c1x, c1y), control2: point(c2x, c2y))
      case .close: path.closeSubpath()
      }
    }
    return path
  }
}
