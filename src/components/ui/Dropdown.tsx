import {
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type KeyboardEvent,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import { Check, ChevronDown } from "lucide-react";

type DropdownOption<Value extends string> = {
  value: Value;
  label: string;
  disabled?: boolean;
  adornment?: ReactNode;
  description?: string;
};

type DropdownProps<Value extends string> = {
  value: Value;
  options: readonly DropdownOption<Value>[];
  onValueChange: (value: Value) => void;
  onReselect?: () => void;
  label: string;
  id?: string;
  title?: string;
  placeholder?: string;
  disabled?: boolean;
  variant?: "field" | "toolbar" | "icon" | "shortcut";
  align?: "start" | "end";
  leadingIcon?: ReactNode;
  selectedIcon?: ReactNode;
  keepOpen?: boolean;
};

const VIEWPORT_PADDING = 8;
const PANEL_GAP = 6;
const PANEL_MAX_HEIGHT = 328;

function positionPanel(trigger: HTMLButtonElement, panel: HTMLDivElement, align: "start" | "end") {
  const rect = trigger.getBoundingClientRect();
  const viewport = window.visualViewport;
  const viewportLeft = viewport?.offsetLeft ?? 0;
  const viewportTop = viewport?.offsetTop ?? 0;
  const viewportWidth = viewport?.width ?? document.documentElement.clientWidth;
  const viewportHeight = viewport?.height ?? window.innerHeight;
  const availableWidth = Math.max(0, viewportWidth - 2 * VIEWPORT_PADDING);
  const minimumWidth = Math.max(rect.width, panel.dataset.variant === "field" ? 148 : 194);
  panel.style.minWidth = `${Math.min(minimumWidth, availableWidth)}px`;
  panel.style.maxWidth = `${Math.min(Math.max(minimumWidth, 320), availableWidth)}px`;

  const below = viewportTop + viewportHeight - VIEWPORT_PADDING - rect.bottom - PANEL_GAP;
  const above = rect.top - viewportTop - VIEWPORT_PADDING - PANEL_GAP;
  const desiredHeight = Math.min(PANEL_MAX_HEIGHT, panel.scrollHeight + 2);
  const opensAbove = desiredHeight > below && above > below;
  const heightLimit = Math.min(PANEL_MAX_HEIGHT, opensAbove ? above : below);
  panel.style.maxHeight = `${Math.max(0, heightLimit)}px`;
  panel.dataset.placement = opensAbove ? "above" : "below";

  const width = panel.getBoundingClientRect().width;
  const alignedLeft = align === "end" ? rect.right - width : rect.left;
  const left = Math.max(
    viewportLeft + VIEWPORT_PADDING,
    Math.min(alignedLeft, viewportLeft + viewportWidth - width - VIEWPORT_PADDING),
  );
  panel.style.left = `${left}px`;
  panel.style.top = `${opensAbove ? rect.top - PANEL_GAP : rect.bottom + PANEL_GAP}px`;
}

function normalizeLabel(text: string) {
  return text.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase();
}

export function Dropdown<Value extends string>({
  value,
  options,
  onValueChange,
  onReselect,
  label,
  id,
  title,
  placeholder = "请选择",
  disabled,
  variant = "field",
  align = "start",
  leadingIcon,
  selectedIcon,
  keepOpen = false,
}: DropdownProps<Value>) {
  const listId = useId();
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const activeRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef({ text: "", time: 0 });
  const [open, setOpen] = useState(false);
  const [activeValue, setActiveValue] = useState<Value | null>(null);

  const selected = options.find((option) => option.value === value);
  const enabled = options.filter((option) => !option.disabled);
  const initialOption = enabled.find((option) => option.value === value) ?? enabled[0];
  const activeOption = enabled.find((option) => option.value === activeValue) ?? initialOption;
  const isDisabled = disabled || options.length === 0;
  const expanded = open && !isDisabled;
  const activeIndex = activeOption ? options.indexOf(activeOption) : -1;
  const iconOnly = variant === "icon" || variant === "shortcut";

  useLayoutEffect(() => {
    const trigger = triggerRef.current;
    const panel = panelRef.current;
    if (!expanded || !trigger || !panel) return;

    const update = () => positionPanel(trigger, panel, align);
    update();

    // Portal 使菜单不受设置页内部滚动容器裁剪，滚动和缩放时重新对齐按钮。
    let frame = 0;
    const scheduleUpdate = (event?: Event) => {
      if (frame || event?.target === panel) return;
      frame = window.requestAnimationFrame(() => {
        frame = 0;
        update();
      });
    };
    const resizeObserver = new ResizeObserver(() => scheduleUpdate());
    resizeObserver.observe(trigger);
    resizeObserver.observe(panel);
    const intersectionObserver = new IntersectionObserver(([entry]) => {
      if (entry && !entry.isIntersecting) setOpen(false);
    });
    intersectionObserver.observe(trigger);

    const closeOutside = (event: Event) => {
      const target = event.target;
      if (!(target instanceof Node) || trigger.contains(target) || panel.contains(target)) return;
      if (Array.from(trigger.labels ?? []).some((label) => label.contains(target))) return;
      setOpen(false);
    };
    window.addEventListener("resize", scheduleUpdate);
    window.addEventListener("scroll", scheduleUpdate, { capture: true, passive: true });
    window.visualViewport?.addEventListener("resize", scheduleUpdate);
    window.visualViewport?.addEventListener("scroll", scheduleUpdate);
    document.addEventListener("pointerdown", closeOutside, true);
    document.addEventListener("focusin", closeOutside);
    return () => {
      window.cancelAnimationFrame(frame);
      resizeObserver.disconnect();
      intersectionObserver.disconnect();
      window.removeEventListener("resize", scheduleUpdate);
      window.removeEventListener("scroll", scheduleUpdate, true);
      window.visualViewport?.removeEventListener("resize", scheduleUpdate);
      window.visualViewport?.removeEventListener("scroll", scheduleUpdate);
      document.removeEventListener("pointerdown", closeOutside, true);
      document.removeEventListener("focusin", closeOutside);
    };
  }, [align, expanded, options.length, variant]);

  useLayoutEffect(() => {
    const panel = panelRef.current;
    const active = activeRef.current;
    if (!expanded || !panel || !active) return;

    // 只滚动菜单，让页面与包含触发按钮的设置区留在当前位置。
    const panelTop = panel.getBoundingClientRect().top + panel.clientTop;
    const panelBottom = panelTop + panel.clientHeight;
    const rect = active.getBoundingClientRect();
    if (rect.top < panelTop) panel.scrollTop += rect.top - panelTop;
    else if (rect.bottom > panelBottom) panel.scrollTop += rect.bottom - panelBottom;
  }, [activeIndex, expanded]);

  function openWith(option: DropdownOption<Value> | undefined) {
    setActiveValue(option?.value ?? null);
    triggerRef.current?.focus({ preventScroll: true });
    setOpen(true);
  }

  function select(option: DropdownOption<Value>) {
    if (option.disabled) return;
    searchRef.current.text = "";
    if (keepOpen) setActiveValue(option.value);
    else setOpen(false);
    if (option.value === value) onReselect?.();
    else onValueChange(option.value);
  }

  function handleKeyDown(event: KeyboardEvent<HTMLButtonElement>) {
    if (event.nativeEvent.isComposing) return;
    const { key } = event;

    if (key === "Tab") {
      if (expanded) setOpen(false);
      return;
    }
    if (expanded && (key === "Escape" || key === "Enter" || key === " ")) {
      event.preventDefault();
      if (key === "Escape") {
        event.stopPropagation();
        setOpen(false);
      } else if (activeOption && !event.repeat) {
        select(activeOption);
      }
      return;
    }

    const index = activeOption ? enabled.indexOf(activeOption) : -1;
    if (key === "ArrowDown" || key === "ArrowUp" || key === "Home" || key === "End") {
      event.preventDefault();
      searchRef.current.text = "";
      if (key === "Home" || key === "End") {
        openWith(key === "Home" ? enabled[0] : enabled.at(-1));
      } else if (!expanded) {
        const edge = key === "ArrowUp" ? enabled.at(-1) : enabled[0];
        openWith(selected && !selected.disabled ? selected : edge);
      } else if (enabled.length > 0) {
        const step = key === "ArrowUp" ? -1 : 1;
        const next = (index + step + enabled.length) % enabled.length;
        setActiveValue(enabled[next].value);
      }
      return;
    }

    if (event.altKey || event.ctrlKey || event.metaKey || Array.from(key).length !== 1) return;
    if (key === " ") return;
    event.preventDefault();

    const character = normalizeLabel(key);
    const now = Date.now();
    const previous = now - searchRef.current.time < 700 ? searchRef.current.text : "";
    const repeated = Array.from(previous).every((part) => part === character);
    const text = repeated ? character : previous + character;
    searchRef.current = { text, time: now };

    // 单键（含连续重复按键）从下一项循环查找，多字前缀从当前项继续匹配。
    const selectedIndex = initialOption ? enabled.indexOf(initialOption) : -1;
    const start = Math.max(0, (expanded ? index : selectedIndex) + (repeated ? 1 : 0));
    for (let offset = 0; offset < enabled.length; offset++) {
      const option = enabled[(start + offset) % enabled.length];
      if (normalizeLabel(option.label).startsWith(text)) {
        openWith(option);
        break;
      }
    }
  }

  const optionId = (index: number) => `${listId}-option-${index}`;

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        role="combobox"
        id={id}
        className={variant === "shortcut" ? "dropdown-trigger control-button" : "dropdown-trigger"}
        data-variant={variant}
        title={title}
        disabled={isDisabled}
        aria-label={label}
        aria-expanded={expanded}
        aria-controls={expanded ? listId : undefined}
        aria-activedescendant={expanded && activeIndex >= 0 ? optionId(activeIndex) : undefined}
        onClick={() => {
          searchRef.current.text = "";
          if (expanded) setOpen(false);
          else openWith(initialOption);
        }}
        onKeyDown={handleKeyDown}
      >
        {leadingIcon}
        <span className={iconOnly ? "sr-only" : "dropdown-trigger-label"}>
          {selected?.label ?? placeholder}
        </span>
        {variant !== "shortcut" && <ChevronDown size={14} className="dropdown-chevron" aria-hidden />}
      </button>
      {expanded && createPortal(
        <div
          ref={panelRef}
          id={listId}
          role="listbox"
          aria-label={label}
          className="dropdown-panel"
          data-variant={variant}
          onMouseDown={(event) => {
            // 焦点保留在 combobox，Tab 可沿页面原有顺序继续。
            if (event.button === 0) event.preventDefault();
          }}
        >
          {options.map((option, index) => {
            const isSelected = option.value === value;
            const isActive = index === activeIndex;
            return (
              <div
                ref={isActive ? activeRef : undefined}
                key={option.value}
                id={optionId(index)}
                role="option"
                aria-selected={isSelected}
                aria-disabled={option.disabled || undefined}
                data-highlighted={isActive || undefined}
                className="dropdown-option"
                onClick={() => select(option)}
              >
                {option.adornment}
                <span className="dropdown-option-label">{option.label}</span>
                {option.description && <span className="sr-only">，{option.description}</span>}
                <span className="dropdown-option-indicator" aria-hidden>
                  {isSelected && (selectedIcon ?? <Check size={15} strokeWidth={2.3} />)}
                </span>
              </div>
            );
          })}
        </div>,
        document.body,
      )}
    </>
  );
}
