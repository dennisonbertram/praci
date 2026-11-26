import Testing

@testable import RakazoCore

@Suite struct BotAvatarTests {
  @Test func initialSkipsPunctuationAndParentheses() {
    #expect(BotAvatar.initial(of: "[MOCK] Notice of Stockholder Action") == "M")
    #expect(BotAvatar.initial(of: "(Draft) legal") == "L")
    #expect(BotAvatar.initial(of: "  - 2fa helper") == "2")
    #expect(BotAvatar.initial(of: "élan") == "É")
    #expect(BotAvatar.initial(of: "[] !!") == "?")
    #expect(BotAvatar.initial(of: "") == "?")
  }

  // packages/contracts/src/bot-avatar.test.ts
  @Test func parsesHexEncodedShapesAndDataImages() {
    #expect(BotAvatar.parse("#8B5CF6") == .color("#8B5CF6"))
    #expect(BotAvatar.parse("#8B5CF6::shape_3") == .shape(color: "#8B5CF6", shapeIndex: 3))
    #expect(BotAvatar.parse("data:image/png;base64,abc") == .image("data:image/png;base64,abc"))
  }

  @Test func doesNotTreatRemoteURLsAsImages() {
    let url = "https://evil.example/track.png"
    #expect(BotAvatar.parse(url) == .other(url))
    #expect(BotAvatar.parse("gray") == .other("gray"))
  }

  @Test func shapeIndexWrapsAndBadIndexFallsToZero() {
    #expect(BotAvatar.parse("#fff::shape_11") == .shape(color: "#fff", shapeIndex: 3))
    #expect(BotAvatar.parse("#fff::shape_x") == .shape(color: "#fff", shapeIndex: 0))
    #expect(BotAvatar.parse("::shape_2") == .shape(color: "#F97316", shapeIndex: 2))
  }

  // packages/core/src/bot-avatar-shapes.test.ts
  @Test func keepsTheSameEightShapesTheParserEncodes() {
    #expect(BotAvatar.shapeKeys.count == BotAvatar.shapeCount)
    #expect(BotAvatar.shapePath(3) == BotAvatar.shapes["tablet"])
    #expect(BotAvatar.shapePath(3) != BotAvatar.shapePath(0))
    #expect(BotAvatar.shapePath(11) == BotAvatar.shapePath(3))
    #expect(BotAvatar.shapePath(-5) == BotAvatar.shapePath(3))
  }

  @Test func emitsPathGeometryOnly() {
    for key in BotAvatar.shapeKeys {
      let path = BotAvatar.shapes[key] ?? ""
      #expect(path.hasPrefix("M"))
      #expect(!path.contains("<") && !path.contains(">") && !path.contains("url("))
      let segments = BotAvatar.segments(of: path)
      #expect(segments.first != nil && segments.last == .close)
      // one segment per command letter: the shipped paths never repeat a command implicitly
      #expect(segments.count == path.filter(\.isLetter).count)
    }
  }

  @Test func parsesPathCommands() {
    let parsed = BotAvatar.segments(of: "M1.5 -2Q3 4-5 6L7 8C1 2 3 4 5 6Z")
    #expect(
      parsed == [
        .move(x: 1.5, y: -2), .quad(cx: 3, cy: 4, x: -5, y: 6), .line(x: 7, y: 8),
        .curve(c1x: 1, c1y: 2, c2x: 3, c2y: 4, x: 5, y: 6), .close,
      ])
  }

  @Test func firstSegmentOfBlobIsItsStartPoint() {
    let blob = BotAvatar.segments(of: BotAvatar.shapes["blob"]!)
    #expect(blob.first == .move(x: 228.541, y: 114.228))
  }

  // packages/core/src/bot-avatar-colors.test.ts
  @Test func keepsAmberGoldOnDarkEyes() {
    #expect(BotAvatar.resolveColor(identity: "preview", explicit: "#EAB308").eyeColor == "#141414")
    #expect(BotAvatar.resolveColor(identity: "preview", explicit: "#8B5CF6").eyeColor == "#FFFFFF")
  }

  @Test func customHexSynthesizesDarkerShade() {
    let def = BotAvatar.resolveColor(identity: "x", explicit: "#112233")
    #expect(def.id == "custom")
    #expect(def.dark == "#0d1b28")
    #expect(def.eyeColor == "#FFFFFF")
    #expect(BotAvatar.resolveColor(identity: "x", explicit: "#fffffe").eyeColor == "#141414")
  }

  @Test func namedColorsResolveById() {
    #expect(BotAvatar.resolveColor(identity: "x", explicit: "violet").hex == "#8B5CF6")
  }

  // Golden values computed from the TypeScript implementation with node.
  @Test func identityHashAndFallbackColorMatchTypeScript() {
    #expect(BotAvatar.hash("preview") == 1_257_924_439)
    #expect(BotAvatar.hash("bot-1") == 3_391_207_752)
    #expect(BotAvatar.hash("héllo😀") == 4_113_148_722)
    #expect(BotAvatar.resolveColor(identity: "preview").id == "yellow")
    #expect(BotAvatar.resolveColor(identity: "bot-1").id == "red")
    #expect(BotAvatar.resolveColor(identity: "Atlas", explicit: "gray?").id == "red")
  }

  // apps/mobile/lib/bot-avatar.test.ts
  @Test func presentationKeepsTheShapeAndEyeColor() {
    #expect(
      BotAvatar.presentation("#8B5CF6::shape_3")
        == .shape(color: "#8B5CF6", shapeIndex: 3, eyeColor: "#FFFFFF"))
    #expect(
      BotAvatar.presentation("#EAB308::shape_1")
        == .shape(color: "#EAB308", shapeIndex: 1, eyeColor: "#141414"))
    #expect(BotAvatar.presentation("#8B5CF6") == .color("#8B5CF6"))
    #expect(
      BotAvatar.presentation("data:image/png;base64,abc") == .image("data:image/png;base64,abc"))
    #expect(
      BotAvatar.presentation("https://evil.example/track.png")
        == .other("https://evil.example/track.png"))
  }

  @Test func recolorKeepsShapeAndNeverOverwritesImages() {
    #expect(BotAvatar.recolor("#111111", to: "#8B5CF6") == "#8B5CF6")
    #expect(BotAvatar.recolor("#111111::shape_3", to: "#8B5CF6") == "#8B5CF6::shape_3")
    let image = "data:image/webp;base64,AAAA"
    #expect(BotAvatar.recolor(image, to: "#8B5CF6") == image)
  }
}
