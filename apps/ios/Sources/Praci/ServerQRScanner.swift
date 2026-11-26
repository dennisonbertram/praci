import AVFoundation
import SwiftUI
import UIKit
import Vision
import VisionKit

private enum CameraScannerState {
  case preparing
  case scanning
  case permissionUnavailable
  case cameraUnavailable
  case paused
}

struct ServerQRScannerSheet: View {
  let sessionID: UUID
  let onScan: (String, UUID) -> Void

  @Environment(\.dismiss) private var dismiss
  @Environment(\.openURL) private var openURL
  @Environment(\.scenePhase) private var scenePhase
  @State private var state: CameraScannerState = .preparing
  @State private var scannerID = UUID()
  @State private var activationID = UUID()
  @State private var isVisible = true

  var body: some View {
    NavigationStack {
      Group {
        switch state {
        case .preparing, .paused:
          ProgressView()
        case .scanning:
          QRDataScanner(
            sessionID: sessionID,
            onScan: onScan,
            onUnavailable: { state = .cameraUnavailable }
          )
          .id(scannerID)
        case .permissionUnavailable:
          VStack(spacing: 12) {
            Text("Camera is unavailable.")
            Button("Open Settings") {
              if let url = URL(string: UIApplication.openSettingsURLString) {
                openURL(url)
              }
            }
          }
        case .cameraUnavailable:
          Text("Camera is unavailable.")
        }
      }
      .frame(maxWidth: .infinity, maxHeight: .infinity)
      .navigationTitle("Scan QR code")
      .navigationBarTitleDisplayMode(.inline)
      .toolbar {
        ToolbarItem(placement: .cancellationAction) {
          Button("Cancel") { dismiss() }
        }
      }
    }
    .task { await activateScanner() }
    .onChange(of: scenePhase) { _, phase in
      if phase == .background {
        activationID = UUID()
        state = .paused
      } else if phase == .active, state == .paused {
        Task { await activateScanner() }
      }
    }
    .onDisappear {
      isVisible = false
      activationID = UUID()
      state = .paused
    }
  }

  @MainActor
  private func activateScanner() async {
    guard isVisible else { return }
    let activation = UUID()
    activationID = activation
    state = .preparing

    switch AVCaptureDevice.authorizationStatus(for: .video) {
    case .authorized:
      break
    case .notDetermined:
      guard await AVCaptureDevice.requestAccess(for: .video) else {
        guard activationID == activation, isVisible else { return }
        state = .permissionUnavailable
        return
      }
    case .denied, .restricted:
      state = .permissionUnavailable
      return
    @unknown default:
      state = .cameraUnavailable
      return
    }

    guard activationID == activation, isVisible else { return }
    guard scenePhase == .active else {
      state = .paused
      return
    }
    guard DataScannerViewController.isAvailable else {
      state = .cameraUnavailable
      return
    }

    scannerID = UUID()
    state = .scanning
  }
}

private struct QRDataScanner: UIViewControllerRepresentable {
  let sessionID: UUID
  let onScan: (String, UUID) -> Void
  let onUnavailable: () -> Void

  func makeCoordinator() -> Coordinator {
    Coordinator(sessionID: sessionID, onScan: onScan, onUnavailable: onUnavailable)
  }

  func makeUIViewController(context: Context) -> DataScannerViewController {
    let scanner = DataScannerViewController(
      recognizedDataTypes: [.barcode(symbologies: [.qr])],
      recognizesMultipleItems: false,
      isHighFrameRateTrackingEnabled: false,
      isPinchToZoomEnabled: false,
      isGuidanceEnabled: false,
      isHighlightingEnabled: false
    )
    scanner.delegate = context.coordinator
    do {
      try scanner.startScanning()
    } catch {
      Task { @MainActor in context.coordinator.scanningUnavailable() }
    }
    return scanner
  }

  func updateUIViewController(_ scanner: DataScannerViewController, context: Context) {
    context.coordinator.onScan = onScan
    context.coordinator.onUnavailable = onUnavailable
  }

  static func dismantleUIViewController(
    _ scanner: DataScannerViewController,
    coordinator: Coordinator
  ) {
    coordinator.stop(scanner)
    scanner.delegate = nil
  }

  @MainActor
  final class Coordinator: NSObject, DataScannerViewControllerDelegate {
    private let sessionID: UUID
    var onScan: (String, UUID) -> Void
    var onUnavailable: () -> Void
    private var isActive = true

    init(
      sessionID: UUID,
      onScan: @escaping (String, UUID) -> Void,
      onUnavailable: @escaping () -> Void
    ) {
      self.sessionID = sessionID
      self.onScan = onScan
      self.onUnavailable = onUnavailable
    }

    func dataScanner(
      _ dataScanner: DataScannerViewController,
      didAdd addedItems: [RecognizedItem],
      allItems: [RecognizedItem]
    ) {
      guard isActive else { return }
      for item in addedItems {
        guard case .barcode(let barcode) = item,
          let payload = barcode.payloadStringValue
        else {
          continue
        }
        isActive = false
        dataScanner.stopScanning()
        onScan(payload, sessionID)
        return
      }
    }

    func dataScanner(
      _ dataScanner: DataScannerViewController,
      becameUnavailableWithError error: DataScannerViewController.ScanningUnavailable
    ) {
      scanningUnavailable()
    }

    func scanningUnavailable() {
      guard isActive else { return }
      isActive = false
      onUnavailable()
    }

    func stop(_ scanner: DataScannerViewController) {
      isActive = false
      scanner.stopScanning()
    }
  }
}
