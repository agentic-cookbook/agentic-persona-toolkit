import Testing
@testable import AgenticDeveloperToolkit

/// Collects events off the actor's stream so a test can look at what has
/// arrived *so far* — the whole point of `scriptWaitsForTheFirstSend`, which
/// has to prove the script had not started yet. Draining into a local `var`
/// from a detached `Task` cannot show that: the array is only readable once
/// the loop ends, by which time the stream has finished either way.
private actor EventBox {
    private(set) var events: [InboundEvent] = []
    func append(_ event: InboundEvent) { events.append(event) }
}

@Suite("Scripted backend")
struct ScriptedBackendTests {

    private static func twoStatusEvents() -> [InboundEvent] {
        [
            .statusChanged(participantID: "p", status: ChatStatus(kind: .think)),
            .statusChanged(participantID: "p", status: nil),
        ]
    }

    @Test(".immediately replays with nothing sent, and finishes the stream")
    func immediatelyReplaysWithoutASend() async {
        let backend = ScriptedBackend(script: Self.twoStatusEvents(), start: .immediately)

        var count = 0
        for await _ in backend.inboundEvents { count += 1 }

        #expect(count == 2)
        let sent = await backend.sent
        #expect(sent.isEmpty)
    }

    /// The regression guard for a real defect: `ScriptedBackend.olyloDemo` is
    /// built when the chat surface is built — at app launch — so a script that
    /// replays from `init` makes the persona think and post a canned reply
    /// with nothing typed, and then stay silent forever because the script is
    /// spent. `.onFirstSend` is what makes the demo behave like a turn.
    @Test(".onFirstSend stays silent until something is sent, then replays")
    func scriptWaitsForTheFirstSend() async throws {
        let backend = ScriptedBackend(script: Self.twoStatusEvents(), start: .onFirstSend)
        let box = EventBox()
        let drained = Task {
            for await event in backend.inboundEvents { await box.append(event) }
        }

        // Far longer than `.immediately` needs: with `delayBetweenEvents`
        // defaulted to `.zero`, that mode yields the whole script and finishes
        // on the next run loop turn, so anything arriving here is the bug.
        try await Task.sleep(for: .milliseconds(100))
        let beforeSend = await box.events
        #expect(beforeSend.isEmpty)

        _ = try await backend.send(text: "hi", attachments: [])
        await drained.value

        let afterSend = await box.events
        #expect(afterSend.count == 2)
    }

    @Test("a second send does not replay the script")
    func scriptPlaysOnlyOnce() async throws {
        let backend = ScriptedBackend(script: Self.twoStatusEvents(), start: .onFirstSend)
        let box = EventBox()
        let drained = Task {
            for await event in backend.inboundEvents { await box.append(event) }
        }

        _ = try await backend.send(text: "first", attachments: [])
        _ = try await backend.send(text: "second", attachments: [])
        await drained.value

        let events = await box.events
        #expect(events.count == 2)
        let sent = await backend.sent
        #expect(sent.map(\.text) == ["first", "second"])
        #expect(sent.map(\.localID) == ["local-1", "local-2"])
    }

    @Test("setLocalTyping is recorded but does not start the script")
    func typingDoesNotStartTheScript() async throws {
        let backend = ScriptedBackend(script: Self.twoStatusEvents(), start: .onFirstSend)
        let box = EventBox()
        let drained = Task {
            for await event in backend.inboundEvents { await box.append(event) }
        }

        try await backend.setLocalTyping(true)
        try await Task.sleep(for: .milliseconds(100))
        let beforeSend = await box.events
        #expect(beforeSend.isEmpty)

        let typingCalls = await backend.typingCalls
        #expect(typingCalls == [true])

        _ = try await backend.send(text: "hi", attachments: [])
        await drained.value
        let afterSend = await box.events
        #expect(afterSend.count == 2)
    }
}
