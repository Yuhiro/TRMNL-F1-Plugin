# TRMNL F1 Plugin — Payload Schema

Reference for the `merge_variables` JSON pushed to the TRMNL webhook. All keys are abbreviated to minimise payload size — the 2 KB free-tier limit is the constraint.

---

## Key abbreviations

| Payload key | Full meaning |
|---|---|
| `assets_base` | GitHub raw base URL for all assets. Template constructs full URLs as `{assets_base}/{path}` |
| `logo` | Logo image path relative to `assets_base`, e.g. `f1.png` |
| `img` | Driver portrait path relative to `assets_base`, e.g. `driver/44.png` (`portrait_url`) |
| `pos` | Standing position (`position`) |
| `pts` | Points total (`points`) |
| `delta` | Position change since last race (`position_change`). Positive = gained places. Only present when non-zero. |
| `d1` | First (left) column of driver standings — off_season view only (`drivers_col1`) |
| `d2` | Second (right) column of driver standings — off_season view only (`drivers_col2`) |
| `teams` | Constructor/team standings array (`constructors`) |
| `time` | Session time range string, e.g. `"14:00 – 16:00"` (`time_range`) |
| `map` | Circuit map image path relative to `assets_base`, e.g. `circuits/openf1/Montreal.png` (`circuit_image_url`) |
| `dates` | Weekend or session date range string, e.g. `"Jun 13 – 15"` (`date_range`) |
| `grid` | Race winner's qualifying grid position, e.g. `"P3"` (`grid_position`) |
| `finish` | Race winner's finish position — always `"P1"` (`finish_position`) |

---

## Schema by view

### `off_season`

```
view          "off_season"
assets_base   GitHub raw base URL, e.g. "https://raw.githubusercontent.com/owner/repo/main/assets"
logo          "f1.png"
season.year   integer

champions
  driver
    name      full display name
    team      full team name
    pts       integer
    img       relative path e.g. "driver/12.png", or null if no portrait file

  constructor
    name      full team name
    pts       integer

standings
  d1[]        first column of driver standings (top ~11)
    pos       integer
    name      "F. Surname"
    pts       integer

  d2[]        second column (remaining drivers)
    pos       integer
    name      "F. Surname"
    pts       integer

  teams[]     constructor standings (all)
    pos       integer
    name      full team name
    pts       integer
```

**Size:** ~1,662 bytes (~386 bytes under the 2 KB free-tier limit as of 2026 season).

---

### `pre_weekend` / `race_weekend` / `live`

```
view          "pre_weekend" | "race_weekend" | "live"
assets_base   GitHub raw base URL
logo          "f1.png"

meeting
  name        full GP name, e.g. "Canadian Grand Prix"
  location    "City, Country"
  circuit_name  display name from circuits.js
  circuit_type  "street" | "permanent" | null
  map           relative path e.g. "circuits/openf1/Montreal.png", or null
  dates         date range + round, e.g. "Jun 13 – 15 (Round 9)"

sessions[]
  day         numeric day, e.g. "13"
  month       abbreviated month, e.g. "Jun"
  name        OpenF1 session name: "Practice 1" | "Practice 2" | "Practice 3" |
              "Sprint Qualifying" | "Sprint" | "Qualifying" | "Race"
  time        time range string, e.g. "14:00 – 16:00" (user's timezone)
  status      "live" | "completed" — omitted when upcoming
  weather     object (omitted for completed sessions)
    temp      e.g. "21°C"
    icon      Tabler icon suffix, e.g. "sun" | "cloud" | "cloud-rain" | "mist" | "snowflake" | "cloud-storm" | "bolt"
    precip    percentage string e.g. "30%" for forecasts; "Wet" | "Dry" for live sessions

standings
  teams[]     top 6 constructors
    pos       integer
    name      full team name
    pts       integer
    delta     integer, omitted when 0

  drivers[]   top 6 drivers
    pos       integer
    name      "F. Surname"
    pts       integer
    delta     integer, omitted when 0

last_session  present after any session completes
  name        e.g. "Practice 1 Results"
  results[]
    pos       finish position integer
    name      "F. Surname"
    img       relative path e.g. "driver/44.png", or null
    compounds string[], e.g. ["S", "M", "H"]
    dnf       boolean
    dns       boolean
    dsq       boolean
    time      winner: lap time string; others: gap string e.g. "+1.234s"
```

---

### `post_race`

All race_weekend fields above, plus:

```
winner
  name      full name
  team      full team name
  img       relative path e.g. "driver/44.png", or null
  grid      qualifying position, e.g. "P3", or null if unknown
  finish    always "P1"

next_race   present when a subsequent GP exists in the calendar
  name      full GP name
  location  "City, Country"
  dates     date range + round, e.g. "Jun 19 – 22 (Round 10)"
  weather   race-day forecast (see weather object above), or null
```

---

## Asset URLs

`assets_base` is constructed from `GITHUB_REPOSITORY` at build time and sent in every payload. The template constructs full URLs as `{assets_base}/{path}`.

```
assets_base:  https://raw.githubusercontent.com/{owner}/{repo}/main/assets

logo:     f1.png
img:      driver/{driver_number}.png
map:      circuits/openf1/{image}             (default)
          circuits/official/{f1_slug}.webp    (CIRCUIT_IMAGE_SOURCE=official)
```

Driver image files only exist if previously downloaded via `scripts/download-assets.js`. If the file is absent, `img` is `null` and the template renders a placeholder div.
