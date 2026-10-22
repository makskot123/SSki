// @vitest-environment happy-dom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { useRef, useState } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useModalLayer } from "@/components/ui/use-modal-layer";
import { isActiveSection, NAV_ITEMS } from "@/lib/nav";

describe("isActiveSection", () => {
  it("matches home only on itself and other sections on their sub-pages", () => {
    expect(isActiveSection("/", "/")).toBe(true);
    expect(isActiveSection("/", "/resorts")).toBe(false);
    expect(isActiveSection("/safety", "/safety")).toBe(true);
    expect(isActiveSection("/safety", "/safety/quiz")).toBe(true);
    expect(isActiveSection("/resorts", "/resorts/chamonix")).toBe(true);
  });

  it("does not match a section that only shares a prefix", () => {
    expect(isActiveSection("/powder", "/powderhound")).toBe(false);
  });

  it("has five sections, as the bottom tab bar expects", () => {
    expect(NAV_ITEMS).toHaveLength(5);
  });
});

function Harness({ onClose }: { onClose: () => void }) {
  const [open, setOpen] = useState(false);
  const layer = useRef<HTMLDivElement>(null);
  const toggle = useRef<HTMLButtonElement>(null);
  useModalLayer(
    layer,
    open,
    () => {
      onClose();
      setOpen(false);
    },
    toggle,
  );
  return (
    <>
      <header data-testid="outside">
        <button type="button">elsewhere</button>
      </header>
      <main>
        <p data-testid="sibling">text</p>
        <div ref={layer} data-testid="layer">
          <button ref={toggle} type="button" onClick={() => setOpen((v) => !v)}>
            toggle
          </button>
        </div>
      </main>
    </>
  );
}

describe("useModalLayer", () => {
  afterEach(cleanup);

  it("makes everything outside inert, locks scrolling and moves focus while open", () => {
    render(<Harness onClose={() => {}} />);
    fireEvent.click(screen.getByText("toggle"));
    expect(screen.getByTestId("outside").hasAttribute("inert")).toBe(true);
    expect(screen.getByTestId("sibling").hasAttribute("inert")).toBe(true);
    expect(screen.getByTestId("layer").hasAttribute("inert")).toBe(false);
    expect(document.documentElement.style.overflow).toBe("hidden");
    expect(document.activeElement).toBe(screen.getByText("toggle"));
  });

  it("closes on Escape and restores the page", () => {
    const onClose = vi.fn();
    render(<Harness onClose={onClose} />);
    fireEvent.click(screen.getByText("toggle"));
    fireEvent.keyDown(document, { key: "Escape" });
    expect(onClose).toHaveBeenCalledOnce();
    expect(screen.getByTestId("outside").hasAttribute("inert")).toBe(false);
    expect(screen.getByTestId("sibling").hasAttribute("inert")).toBe(false);
    expect(document.documentElement.style.overflow).toBe("");
    expect(document.activeElement).toBe(screen.getByText("toggle"));
  });

  it("leaves elements that were already inert alone", () => {
    render(<Harness onClose={() => {}} />);
    screen.getByTestId("sibling").setAttribute("inert", "");
    fireEvent.click(screen.getByText("toggle"));
    fireEvent.click(screen.getByText("toggle"));
    expect(screen.getByTestId("sibling").hasAttribute("inert")).toBe(true);
  });
});
