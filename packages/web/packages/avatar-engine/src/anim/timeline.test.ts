import { describe, expect, it } from "vitest";
import character from "@character/character.json";
import rig from "@character/rig.json";
import poses from "@character/poses.json";
import timelines from "@character/timelines.json";
import behavior from "@character/behavior.json";
import sayings from "@character/sayings.json";
import { loadConfig } from "../config/load";
import { createChannels } from "../runtime/channels";
import { createScheduler } from "../runtime/scheduler";
import { createTweens } from "../runtime/tween";
import { seedChannels } from "../scene/rig";
import { playTimeline } from "./timeline";

const config = loadConfig({ character, rig, poses, timelines, behavior, sayings });

const ctx = () => {
  const channels = createChannels();
  seedChannels(config, channels);
  return { config, channels, tweens: createTweens(channels), scheduler: createScheduler() };
};

const step = (c: ReturnType<typeof ctx>, from: number, to: number): void => {
  for (let t = from; t <= to + 1e-12; t += 1 / 60) {
    c.scheduler.tick(t);
    c.tweens.tick(t);
  }
  c.scheduler.tick(to);
  c.tweens.tick(to);
};

describe("playTimeline", () => {
  it("reports the yawn's span", () => {
    const c = ctx();
    const h = playTimeline(c, "yawn", 10);
    expect(h.startedAt).toBe(10);
    expect(h.endsAt).toBeCloseTo(12.1, 12);
  });

  it("promotes the mouth into `mouthO` at 0 and snaps back at 1.85, never tweening it", () => {
    const c = ctx();
    expect(c.channels.get("mouth.family")).toBe("mouth");   // the rest seed
    playTimeline(c, "yawn", 0);
    // The crossing happens at the timeline's very first instant, and it is
    // invisible because the promote re-expresses the shape the rig is ALREADY
    // drawing: whatever polyline the interrupted mood left in the channel, as
    // four cubics. Nothing about the mouth moves on this frame — which is the
    // only reason a family snap is allowed to sit at `at: 0` at all.
    step(c, 0, 0);
    expect(c.channels.get("mouth.family")).toBe("mouthO");
    expect(c.channels.get("mouth.shape")).toBe(
      "M187,233"
      + "C189.166667,235.166667,191.333333,237.333333,193.5,239.5"
      + "C195.666667,241.666667,197.833333,243.833333,200,246"
      + "C202.166667,243.833333,204.333333,241.666667,206.5,239.5"
      + "C208.666667,237.333333,210.833333,235.166667,213,233",
    );
    // The EXACT curve the 0.85s inhale reaches half way through, not merely
    // "some cubic path" — `/^MC+$/` is true of the promote's own output too, so
    // it stays true when the inhale never runs. Derived, not copied off a run:
    // 0.425s of 0.85 is p = 0.5, and `power2.in` is GSAP's naming for a CUBIC
    // ease, so the morph is 0.5^3 = 0.125 of the way between the promoted V and
    // the small O — e.g. the apex anchor is 246 + 0.125 * (247 - 246) = 246.125.
    step(c, 0, 0.425);
    expect(c.channels.get("mouth.shape")).toBe(
      "M188.625,232"
      + "C191.142171,233.895834,193.541666,236.407254,195.4375,239.0625"
      + "C197.333334,241.717746,198.725504,244.229166,200,246.125"
      + "C201.274496,244.229166,202.666666,241.717746,204.5625,239.0625"
      + "C206.458334,236.407254,208.857829,233.895834,211.375,232",
    );
    step(c, 0.425, 1.8);
    expect(c.channels.get("mouth.family")).toBe("mouthO");   // still open at 1.8
    step(c, 1.8, 1.9);
    expect(c.channels.get("mouth.family")).toBe("mouth");
    // Written verbatim by the snap, and spanning x 187..213 — the same width as
    // the flat O it replaces, so the instant the family changes costs the mouth
    // no width. A narrower parked line is visible as a twitch at 1.85.
    expect(c.channels.get("mouth.shape")).toBe("M187,235L200,235L213,235");
  });

  it("never asks the morph to cross families", () => {
    const c = ctx();
    playTimeline(c, "yawn", 0);
    // A step that DID cross families would not throw — `lerpValue` snaps such a
    // pair (Task 10) — so "it ran without throwing" proves nothing here. What a
    // snap cannot fake is movement: it writes one value and holds it. Sampling
    // across the 0.85s inhale and the 0.4s apex that follows it, and requiring
    // every sample to differ, is therefore the assertion — it fails the moment
    // either of those morphs degenerates into a snap.
    const seen = new Set<unknown>();
    let at = 0;
    for (const t of [0.2, 0.5, 0.8, 1.1]) {
      step(c, at, t);
      seen.add(c.channels.get("mouth.shape"));
      at = t;
    }
    expect(seen.size).toBe(4);
  });

  it("ends on a flat slit, back in family `mouth`", () => {
    // NOT the rig's resting mouth. The rig rests on the `idle` V
    // (`M187,233L200,246L213,233`); the yawn's closing snap at t=1.85 writes a
    // flat line, because a yawn ends with the lips shut. Reading `mouth.shape`
    // before playing and asserting the timeline returns to it would compare the
    // V against the flat line and fail.
    const c = ctx();
    expect(c.channels.get("mouth.shape")).toBe("M187,233L200,246L213,233");
    playTimeline(c, "yawn", 0);
    step(c, 0, 2.1);
    expect(c.channels.get("mouth.shape")).toBe("M187,235L200,235L213,235");
    expect(c.channels.get("mouth.family")).toBe("mouth");
  });

  it("calls onDone exactly once, at the end", () => {
    const c = ctx();
    let done = 0;
    playTimeline(c, "yawn", 0, () => { done += 1; });
    step(c, 0, 2.0);
    expect(done).toBe(0);
    step(c, 2.0, 2.2);
    expect(done).toBe(1);
    step(c, 2.2, 5);
    expect(done).toBe(1);
  });

  it("cancels cleanly without firing onDone", () => {
    const c = ctx();
    let done = 0;
    const h = playTimeline(c, "yawn", 0, () => { done += 1; });
    step(c, 0, 1.0);
    h.cancel();
    step(c, 1.0, 5);
    expect(done).toBe(0);
  });

  it("restores the promoted SHAPE alongside the family, and only while snapped", () => {
    // Restoring the family alone left `mouth.shape` holding the "MCCCC" path the
    // promote wrote while `mouth.family` said "mouth" — a pair nothing else in
    // the engine produces — and the next promote out of that node read the cubic
    // and threw `can only promote an open polyline, not "MCCCC"`.
    const c = ctx();
    const rest = c.channels.get("mouth.shape") as string;
    // The rig's declared mouth is an open polyline; that is what a promote
    // consumes, and what a cancel has to give back.
    expect(rest.replace(/[^A-Za-z]/g, "")).toBe("MLL");
    const h = playTimeline(c, "yawn", 0);
    step(c, 0, 0.5);
    expect(c.channels.get("mouth.family")).toBe("mouthO");
    h.cancel();
    expect(c.channels.get("mouth.family")).toBe("mouth");
    expect(c.channels.get("mouth.shape")).toBe(rest);
    // And it survives the frames after the cancel: the promote's own tween is
    // still live at 0.5 (the inhale runs to 0.85), so a restore that did not
    // take the channel off that tween would be overwritten on the very next
    // `tweens.tick`.
    step(c, 0.5, 1.5);
    expect(c.channels.get("mouth.shape")).toBe(rest);
  });

  it("leaves a completed timeline alone when cancel arrives after its closing snap", () => {
    // The arbiter cancels every choreo handle on the next mood change, whether
    // the timeline ran to completion or not. The yawn hands `mouth.family` back
    // itself at `at: 1.85`; a cancel after that must touch nothing, or it drags
    // the mouth back to the shape the timeline spent two seconds animating away
    // from — and re-records every golden that plays one.
    const c = ctx();
    const h = playTimeline(c, "yawn", 0);
    step(c, 0, 2.1);
    const settled = c.channels.get("mouth.shape");
    h.cancel();
    expect(c.channels.get("mouth.family")).toBe("mouth");
    expect(c.channels.get("mouth.shape")).toBe(settled);
  });

  it("leaves the channel untouched when a promote cannot be performed", () => {
    // Reachable only from a state nobody authored — the loader checks every
    // promote statically — so the answer is the one `tween.ts` gives an
    // unauthored family crossing: do nothing, rather than throw out of
    // `engine.tick` (or, in Swift, trap the process).
    const c = ctx();
    playTimeline(c, "yawn", 0);
    step(c, 0, 0.5);
    const promotedShape = c.channels.get("mouth.shape") as string;
    expect(promotedShape.replace(/[^A-Za-z]/g, "")).toBe("MCCCC");
    // A second play with the first still standing: its promote reads the cubic.
    expect(() => { playTimeline(c, "yawn", 0.5); step(c, 0.5, 0.5); }).not.toThrow();
    expect(c.channels.get("mouth.family")).toBe("mouthO");
    // Untouched by the refused promote — the frame it fires on writes nothing.
    expect(c.channels.get("mouth.shape")).toBe(promotedShape);
  });

  it("holds each phase at the instant it was authored for", () => {
    // t = 1.775 is 0.325s into the `back.out(1.6)` settle authored at 1.45 — deep
    // enough into the overshoot to be a number no other schedule produces. If the
    // expansion loses each step's own start instant (scheduling every tween at the
    // timeline's start rather than at `fired`), the whole 2.1s structure collapses
    // onto t=0 and this is the assertion that notices.
    const c = ctx();
    playTimeline(c, "yawn", 0);
    step(c, 0, 1.775);
    expect(c.channels.get("body.scaleX") as number).toBeCloseTo(0.991, 12);
    expect(c.channels.get("body.scaleY") as number).toBeCloseTo(0.991, 12);
  });

  it("keeps the pose delay ladder out of a timeline", () => {
    // `browLeft` carries a 0.06s ladder delay in behavior.json. The yawn authors
    // its brow lift at `at: 0`, so under the ladder the tween would not have
    // started at t = 0.04 and the channel would still read its rest 0. Timelines
    // place their own steps in time; the ladder is a POSE mechanism, and applying
    // it here would smear every phase by up to 80ms.
    const c = ctx();
    playTimeline(c, "yawn", 0);
    step(c, 0, 0.04);
    expect(c.channels.get("browLeft.rotation") as number)
      .toBeCloseTo(-0.0006252798697333604, 15);
  });

  it("throws on an unknown timeline", () => {
    const c = ctx();
    expect(() => playTimeline(c, "shrug", 0)).toThrow("unknown timeline: shrug");
  });

  it("lands on identical numbers at 60 and 240 fps", () => {
    // The whole store, not one channel, and MID-FLIGHT as well as at the end.
    // An end-state-only comparison is true by construction under rule 2 — every
    // tween has finished and written its literal `to` — so it passes no matter
    // what the engine did in between. t = 1.0 sits 0.15s into the apex phase
    // authored at 0.85, where every value depends both on when that phase fired
    // and on what the phase it replaced had reached at that instant: it is rule
    // 5's guarantee, read through the real config.
    const snapshot = (fps: number, until: number): string => {
      const c = ctx();
      playTimeline(c, "yawn", 0);
      for (let t = 0; t <= until + 1e-12; t += 1 / fps) { c.scheduler.tick(t); c.tweens.tick(t); }
      c.scheduler.tick(until); c.tweens.tick(until);
      // `names()` sorts, so the snapshot is stable and a diff names the channel.
      return JSON.stringify(c.channels.names().map((k) => [k, c.channels.get(k)]));
    };
    expect(snapshot(60, 1.0)).toBe(snapshot(240, 1.0));
    expect(snapshot(60, 2.1)).toBe(snapshot(240, 2.1));
  });
});
