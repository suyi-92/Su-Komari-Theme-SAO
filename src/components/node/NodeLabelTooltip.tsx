import { useEffect, useId, useLayoutEffect, useRef, useState, type RefObject } from "react";
import { createPortal } from "react-dom";

const LABEL_SELECTOR = "[data-node-label-tooltip]";
const LINK_LANE_SELECTOR = `${LABEL_SELECTOR}[data-node-label-lane="link"]`;
const TOOLTIP_GAP = 8;
const VIEWPORT_PADDING = 12;

export function nodeLabelTooltipProps(text: string | undefined, kind: "chip" | "lane" | "link-lane" = "chip") {
  if (!text) return {};
  return {
    "data-node-label-tooltip": text,
    "data-node-label-lane": kind === "chip" ? undefined : kind === "link-lane" ? "link" : "",
    tabIndex: kind === "link-lane" ? undefined : 0,
    // Stop the enclosing list link's native detail hint from appearing on this lane.
    title: kind === "link-lane" ? "" : undefined,
  };
}

type TooltipTarget = { label: HTMLElement; anchor: Element; trigger: HTMLElement };
type ActiveTooltip = TooltipTarget & { text: string };

function getTooltipTarget(label: HTMLElement, trigger: HTMLElement, pointerTarget?: Element): TooltipTarget {
  const laneChild = pointerTarget?.closest(`${LABEL_SELECTOR} > *`);
  const anchor = label.hasAttribute("data-node-label-lane")
    ? (laneChild?.parentElement === label ? laneChild : label.firstElementChild) ?? label
    : label;
  return { label, anchor, trigger };
}

