import Testing

@testable import Praci

@Test
func pushPayloadsMapToThreads() {
  let bot = PushTarget(userInfo: [
    "kind": "notification", "botId": "b1", "threadId": "t1", "spaceId": "s1", "aps": ["alert": "x"],
  ])
  #expect(bot == PushTarget(userInfo: ["botId": "b1", "spaceId": "s1"]))
  #expect(bot?.thread == .bot("b1"))
  #expect(bot?.spaceID == "s1")
  #expect(PushTarget(userInfo: ["botId": "b1", "groupId": "g1"])?.thread == .group("g1"))
  #expect(PushTarget(userInfo: ["botId": "b1"])?.spaceID == nil)
  #expect(PushTarget(userInfo: ["botId": ""]) == nil)
  #expect(PushTarget(userInfo: ["link": "/app/investors", "surface": "investors"]) == nil)
  #expect(PushTarget(userInfo: ["botId": 5]) == nil)
}

@Test
func bannerHidesOnlyForTheOpenThread() throws {
  let target = try #require(PushTarget(userInfo: ["botId": "b1", "spaceId": "s1"]))
  #expect(!target.showsBanner(openRoute: .thread(.bot("b1")), activeSpaceID: "s1"))
  #expect(target.showsBanner(openRoute: .thread(.bot("b2")), activeSpaceID: "s1"))
  #expect(target.showsBanner(openRoute: .thread(.group("b1")), activeSpaceID: "s1"))
  #expect(target.showsBanner(openRoute: .thread(.bot("b1")), activeSpaceID: "s2"))
  #expect(target.showsBanner(openRoute: nil, activeSpaceID: "s1"))
}
