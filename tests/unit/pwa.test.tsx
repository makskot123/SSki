// @vitest-environment happy-dom
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
} from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  INSTALL_DISMISSED_KEY,
  isStandaloneDisplay,
  needsIosInstallHelp,
} from "@/lib/pwa/platform";
import en from "@/messages/en.json";

const IPHONE_SAFARI =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1";
const IPHONE_CHROME =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/130.0 Mobile/15E148 Safari/604.1";
const ANDROID_CHROME =
  "Mozilla/5.0 (Linux; Android 15; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Mobile Safari/537.36";

describe("platform helpers", () => {
  it("shows the iOS install help only in iOS Safari, not once installed", () => {
    expect(needsIosInstallHelp(IPHONE_SAFARI, false)).toBe(true);
    expect(needsIosInstallHelp(IPHONE_SAFARI, true)).toBe(false);
    expect(needsIosInstallHelp(IPHONE_CHROME, false)).toBe(false);
    expect(needsIosInstallHelp(ANDROID_CHROME, false)).toBe(false);
  });

  it("detects the installed (standalone) display mode either way", () => {
    const mm = (matches: boolean) => () => ({ matches });
    expect(isStandaloneDisplay(mm(true), undefined)).toBe(true);
    expect(isStandaloneDisplay(mm(false), true)).toBe(true);
    expect(isStandaloneDisplay(mm(false), undefined)).toBe(false);
  });
});

const wrap = (node: React.ReactNode) => (
  <NextIntlClientProvider locale="en" messages={en}>
    {node}
  </NextIntlClientProvider>
);

function setUserAgent(ua: string) {
  Object.defineProperty(window.navigator, "userAgent", {
    value: ua,
    configurable: true,
  });
}

async function freshInstallPrompt() {
  vi.resetModules();
  return (await import("@/components/pwa/install-prompt")).InstallPrompt;
}

describe("InstallPrompt", () => {
  beforeEach(() => {
    window.localStorage.clear();
    window.__faInstall = null;
    window.matchMedia = ((q: string) => ({
      matches: false,
      media: q,
    })) as unknown as typeof window.matchMedia;
    setUserAgent(ANDROID_CHROME);
  });
  afterEach(cleanup);

  it("shows nothing until the browser offers installation", async () => {
    const InstallPrompt = await freshInstallPrompt();
    const { container } = render(wrap(<InstallPrompt />));
    expect(container.textContent).toBe("");
  });

  it("offers the browser's install prompt and uses it only once", async () => {
    const InstallPrompt = await freshInstallPrompt();
    render(wrap(<InstallPrompt />));
    const prompt = vi.fn(() => Promise.resolve());
    act(() => {
      const event = Object.assign(new Event("beforeinstallprompt"), {
        prompt,
        userChoice: Promise.resolve({ outcome: "accepted" as const }),
      });
      window.__faInstall = event;
      window.dispatchEvent(new Event("fa-installable"));
    });
    const button = screen.getByRole("button", { name: "Install the app" });
    await act(async () => fireEvent.click(button));
    expect(prompt).toHaveBeenCalledOnce();
    expect(
      screen.queryByRole("button", { name: "Install the app" }),
    ).toBeNull();
  });

  it("shows the Add to Home Screen help on iPhone Safari, and 'Not now' is remembered", async () => {
    setUserAgent(IPHONE_SAFARI);
    let InstallPrompt = await freshInstallPrompt();
    render(wrap(<InstallPrompt />));
    expect(screen.getByText(/tap Share, then Add to Home Screen/)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Not now" }));
    expect(screen.queryByText(/Add to Home Screen/)).toBeNull();
    expect(window.localStorage.getItem(INSTALL_DISMISSED_KEY)).toBe("1");

    cleanup();
    InstallPrompt = await freshInstallPrompt();
    const { container } = render(wrap(<InstallPrompt />));
    expect(container.textContent).toBe("");
  });

  it("shows nothing when already installed", async () => {
    setUserAgent(IPHONE_SAFARI);
    window.matchMedia = ((q: string) => ({
      matches: q.includes("standalone"),
      media: q,
    })) as unknown as typeof window.matchMedia;
    const InstallPrompt = await freshInstallPrompt();
    const { container } = render(wrap(<InstallPrompt />));
    expect(container.textContent).toBe("");
  });
});

describe("UpdateNotice", () => {
  afterEach(() => {
    cleanup();
    vi.doUnmock("@serwist/turbopack/react");
  });

  function fakeSerwist() {
    const handlers = new Map<string, (() => void)[]>();
    return {
      addEventListener: (type: string, fn: () => void) =>
        handlers.set(type, [...(handlers.get(type) ?? []), fn]),
      removeEventListener: (type: string, fn: () => void) =>
        handlers.set(
          type,
          (handlers.get(type) ?? []).filter((f) => f !== fn),
        ),
      emit: (type: string) => (handlers.get(type) ?? []).forEach((f) => f()),
      messageSkipWaiting: vi.fn(),
    };
  }

  it("appears only when a new version is waiting, and switches to it on request", async () => {
    const serwist = fakeSerwist();
    vi.resetModules();
    vi.doMock("@serwist/turbopack/react", () => ({
      useSerwist: () => ({ serwist }),
    }));
    const { UpdateNotice } = await import("@/components/pwa/update-notice");
    const { container } = render(wrap(<UpdateNotice />));
    expect(container.textContent).toBe("");

    act(() => serwist.emit("waiting"));
    expect(
      screen.getByText("A new version of FreerideAtlas is ready."),
    ).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Reload" }));
    expect(serwist.messageSkipWaiting).toHaveBeenCalledOnce();
  });

  it("renders nothing without a service worker", async () => {
    vi.resetModules();
    vi.doMock("@serwist/turbopack/react", () => ({
      useSerwist: () => ({ serwist: null }),
    }));
    const { UpdateNotice } = await import("@/components/pwa/update-notice");
    const { container } = render(wrap(<UpdateNotice />));
    expect(container.textContent).toBe("");
  });
});
