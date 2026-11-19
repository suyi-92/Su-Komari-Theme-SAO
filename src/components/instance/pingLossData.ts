import type { PingRecord } from "@/types/komari";
import { resolvePingSampleCounts } from "@/utils/pingMetrics";

export interface PingLossSample {
  time: number;
  total: number;
  lost: number;
}

export interface PingLossSegment {
  start: number;
  end: number;
  sample: PingLossSample | null;
}

export function buildPingLossBands(
  sortedRecords: ReadonlyArray<{ record: PingRecord; time: number }>,
  intervalsByTask: ReadonlyMap<number, number>,
  metricBucketSeconds?: number,
) {
  const samplesByTask = new Map<number, PingLossSample[]>();
  for (const { record, time } of sortedRecords) {
    if (!intervalsByTask.has(record.task_id) || record.count === 0) continue;
    const { total, lost } = resolvePingSampleCounts(record);
    const samples = samplesByTask.get(record.task_id) ?? [];
    const previous = samples.at(-1);
    if (previous?.time === time) {
      previous.total += total;
      previous.lost += lost;
    } else {
      samples.push({ time, total, lost });
      samplesByTask.set(record.task_id, samples);
    }
  }

  const bands = new Map<number, PingLossSegment[]>();
  for (const [taskId, interval] of intervalsByTask) {
    const samples = samplesByTask.get(taskId) ?? [];
    const aggregate = metricBucketSeconds != null && metricBucketSeconds > 0;
    bands.set(taskId, samples.map((sample, index) => {
      const { time } = sample;
      const before = samples[index - 1]?.time ?? Number.NEGATIVE_INFINITY;
      const after = samples[index + 1]?.time ?? Number.POSITIVE_INFINITY;
      if (aggregate) {
        // Metric history timestamps mark the start of their aggregation buckets.
        return { start: time, end: Math.min(time + interval, after), sample };
      }
      // Split adjacent raw samples at their midpoint, leaving missed intervals uncovered.
      const start = time - before <= interval * 1.25 ? (before + time) / 2 : time - interval / 2;
      const end = after - time <= interval * 1.25 ? (time + after) / 2 : time + interval / 2;
      return { start, end, sample };
    }));
  }
  return bands;
}

export function clipPingLossBand(band: PingLossSegment[], min: number, max: number) {
  const visible: PingLossSegment[] = [];
  let cursor = min;
  for (const segment of band) {
    if (segment.end <= min) continue;
    if (segment.start >= max) break;
    const start = Math.max(segment.start, min);
    const end = Math.min(segment.end, max);
    if (start > cursor) visible.push({ start: cursor, end: start, sample: null });
    visible.push({ start, end, sample: segment.sample });
    cursor = end;
  }
  if (cursor < max) visible.push({ start: cursor, end: max, sample: null });
  return visible;
}
