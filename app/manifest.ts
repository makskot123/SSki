import type { MetadataRoute } from "next";

/** Web app manifest: makes FreerideAtlas installable ("Add to Home Screen" / "Install app"). */
export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: "FreerideAtlas",
    short_name: "FreerideAtlas",
    description:
      "Freeride resorts in Europe: ranking, avalanche danger and powder forecast.",
    // "/" redirects to the visitor's language.
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "any",
    background_color: "#0e1620",
    theme_color: "#0e1620",
    categories: ["sports", "weather", "travel"],
    icons: [
      {
        src: "/icons/icon-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icons/icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icons/maskable-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
