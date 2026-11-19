import { lazy, Suspense, useEffect, useId, useRef, useState, type ReactNode } from "react";
import {
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
  Eye,
  EyeOff,
  Grid3x3,
  LayoutGrid,
  List,
  Palette,
  Settings,
  SlidersHorizontal,
  Square,
} from "lucide-react";
import { Link } from "react-router-dom";
import { Dropdown } from "@/components/ui/Dropdown";
import { usePreferences } from "@/hooks/usePreferences";
import { useViewMode } from "@/hooks/useViewMode";
import { useNodeStoreStatus } from "@/hooks/useNode";
import { useAuth } from "@/hooks/useAuth";
import { useThemeSettings } from "@/hooks/useThemeSettings";
import { usePriceVisibility } from "@/hooks/usePriceVisibility";
import type { NodeViewMode } from "@/utils/themeSettings";
import { clsx } from "clsx";
import { APPEARANCE_OPTIONS } from "./appearanceOptions";

const MetricColorPicker = lazy(() =>
  import("./MetricColorPicker").then((module) => ({ default: module.MetricColorPicker })),
);

// 悬浮球切换按钮展示"下一档"的图标/文案(点击后会切到的视图),而不是当前视图——
// 与 ThemeManage 里 NODE_VIEW_MODE_OPTIONS 的图标语义保持一致。
const VIEW_MODE_META: Record<NodeViewMode, { icon: typeof Square; label: string }> = {
  large: { icon: Square, label: "大视图" },
  compact: { icon: LayoutGrid, label: "小视图" },
  mini: { icon: Grid3x3, label: "迷你视图" },
  list: { icon: List, label: "列表视图" },
};

const APPEARANCE_CHOICES = APPEARANCE_OPTIONS.map(({ value, label, icon: Icon }) => ({
  value,
  label,
  adornment: <Icon size={15} aria-hidden />,
}));

function Shortcut({ hint, children }: { hint: string; children: ReactNode }) {
  return (
    <span className="floating-control">
      {children}
      <span className="floating-control-tooltip" aria-hidden>{hint}</span>
    </span>
  );
}

