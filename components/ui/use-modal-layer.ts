"use client";

import { useEffect, useRef, type RefObject } from "react";

/**
 * Makes an element that already sits in the page behave like a modal layer while `active`, without moving it
 * in the DOM (so a live map inside it is not re-created): everything outside it becomes `inert` (no focus,
 * hidden from screen readers), the page behind stops scrolling, Escape calls `onClose`, focus moves to
 * `initialFocus`, and on close it returns to the element that had it before (or to `initialFocus`).
 */
export function useModalLayer(
  layer: RefObject<HTMLElement | null>,
  active: boolean,
  onClose: () => void,
  initialFocus?: RefObject<HTMLElement | null>,
) {
  const close = useRef(onClose);
  useEffect(() => {
    close.current = onClose;
  });

  useEffect(() => {
    const el = layer.current;
    if (!active || !el) return;
    // Safari does not focus a button on click, so there may be nothing to return to: then use initialFocus.
    const returnTo =
      document.activeElement instanceof HTMLElement &&
      document.activeElement !== document.body
        ? document.activeElement
        : (initialFocus?.current ?? null);

    const made: Element[] = [];
    for (let node: Element | null = el; node && node !== document.body;) {
      const parent: Element | null = node.parentElement;
      for (const sibling of Array.from(parent?.children ?? [])) {
        if (sibling !== node && !sibling.hasAttribute("inert")) {
          sibling.setAttribute("inert", "");
          made.push(sibling);
        }
      }
      node = parent;
    }
    const overflow = document.documentElement.style.overflow;
    document.documentElement.style.overflow = "hidden";
    (initialFocus?.current ?? el).focus();

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close.current();
    };
    document.addEventListener("keydown", onKey);

    return () => {
      document.removeEventListener("keydown", onKey);
      for (const node of made) node.removeAttribute("inert");
      document.documentElement.style.overflow = overflow;
      returnTo?.focus();
    };
  }, [active, layer, initialFocus]);
}
