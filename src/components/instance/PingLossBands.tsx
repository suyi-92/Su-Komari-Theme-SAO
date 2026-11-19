import { memo, useMemo, useState, type KeyboardEvent, type PointerEvent } from "react";
import { trimFixed } from "@/utils/format";
import { ChartTooltip } from "./ChartParts";
import { formatTooltipTime } from "./chartShared";
import { clipPingLossBand, type PingLossSegment } from "./pingLossData";

export interface PingLossViewport {
  min: number;
  max: number;
  left: number;
  width: number;
}

const EMPTY_BAND: PingLossSegment[] = [];

function segmentColor({ sample }: PingLossSegment) {
  if (!sample) return "var(--border-strong)";
  if (sample.lost === 0) return "var(--status-success)";
  if (sample.lost === sample.total) return "var(--status-error)";
  const intensity = 44 + 56 * sample.lost / sample.total;
  return `color-mix(in srgb, var(--status-error) ${intensity}%, var(--surface))`;
}

function percentAt(time: number, { min, max }: PingLossViewport) {
  return (time - min) / (max - min) * 100;
}

function buildBandBackground(segments: PingLossSegment[], viewport: PingLossViewport) {
  const runs: { start: number; end: number; color: string }[] = [];
  for (const segment of segments) {
    const color = segmentColor(segment);
    const previous = runs.at(-1);
    if (previous?.color === color) previous.end = segment.end;
    else runs.push({ start: segment.start, end: segment.end, color });
  }
  if (runs.length === 1) return runs[0].color;
  const stops = runs.map(({ start, end, color }) =>
    `${color} ${percentAt(start, viewport)}% ${percentAt(end, viewport)}%`,
  );
  return `linear-gradient(to right, ${stops.join(", ")})`;
}

function segmentIndexAt(segments: PingLossSegment[], time: number) {
  let low = 0;
  let high = segments.length - 1;
  while (low < high) {
    const middle = Math.floor((low + high) / 2);
    if (time < segments[middle].end) high = middle;
    else low = middle + 1;
  }
  return low;
}

function describeSegment(segment: PingLossSegment, hours: number) {
  const { sample } = segment;
  if (sample) {
    return {
      time: formatTooltipTime(sample.time, hours),
      value: `丢包 ${trimFixed(100 * sample.lost / sample.total, 1)}% (${sample.lost}/${sample.total})`,
    };
  }
  return {
    time: `${formatTooltipTime(segment.start, hours)} – ${formatTooltipTime(segment.end, hours)}`,
    value: "无采样",
  };
}

function PingLossBand({ label, band, viewport, hours }: {
  label: string;
  band: PingLossSegment[];
  viewport: PingLossViewport;
  hours: number;
}) {
  const [pointerTime, setPointerTime] = useState<number | null>(null);
  const [keyboardTime, setKeyboardTime] = useState<number | null>(null);
  const { min, max, left, width } = viewport;
  const segments = useMemo(() => clipPingLossBand(band, min, max), [band, min, max]);
  const background = useMemo(() => buildBandBackground(segments, viewport), [segments, viewport]);
  const selectedTime = pointerTime ?? keyboardTime;
  const time = Math.min(max, Math.max(min, selectedTime ?? min));
  const index = segmentIndexAt(segments, time);
  const segment = segments[index];
  const description = describeSegment(segment, hours);
  const percent = percentAt(time, viewport);

  function pointerToTime(event: PointerEvent<HTMLDivElement>) {
    const { left: start, width: trackWidth } = event.currentTarget.getBoundingClientRect();
    const fraction = Math.min(1, Math.max(0, (event.clientX - start) / trackWidth));
    return min + fraction * (max - min);
  }

  function onKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    let nextIndex = index;
    switch (event.key) {
      case "ArrowLeft":
      case "ArrowDown":
        nextIndex = Math.max(0, index - 1);
        break;
      case "ArrowRight":
      case "ArrowUp":
        nextIndex = Math.min(segments.length - 1, index + 1);
        break;
      case "Home":
        nextIndex = 0;
        break;
      case "End":
        nextIndex = segments.length - 1;
        break;
      default:
        return;
    }
    event.preventDefault();
    const next = segments[nextIndex];
    setPointerTime(null);
    setKeyboardTime((next.start + next.end) / 2);
  }

  return (
    <div className="instance-ping-loss-row" style={{ gridTemplateColumns: `${left}px ${width}px` }}>
      <span className="instance-ping-loss-label" title={label} aria-hidden="true">{label}</span>
      <div
        className="instance-ping-loss-track"
        style={{ background }}
        role="slider"
        tabIndex={0}
        aria-label={`${label} 丢包历史`}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(percent)}
        aria-valuetext={`${description.time}，${description.value}`}
        onPointerMove={(event) => {
          if (event.pointerType !== "touch") setPointerTime(pointerToTime(event));
        }}
        onPointerUp={(event) => {
          if (event.pointerType !== "touch" || !event.isPrimary) return;
          event.currentTarget.focus({ preventScroll: true });
          setKeyboardTime(pointerToTime(event));
        }}
        onPointerLeave={() => setPointerTime(null)}
        onFocus={(event) => {
          if (event.currentTarget.matches(":focus-visible")) setKeyboardTime((current) => current ?? min);
        }}
        onBlur={() => setKeyboardTime(null)}
        onKeyDown={onKeyDown}
      >
        {selectedTime != null && (
          <span className="instance-ping-loss-cursor" style={{ left: `${percent}%` }} aria-hidden="true" />
        )}
      </div>
      {selectedTime != null && (
        <ChartTooltip tooltip={{
          show: true,
          left: Math.min(left + percent * width / 100 + 8, Math.max(0, left + width - 220)),
          top: 16,
          time: description.time,
          rows: [{ label, value: description.value, color: segmentColor(segment) }],
        }} />
      )}
    </div>
  );
}

export const PingLossBands = memo(function PingLossBands({ bands, tasks, labels, viewport, hours }: {
  bands: ReadonlyMap<number, PingLossSegment[]>;
  tasks: ReadonlyArray<{ id: number }>;
  labels: ReadonlyMap<number, string>;
  viewport: PingLossViewport;
  hours: number;
}) {
  return (
    <div className="instance-ping-loss-bands" role="group" aria-label="Ping 丢包色带">
      {tasks.map(({ id }) => (
        <PingLossBand
          key={id}
          label={labels.get(id) ?? `任务 #${id}`}
          band={bands.get(id) ?? EMPTY_BAND}
          viewport={viewport}
          hours={hours}
        />
      ))}
    </div>
  );
});
