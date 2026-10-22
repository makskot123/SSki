import { expect, type Page } from "@playwright/test";

/*
 * Playwright's Chromium renders WebGL in software (SwiftShader), which the app correctly refuses for 3D.
 * To test the 3D path, this makes the renderer report a hardware GPU name. Rendering itself still works
 * (slowly); the tests check state, not pixels.
 */
export async function pretendHardwareGpu(page: Page) {
  await page.addInitScript(() => {
    const UNMASKED_RENDERER = 0x9246;
    for (const proto of [
      WebGL2RenderingContext.prototype,
      WebGLRenderingContext.prototype,
    ]) {
      const original = proto.getParameter;
      proto.getParameter = function (this: WebGLRenderingContext, p: number) {
        return p === UNMASKED_RENDERER
          ? "Test GPU (e2e)"
          : original.call(this, p);
      } as typeof original;
    }
  });
}

/** Waits until interaction is armed, moves the mouse (which starts the deferred map) and waits for it. */
export async function startMap(page: Page) {
  await expect(page.getByTestId("avalanche-map-placeholder")).toHaveAttribute(
    "data-armed",
    "true",
  );
  await page.mouse.move(150, 250);
  const map = page.getByTestId("avalanche-map");
  await expect(map).toHaveAttribute("data-map-status", /ready|error/, {
    timeout: 30_000,
  });
  return map;
}
