// @vitest-environment happy-dom
import {
  cleanup,
  fireEvent,
  render,
  renderHook,
  screen,
  act,
} from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MapViewToggle } from "@/components/avalanche/map-view-toggle";
import { MAP_VIEW_STORAGE_KEY } from "@/lib/map/view-preference";
import en from "@/messages/en.json";

// The explorer module pulls in next/dynamic and the navigation helpers; this test only needs the toggle.
vi.mock("next/dynamic", () => ({ default: () => () => null }));
vi.mock("@/i18n/navigation", () => ({
  Link: ({ href, children }: { href: string; children: React.ReactNode }) => (
    <a href={href}>{children}</a>
  ),
  useRouter: () => ({ push: () => {}, replace: () => {} }),
}));

const wrap = (node: React.ReactNode) => (
  <NextIntlClientProvider locale="en" messages={en}>
    {node}
  </NextIntlClientProvider>
);

beforeEach(() => window.localStorage.clear());
afterEach(() => {
  cleanup();
  vi.doUnmock("@/lib/map/graphics");
  vi.resetModules();
});

describe("MapViewToggle", () => {
  it("is a pressed toggle in 3D and switches to 2D", () => {
    const onChange = vi.fn();
    render(wrap(<MapViewToggle available view="3d" onChange={onChange} />));
    const button = screen.getByRole("button", { name: "3D view" });
    expect(button.getAttribute("aria-pressed")).toBe("true");
    fireEvent.click(button);
    expect(onChange).toHaveBeenCalledWith("2d");
  });

  it("switches from 2D to 3D", () => {
    const onChange = vi.fn();
    render(wrap(<MapViewToggle available view="2d" onChange={onChange} />));
    fireEvent.click(screen.getByRole("button", { name: "3D view" }));
    expect(onChange).toHaveBeenCalledWith("3d");
  });

  it("is disabled with the reason when the device cannot do 3D", () => {
    render(
      wrap(<MapViewToggle available={false} view="2d" onChange={() => {}} />),
    );
    expect(
      (screen.getByRole("button", { name: "3D view" }) as HTMLButtonElement)
        .disabled,
    ).toBe(true);
    expect(
      screen.getByText(/needs hardware graphics acceleration/),
    ).toBeTruthy();
  });

  it("shows no warning while the capability is still unknown", () => {
    render(
      wrap(<MapViewToggle available={null} view="2d" onChange={() => {}} />),
    );
    expect(
      screen.queryByText(/needs hardware graphics acceleration/),
    ).toBeNull();
  });
});

async function freshHook(
  graphics: { webgl2: boolean; renderer: string },
  phone = false,
) {
  vi.resetModules();
  const probe = vi.fn(() => graphics);
  vi.doMock("@/lib/map/graphics", async (importOriginal) => ({
    ...(await importOriginal<typeof import("@/lib/map/graphics")>()),
    probeGraphics: probe,
  }));
  window.matchMedia = ((q: string) => ({
    matches: phone,
    media: q,
    addEventListener() {},
    removeEventListener() {},
  })) as unknown as typeof window.matchMedia;
  const mod = await import("@/components/avalanche/use-map-view");
  return {
    useMapView: mod.useMapView,
    ensure: mod.ensureGraphicsProbed,
    probe,
  };
}

describe("useMapView", () => {
  const gpu = { webgl2: true, renderer: "Adreno (TM) 642L" };

  it("PERFORMANCE: does not probe the GPU on page load, only when the map starts", async () => {
    const { useMapView, ensure, probe } = await freshHook(gpu, false);
    const { result } = renderHook(() => useMapView());
    expect(probe).not.toHaveBeenCalled();
    expect(result.current).toMatchObject({ available: null, view: "3d" });
    act(() => ensure());
    act(() => ensure()); // only once
    expect(probe).toHaveBeenCalledTimes(1);
    expect(result.current).toMatchObject({ available: true, view: "3d" });
  });

  it("asking for 3D probes the GPU", async () => {
    const { useMapView, probe } = await freshHook(gpu, true);
    const { result } = renderHook(() => useMapView());
    expect(result.current.view).toBe("2d");
    act(() => result.current.setView("3d"));
    expect(probe).toHaveBeenCalledTimes(1);
    expect(result.current).toMatchObject({ available: true, view: "3d" });
  });

  it("defaults to 3D on a desktop and 2D on a phone", async () => {
    let h = await freshHook(gpu, false);
    expect(renderHook(() => h.useMapView()).result.current.view).toBe("3d");
    h = await freshHook(gpu, true);
    expect(renderHook(() => h.useMapView()).result.current.view).toBe("2d");
  });

  it("remembers the choice across reloads", async () => {
    let h = await freshHook(gpu, false);
    const { result } = renderHook(() => h.useMapView());
    act(() => result.current.setView("2d"));
    expect(result.current.view).toBe("2d");
    expect(window.localStorage.getItem(MAP_VIEW_STORAGE_KEY)).toBe("2d");

    h = await freshHook(gpu, false); // a fresh module = a page reload
    expect(renderHook(() => h.useMapView()).result.current.view).toBe("2d");
  });

  it("once probed, forces 2D on software rendering or without WebGL2, even if 3D was saved", async () => {
    window.localStorage.setItem(MAP_VIEW_STORAGE_KEY, "3d");
    for (const g of [
      { webgl2: true, renderer: "SwiftShader driver" },
      { webgl2: false, renderer: "none" },
    ]) {
      const h = await freshHook(g, false);
      const { result } = renderHook(() => h.useMapView());
      act(() => h.ensure());
      expect(result.current, g.renderer).toMatchObject({
        available: false,
        view: "2d",
      });
    }
  });

  it("still works when storage is blocked", async () => {
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new DOMException("blocked", "SecurityError");
    });
    const h = await freshHook(gpu, false);
    const { result } = renderHook(() => h.useMapView());
    act(() => result.current.setView("2d"));
    expect(result.current.view).toBe("2d");
    vi.restoreAllMocks();
  });
});