export function FloatingControls({
  onExpandedChange,
}: {
  onExpandedChange?: (expanded: boolean) => void;
}) {
  const { appearance, setAppearance } = usePreferences();
  const { mode, nextMode, toggleMode } = useViewMode();
  const { data: me } = useAuth();
  const themeSettings = useThemeSettings();
  const { isPriceVisible, togglePriceVisibility } = usePriceVisibility();
  const { failureStreak } = useNodeStoreStatus();
  const [collapsed, setCollapsed] = useState(true);
  const [colorsOpen, setColorsOpen] = useState(false);
  const [colorsMounted, setColorsMounted] = useState(false);
  const actionsId = useId();
  const actionsRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const settingsReady = themeSettings.isReady;
  const showAdmin = settingsReady && themeSettings.enableAdminButton;
  // 主题管理入口与配色取色器都仅对登录管理员开放（配色存后端、全局生效）。
  const loggedIn = Boolean(me?.logged_in);
  const showThemeManage = loggedIn;
  const showColorPicker = loggedIn;
  const showPriceToggle = loggedIn;
  const showSyncWarning = failureStreak >= 2;
  const ToggleIcon = collapsed ? ChevronLeft : ChevronRight;
  const ViewIcon = VIEW_MODE_META[nextMode].icon;
  const { icon: AppearanceIcon, label: appearanceLabel } =
    APPEARANCE_OPTIONS.find(({ value }) => value === appearance) ?? APPEARANCE_OPTIONS[0];
  const priceLabel = isPriceVisible ? "隐藏价格与资产" : "显示价格与资产";
  const adminLabel = loggedIn ? "管理" : "后台登录";
  const toggleLabel = collapsed ? "展开快捷按钮" : "收起快捷按钮";

  // 只要不在最宽松的大卡默认态,就视为"已切换"，按钮保持高亮。
  const isReducedView = mode !== "large";
  useEffect(() => {
    onExpandedChange?.(false);
    return () => onExpandedChange?.(false);
  }, [onExpandedChange]);

  // 仅监听用户主动的滚轮/触摸滑动手势（wheel / touchmove），100% 免疫任何 DOM 尺寸变化或重排引发的 scroll 事件
  useEffect(() => {
    if (collapsed) return;

    const handleUserScroll = () => {
      if (actionsRef.current?.contains(document.activeElement)) {
        triggerRef.current?.focus({ preventScroll: true });
      }
      setCollapsed(true);
      setColorsOpen(false);
      onExpandedChange?.(false);
    };

    window.addEventListener("wheel", handleUserScroll, { passive: true });
    window.addEventListener("touchmove", handleUserScroll, { passive: true });

    return () => {
      window.removeEventListener("wheel", handleUserScroll);
      window.removeEventListener("touchmove", handleUserScroll);
    };
  }, [collapsed, onExpandedChange]);

  const toggleControls = () => {
    // 收起快捷栏时同时结束子面板状态，避免下次展开时调色盘自动复现。
    const nextCollapsed = !collapsed;
    if (nextCollapsed) setColorsOpen(false);
    setCollapsed(nextCollapsed);
    onExpandedChange?.(!nextCollapsed);
  };

  return (
    <div
      className={clsx(
        "floating-controls",
        collapsed && "is-collapsed",
        showSyncWarning && "has-warning",
      )}
    >
      <div className="floating-controls-inner">
        <div className="floating-controls-row">
          <Shortcut hint={toggleLabel}>
            <button
              ref={triggerRef}
              type="button"
              className="control-button floating-controls-trigger"
              aria-label={toggleLabel}
              aria-expanded={!collapsed}
              aria-controls={actionsId}
              onClick={toggleControls}
            >
              <ToggleIcon size={16} />
              {showSyncWarning && collapsed && (
                <span className="floating-controls-warning-dot" aria-hidden />
              )}
            </button>
          </Shortcut>
          <div ref={actionsRef} id={actionsId} className="floating-controls-actions" inert={collapsed}>
            {settingsReady && (
              <>
                <Shortcut hint={`外观 · ${appearanceLabel}`}>
                  <Dropdown
                    key={collapsed ? "collapsed" : "expanded"}
                    label={`外观 · ${appearanceLabel}`}
                    value={appearance}
                    options={APPEARANCE_CHOICES}
                    onValueChange={setAppearance}
                    variant="shortcut"
                    align="start"
                    leadingIcon={<AppearanceIcon size={16} aria-hidden />}
                  />
                </Shortcut>
                <Shortcut hint={`切换到${VIEW_MODE_META[nextMode].label}`}>
                  <button
                    type="button"
                    onClick={toggleMode}
                    aria-label="切换卡片视图"
                    aria-pressed={isReducedView}
                    className={clsx("control-button", isReducedView && "control-toggle is-active")}
                  >
                    <ViewIcon size={16} />
                  </button>
                </Shortcut>
                {showPriceToggle && (
                  <Shortcut hint={priceLabel}>
                    <button
                      type="button"
                      onClick={togglePriceVisibility}
                      aria-label={priceLabel}
                      aria-pressed={!isPriceVisible}
                      className={clsx("control-button", !isPriceVisible && "control-toggle is-active")}
                    >
                      {isPriceVisible ? <Eye size={16} /> : <EyeOff size={16} />}
                    </button>
                  </Shortcut>
                )}
                {showColorPicker && (
                  <Shortcut hint="卡片配色">
                    <button
                      type="button"
                      onClick={() => {
                        setColorsMounted(true);
                        setColorsOpen((value) => !value);
                      }}
                      aria-label="卡片配色"
                      aria-pressed={colorsOpen}
                      className={clsx("control-button", colorsOpen && "control-toggle is-active")}
                    >
                      <Palette size={16} />
                    </button>
                  </Shortcut>
                )}
              </>
            )}
            {showThemeManage && (
              <Shortcut hint="主题设置">
                <Link to="/?view=theme-manage" aria-label="主题设置" className="control-button">
                  <SlidersHorizontal size={16} />
                </Link>
              </Shortcut>
            )}
            {showAdmin && (
              <Shortcut hint={adminLabel}>
                <a href="/admin" aria-label={adminLabel} className="control-button">
                  <Settings size={16} />
                </a>
              </Shortcut>
            )}
          </div>
        </div>
        {showColorPicker && colorsMounted && (
          <Suspense fallback={null}>
            <MetricColorPicker hidden={collapsed || !colorsOpen} />
          </Suspense>
        )}
        {showSyncWarning && !collapsed && !colorsOpen && (
          <div className="floating-controls-sync-warning pointer-events-none flex items-center gap-2 rounded-full border border-[color-mix(in_srgb,var(--status-offline)_32%,transparent)] bg-[color-mix(in_srgb,var(--surface-a)_90%,transparent)] px-3 py-1 text-[11px] font-medium text-(--status-offline) shadow-[0_10px_25px_-18px_rgba(0,0,0,0.8)] backdrop-blur">
            <AlertTriangle size={12} />
            <span>实时状态同步异常，当前展示的是最近缓存</span>
          </div>
        )}
      </div>
    </div>
  );
}
