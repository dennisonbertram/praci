import Testing

@testable import Praci

struct BottomFollowTests {
  @Test func followsGrowthAtTheBottom() {
    #expect(BottomFollow.shouldFollow(heightChanged: true, atBottom: true, userScrolling: false))
  }

  @Test func doesNotFollowWhileTheReaderDrags() {
    #expect(!BottomFollow.shouldFollow(heightChanged: true, atBottom: true, userScrolling: true))
  }

  @Test func doesNotFollowAfterTheReaderLeftTheBottom() {
    #expect(!BottomFollow.shouldFollow(heightChanged: true, atBottom: false, userScrolling: false))
  }

  @Test func doesNothingWithoutGrowth() {
    #expect(!BottomFollow.shouldFollow(heightChanged: false, atBottom: true, userScrolling: false))
  }
}