export function NodeLabelTooltip({ scopeRef }: { scopeRef: RefObject<HTMLElement | null> }) {
  const id = useId();
  const tooltipRef = useRef<HTMLSpanElement>(null);
  const [active, setActive] = useState<ActiveTooltip | null>(null);

  useEffect(() => {
    const scope = scopeRef.current;
    if (!scope) return;

    let hovered: TooltipTarget | null = null;
    let hoverRect: DOMRect | undefined;
    let restoreHoverOnMove = false;
    let focused: TooltipTarget | null = null;
    let current: ActiveTooltip | null = null;
    const observer = new MutationObserver(() => update());

    const update = (reposition = false) => {
      if (hovered && (!scope.contains(hovered.anchor) || !hovered.label.dataset.nodeLabelTooltip)) hovered = null;
      if (focused && (!scope.contains(focused.anchor) || !focused.label.dataset.nodeLabelTooltip)) focused = null;

      const target = hovered ?? focused;
      const text = target?.label.dataset.nodeLabelTooltip;
      if (!reposition && current?.anchor === target?.anchor && current?.trigger === target?.trigger && current?.text === text) return;

      const next = target && text ? { ...target, text } : null;
      if (next && !current) {
        observer.observe(scope, {
          subtree: true,
          childList: true,
          attributes: true,
          attributeFilter: ["data-node-label-tooltip"],
        });
      } else if (!next) {
        observer.disconnect();
      }
      current = next;
      setActive(next);
    };

    const dismiss = () => {
      restoreHoverOnMove = false;
      hovered = null;
      focused = null;
      update();
    };
    const setHovered = (target: EventTarget | null) => {
      const element = target instanceof Element && scope.contains(target) ? target : null;
      const label = element?.closest<HTMLElement>(LABEL_SELECTOR);
      const next = label ? getTooltipTarget(label, label, element ?? undefined) : null;
      if (next?.anchor !== hovered?.anchor) hoverRect = next?.anchor.getBoundingClientRect();
      hovered = next;
      update();
    };
    const onPointerOver = (event: PointerEvent) => {
      if (event.pointerType === "touch") return;
      restoreHoverOnMove = false;
      setHovered(event.target);
    };
    const onPointerOut = (event: PointerEvent) => {
      if (event.pointerType !== "touch") setHovered(event.relatedTarget);
    };
    const onPointerMove = (event: PointerEvent) => {
      // After scrolling, the pointer may move within the same chip without a new pointerover.
      if (restoreHoverOnMove && event.pointerType !== "touch") onPointerOver(event);
    };
    const onPointerDown = (event: PointerEvent) => {
      if (event.pointerType !== "mouse") dismiss();
    };
    const onFocusIn = (event: FocusEvent) => {
      const target = event.target;
      if (!(target instanceof HTMLElement) || !target.matches(":focus-visible")) return;
      const label = target.matches(LABEL_SELECTOR) ? target : target.querySelector<HTMLElement>(LINK_LANE_SELECTOR);
      restoreHoverOnMove = false;
      hovered = null;
      focused = label ? getTooltipTarget(label, target) : null;
      update();
    };
    const onFocusOut = () => {
      focused = null;
      update();
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") dismiss();
    };
    const onScroll = () => {
      if (!current) return;
      if (hovered && hoverRect) {
        const rect = hovered.anchor.getBoundingClientRect();
        // A queued scroll can arrive after the pointer enters its already-scrolled target.
        // Allow for the card's 2px hover lift when checking for actual movement.
        if (Math.abs(rect.x - hoverRect.x) + Math.abs(rect.y - hoverRect.y) <= 2) return;
      }
      restoreHoverOnMove = Boolean(hovered);
      hovered = null;
      // Tab may scroll the newly focused label into view after focusin.
      if (focused) {
        const rect = focused.anchor.getBoundingClientRect();
        const viewport = document.documentElement;
        if (rect.bottom <= 0 || rect.top >= viewport.clientHeight || rect.right <= 0 || rect.left >= viewport.clientWidth) {
          focused = null;
        }
      }
      update(Boolean(focused));
    };

    scope.addEventListener("pointerover", onPointerOver);
    scope.addEventListener("pointerout", onPointerOut);
    scope.addEventListener("pointermove", onPointerMove);
    scope.addEventListener("pointercancel", dismiss);
    scope.addEventListener("focusin", onFocusIn);
    scope.addEventListener("focusout", onFocusOut);
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    window.addEventListener("scroll", onScroll, { capture: true, passive: true });
    window.addEventListener("resize", dismiss);
    window.addEventListener("blur", dismiss);
    return () => {
      observer.disconnect();
      scope.removeEventListener("pointerover", onPointerOver);
      scope.removeEventListener("pointerout", onPointerOut);
      scope.removeEventListener("pointermove", onPointerMove);
      scope.removeEventListener("pointercancel", dismiss);
      scope.removeEventListener("focusin", onFocusIn);
      scope.removeEventListener("focusout", onFocusOut);
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("scroll", onScroll, true);
      window.removeEventListener("resize", dismiss);
      window.removeEventListener("blur", dismiss);
    };
  }, [scopeRef]);

  useLayoutEffect(() => {
    const tooltip = tooltipRef.current;
    if (!active || !tooltip) return;

    const { trigger, anchor } = active;
    const rect = anchor.getBoundingClientRect();
    const { offsetWidth, offsetHeight } = tooltip;
    const viewport = document.documentElement;
    const maxLeft = Math.max(VIEWPORT_PADDING, viewport.clientWidth - offsetWidth - VIEWPORT_PADDING);
    const maxTop = Math.max(VIEWPORT_PADDING, viewport.clientHeight - offsetHeight - VIEWPORT_PADDING);
    const below = rect.bottom + TOOLTIP_GAP;
    const top = below <= maxTop ? below : rect.top - offsetHeight - TOOLTIP_GAP;
    const left = rect.left + (rect.width - offsetWidth) / 2;
    tooltip.style.top = `${Math.min(maxTop, Math.max(VIEWPORT_PADDING, top))}px`;
    tooltip.style.left = `${Math.min(maxLeft, Math.max(VIEWPORT_PADDING, left))}px`;

    const previousDescription = trigger.getAttribute("aria-describedby");
    trigger.setAttribute("aria-describedby", previousDescription ? `${previousDescription} ${id}` : id);
    return () => {
      if (previousDescription === null) trigger.removeAttribute("aria-describedby");
      else trigger.setAttribute("aria-describedby", previousDescription);
    };
  }, [active, id]);

  return active && createPortal(
    <span id={id} ref={tooltipRef} className="surface-tooltip node-label-tooltip" role="tooltip">
      {active.text}
    </span>,
    document.body,
  );
}
