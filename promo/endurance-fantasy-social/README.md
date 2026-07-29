# Endurance Fantasy — vertical social promo

A 15-second, 1080×1920 launch reel built directly from the app’s production visual system and
fantasy mechanics.

## Story

1. **Event:** The WeatherTech Landing hero transitions from Coming Soon to Picks Open.
2. **Start:** The general mobile Pit Lane opens with the four class slots ready to fill.
3. **Pick:** The Add Picks board filters to GTP and adds one team.
4. **Decision:** The Pit Lane fills the remaining classes until the $35.0M cap hits $0.
5. **Edge + confirmation:** The Bonuses panel assigns Double Points Team, then saves in place and
   shows the actual success banner without navigating away.
6. **CTA:** The app’s own Pick / Lock / Score language and Sign In to Play action.

The car thumbnails use the exact class-tinted fallback icon from `EntityThumb`. The layout reproduces
the application’s mobile navigation, event hero, header band, class requirement pills, pit-lane rows,
modifier panel, button geometry, status vocabulary, and 2–4px corner language.

Prices and the $35.0M cap mirror the live production WeatherTech board for Road America (round 7).
The illustrated lineup totals exactly $35.0M.

The font assets are the same production Google Fonts requested by `apps/web/index.html`:
Saira Semi Condensed (500–800), Saira, and Spline Sans Mono.

## Render

```bash
NODE_PATH=/Users/arjunakankipati/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules node render.mjs
```

The renderer uses bundled Playwright for exact browser font shaping and the system `ffmpeg`.

Outputs:

- `output/endurance-fantasy-promo-vertical.mp4`
- `output/endurance-fantasy-promo-poster.png`
- `output/sound-design.wav`

The MP4 is H.264/AAC with fast-start enabled and is suitable for Instagram Reels, TikTok, and
YouTube Shorts.
