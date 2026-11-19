import { ArrowDownWideNarrow, ArrowUpNarrowWide } from "lucide-react";
import { Dropdown } from "@/components/ui/Dropdown";
import {
  HOME_SORT_FIELD_LABELS,
  HOME_SORT_OPTIONS,
  type HomeSortDirection,
} from "@/utils/homeSort";
import type { HomeSortControlState } from "@/hooks/useHomeSort";

// 单个图标同时表达排序与方向。
function SortIcon({ direction, size = 14 }: { direction: HomeSortDirection; size?: number }) {
  return direction === "asc" ? (
    <ArrowUpNarrowWide size={size} aria-hidden />
  ) : (
    <ArrowDownWideNarrow size={size} aria-hidden />
  );
}

// 选择当前维度会翻转方向，选择其他维度会采用该维度的自然方向。
export function HomeSortControl({ state }: { state: HomeSortControlState }) {
  const { field, direction, setField, toggleDirection } = state;
  const directionLabel = direction === "asc" ? "升序" : "降序";

  return (
    <div className="home-sort">
      <Dropdown
        label={`排序方式，当前${HOME_SORT_FIELD_LABELS[field]}${directionLabel}`}
        title={`排序：${HOME_SORT_FIELD_LABELS[field]}（${directionLabel}）`}
        value={field}
        options={HOME_SORT_OPTIONS}
        onValueChange={setField}
        onReselect={toggleDirection}
        variant="toolbar"
        align="end"
        leadingIcon={<SortIcon direction={direction} />}
        selectedIcon={<SortIcon direction={direction} size={15} />}
        keepOpen
      />
    </div>
  );
}
