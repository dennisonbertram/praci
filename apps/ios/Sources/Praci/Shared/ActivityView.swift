import SwiftUI
import UIKit

/// The system share sheet, for a link that exists only after an async call (ShareLink needs it up front).
struct ActivityView: UIViewControllerRepresentable {
  let items: [Any]

  func makeUIViewController(context _: Context) -> UIActivityViewController {
    UIActivityViewController(activityItems: items, applicationActivities: nil)
  }

  func updateUIViewController(_: UIActivityViewController, context _: Context) {}
}
