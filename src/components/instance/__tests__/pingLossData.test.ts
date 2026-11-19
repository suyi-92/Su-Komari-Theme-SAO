import { describe, expect, it } from "vitest";
import { buildPingLossBands, clipPingLossBand } from "../pingLossData";

function sample(task_id: number, time: number, value: number, count?: number, loss?: number) {
  return { time, record: { task_id, time, value, count, loss, client: "node-a" } };
}

describe("Ping loss bands", () => {
  it("carries full-loss buckets independently of latency and keeps empty buckets unmeasured", () => {
    const bands = buildPingLossBands([
      sample(1, 0, 35, 10, 20),
      sample(2, 0, -1, 5, 100),
      sample(1, 60, -1, 0, 100),
      sample(2, 60, -1, 6, 100),
      sample(1, 120, 38, 5, 0),
    ], new Map([[1, 60], [2, 60], [3, 60]]), 60);

    expect(clipPingLossBand(bands.get(1)!, 0, 180)).toEqual([
      { start: 0, end: 60, sample: { time: 0, total: 10, lost: 2 } },
      { start: 60, end: 120, sample: null },
      { start: 120, end: 180, sample: { time: 120, total: 5, lost: 0 } },
    ]);
    expect(clipPingLossBand(bands.get(2)!, 0, 180)).toEqual([
      { start: 0, end: 60, sample: { time: 0, total: 5, lost: 5 } },
      { start: 60, end: 120, sample: { time: 60, total: 6, lost: 6 } },
      { start: 120, end: 180, sample: null },
    ]);
    expect(clipPingLossBand(bands.get(3)!, 0, 180)).toEqual([
      { start: 0, end: 180, sample: null },
    ]);
  });

  it("uses legacy per-task cadence, covering normal jitter while preserving missed intervals", () => {
    const bands = buildPingLossBands([
      sample(1, 100, 0),
      sample(2, 150, -1),
      sample(1, 165, -1),
      sample(1, 165, 20),
      sample(1, 285, 25),
    ], new Map([[1, 60], [2, 120]]));

    expect(clipPingLossBand(bands.get(1)!, 105, 260)).toEqual([
      { start: 105, end: 132.5, sample: { time: 100, total: 1, lost: 0 } },
      { start: 132.5, end: 195, sample: { time: 165, total: 2, lost: 1 } },
      { start: 195, end: 255, sample: null },
      { start: 255, end: 260, sample: { time: 285, total: 1, lost: 0 } },
    ]);
    expect(clipPingLossBand(bands.get(2)!, 105, 260)).toEqual([
      { start: 105, end: 210, sample: { time: 150, total: 1, lost: 1 } },
      { start: 210, end: 260, sample: null },
    ]);
  });
});
