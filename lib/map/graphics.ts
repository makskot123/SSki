/** What the browser can do for the 3D map. `renderer` is "unknown" when the browser hides it. */
export interface GraphicsInfo {
  webgl2: boolean;
  renderer: string;
}

/**
 * Software renderers draw WebGL on the CPU. In A0 they ran 3D at under 2 fps, so 3D is not offered there.
 * Matches the renderer strings of SwiftShader, Mesa llvmpipe/softpipe and Windows' basic display driver.
 */
export function isSoftwareRenderer(renderer: string): boolean {
  return /swiftshader|llvmpipe|softpipe|software|basic render/i.test(renderer);
}

export function canUse3D(info: GraphicsInfo): boolean {
  return info.webgl2 && !isSoftwareRenderer(info.renderer);
}

/** Browser only. Creates a throwaway WebGL2 context to read the capability; never throws. */
export function probeGraphics(): GraphicsInfo {
  try {
    const canvas = document.createElement("canvas");
    const gl = canvas.getContext("webgl2");
    if (!gl) return { webgl2: false, renderer: "none" };
    const ext = gl.getExtension("WEBGL_debug_renderer_info");
    const renderer = ext
      ? String(gl.getParameter(ext.UNMASKED_RENDERER_WEBGL))
      : "unknown";
    gl.getExtension("WEBGL_lose_context")?.loseContext();
    return { webgl2: true, renderer };
  } catch {
    return { webgl2: false, renderer: "none" };
  }
}
