/**
 * 3D terrain settings, from the A0 measurements (PLAN.md section 8.8).
 * AWS Terrain Tiles: free open data, Terrarium encoding, CORS enabled, zoom 0-15 (~25-30 m in Europe).
 */
export const TERRAIN_TILES = [
  "https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png",
];

/**
 * Elevation credit shown in the map's attribution control while 3D is on. Kept short so it does not cover
 * the map; the full wording of each source's notice is in the README ("Data sources and attribution").
 */
export const TERRAIN_ATTRIBUTION =
  'Terrain: <a href="https://registry.opendata.aws/terrain-tiles/" target="_blank" rel="noopener">Mapzen / AWS Terrain Tiles</a>' +
  " · EU-DEM © Copernicus (EU) · © offene Daten Österreichs · USGS";

/** The data is ~25-30 m; zooming the source further only costs data. MapLibre over-zooms beyond this. */
export const TERRAIN_MAX_ZOOM = 12;
export const TERRAIN_EXAGGERATION = 1.3;
export const PITCH_3D = 60;
export const MAX_PITCH = 70;
