# Avalanche bulletin fixtures

Recorded, unmodified CAAML v6 JSON used by the parser tests (so tests do not depend on the live feeds,
which are empty out of season).

| File                             | Source                                                                                                  | Recorded   | Notes                                                                                               |
| -------------------------------- | ------------------------------------------------------------------------------------------------------- | ---------- | --------------------------------------------------------------------------------------------------- |
| `euregio-latest-2026-05-02.json` | `https://avalanche.report/bulletins/latest/EUREGIO_en_CAAMLv6.json` (the live "latest" file in October) | 2026-10-21 | Last bulletin of winter 2025/26. Has `earlier` / `later` periods, elevation-split ratings, wet snow |
| `tyrol-2026-02-15.json`          | Tyrol bulletin of 2026-02-15 (Avalanche.report archive)                                                 | 2026-10-21 | `treeline` bounds, upper/lower bounds, wind slab, persistent weak layers                            |
| `slf-2026-02-15.json`            | SLF Switzerland bulletin of 2026-02-15, first 3 of 9 bulletins                                          | 2026-10-21 | SLF shape: `nextUpdate`, `weatherForecast`, `source.provider`, shorter validity (ends 16:00)        |
| `slf-empty.json`                 | `https://aws.slf.ch/api/bulletin/caaml/en/json` out of season                                           | 2026-10-21 | `{"bulletins":[]}`                                                                                  |

Licences: Avalanche.report data is CC BY 4.0; SLF data is CC BY 4.0 (attribution: WSL Institute for Snow and
Avalanche Research SLF, https://www.slf.ch). Fixtures are used for testing only and are never served by the app.
