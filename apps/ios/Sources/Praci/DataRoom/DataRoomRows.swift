import RakazoAPI
import SwiftUI
import UniformTypeIdentifiers

enum DataRoomFormat {
  static func icon(for item: DataRoomItem) -> String {
    let type = UTType(mimeType: item.mimeType)
    if type?.conforms(to: .pdf) == true { return "doc.richtext" }
    if type?.conforms(to: .image) == true { return "photo" }
    if type?.conforms(to: .movie) == true { return "film" }
    if type?.conforms(to: .spreadsheet) == true || item.mimeType.contains("csv") { return "tablecells" }
    if type?.conforms(to: .text) == true { return "doc.text" }
    if type?.conforms(to: .archive) == true { return "doc.zipper" }
    return "doc"
  }

  static func kind(_ item: DataRoomItem) -> String {
    UTType(mimeType: item.mimeType)?.preferredFilenameExtension?.uppercased()
      ?? URL(filePath: item.name).pathExtension.uppercased()
  }

  static func date(_ iso: String) -> String? {
    InboxRow.parseDate(iso)?.formatted(.dateTime.month(.abbreviated).day())
  }

  /// Bold the matched words; the server's marker characters never reach the screen.
  static func highlighted(_ snippet: String) -> AttributedString {
    var result = AttributedString()
    for run in DataRoomHighlight.runs(snippet) {
      var part = AttributedString(run.text)
      if run.isMatch { part.inlinePresentationIntent = .stronglyEmphasized }
      result += part
    }
    return result
  }
}

struct DataRoomFolderRow: View {
  let folder: DataRoomFolder

  var body: some View {
    HStack {
      Label(folder.name, systemImage: "folder")
      Spacer()
      if let count = folder.itemCount {
        Text(count, format: .number)
          .foregroundStyle(Color.token(.mutedForeground))
          .accessibilityLabel("\(count) items")
      }
    }
    .accessibilityIdentifier("folderRow")
  }
}

struct DataRoomItemRow: View {
  let item: DataRoomItem
  var snippet: String?

  var body: some View {
    HStack(spacing: 12) {
      Image(systemName: DataRoomFormat.icon(for: item))
        .font(.title3)
        .frame(width: 28)
        .foregroundStyle(Color.token(.mutedForeground))
        .accessibilityHidden(true)
      VStack(alignment: .leading, spacing: 2) {
        Text(item.name).lineLimit(2)
        if let snippet, !snippet.isEmpty {
          Text(DataRoomFormat.highlighted(snippet))
            .font(.footnote)
            .foregroundStyle(Color.token(.mutedForeground))
            .lineLimit(3)
        }
        status
      }
    }
    .accessibilityIdentifier("itemRow")
  }

  private var subtitle: String {
    [DataRoomFormat.kind(item), DataRoomFormat.date(item.createdAt)]
      .compactMap { $0 }
      .filter { !$0.isEmpty }
      .joined(separator: " · ")
  }

  @ViewBuilder
  private var status: some View {
    if item.isFailed {
      Label(item.error ?? "Couldn’t read this file", systemImage: "exclamationmark.triangle")
        .font(.footnote)
        .foregroundStyle(Color.token(.destructive))
    } else if item.isProcessing {
      HStack(spacing: 6) {
        ProgressView().controlSize(.mini)
        Text("Reading…")
      }
      .font(.footnote)
      .foregroundStyle(Color.token(.mutedForeground))
    } else {
      Text(subtitle)
        .font(.footnote)
        .foregroundStyle(Color.token(.mutedForeground))
    }
  }
}

struct DataRoomUploadRow: View {
  let upload: DataRoomModel.Upload
  let retry: () -> Void
  let cancel: () -> Void

  var body: some View {
    VStack(alignment: .leading, spacing: 6) {
      HStack {
        Text(upload.name).lineLimit(1)
        Spacer()
        if upload.failure == nil {
          Text(upload.fraction, format: .percent.precision(.fractionLength(0)))
            .monospacedDigit()
            .foregroundStyle(Color.token(.mutedForeground))
        }
        Button(action: cancel) { Label("Cancel upload", systemImage: "xmark") }
          .labelStyle(.iconOnly)
          .buttonStyle(.borderless)
          .accessibilityIdentifier("cancelUpload")
      }
      if let failure = upload.failure {
        Text(failure).font(.footnote).foregroundStyle(Color.token(.destructive))
        Button("Try again", action: retry)
          .buttonStyle(.borderless)
          .accessibilityIdentifier("retryUpload")
      } else {
        ProgressView(value: upload.fraction)
      }
    }
    .accessibilityIdentifier("uploadRow")
  }
}

struct DataRoomConsentSheet: View {
  let consent: DataRoomConsent
  let allow: () -> Void
  let dismiss: () -> Void

  var body: some View {
    VStack(spacing: 16) {
      Text("Let AI read your files?").font(.title3.bold()).multilineTextAlignment(.center)
      Text(consent.disclosure)
        .multilineTextAlignment(.center)
        .foregroundStyle(Color.token(.mutedForeground))
      ForEach(consent.recipients, id: \.name) { recipient in
        VStack(spacing: 2) {
          Text(recipient.name).font(.headline)
          if let detail = recipient.detail {
            Text(detail).font(.footnote).foregroundStyle(Color.token(.mutedForeground))
          }
        }
      }
      Button(action: allow) {
        Text("Allow").frame(maxWidth: .infinity).foregroundStyle(Color.token(.primaryForeground))
      }
      .buttonStyle(.borderedProminent)
      .controlSize(.large)
      .accessibilityIdentifier("dataRoomConsentAllow")
      Button("Not now", action: dismiss).accessibilityIdentifier("dataRoomConsentNotNow")
    }
    .padding(24)
    .frame(maxHeight: .infinity, alignment: .top)
    .presentationDetents([.medium])
  }
}
