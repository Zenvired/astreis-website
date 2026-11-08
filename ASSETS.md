# Asset provenance

All paths below are relative to the existing Astreis workspace. Files are
copied into this standalone project, so the deployed site needs no parent folders.

| Website asset | Source |
| --- | --- |
| `assets/sun.png` | `Astreis/src/assets/backgrounds/solar-pearl.png` |
| `assets/black-hole.png` | `Astreis/src/assets/backgrounds/orbit-blue.png` |
| `assets/logo-light.png` | `Astreis_Icons/astreis-sun.png` |
| `assets/logo-dark.png` | `Astreis_Icons/astreis-black-hole.png` |
| `assets/favicon.png` | `Astreis_Icons/astreis-sun.png`, resized to 32×32 |
| `assets/favicon-dark.png` | `Astreis_Icons/astreis-black-hole.png`, resized to 32×32 |
| `assets/fonts/geist.woff2` | `Astreis_Trailer/assets/graphics/fonts/Geist-latin-variable.woff2` |
| `assets/fonts/LICENSE.txt` | The existing bundled Geist font license |
| `assets/screenshots/home-light.webp` | `Astreis_Trailer/renders/energetic_sample/source_home.png`, a native capture |
| `assets/screenshots/home-dark.webp` | 0.8 s into `Astreis_Trailer/assets/footage/application/C00_native-ui-dark_30fps_t02.mkv`, at its native 1280×720 resolution |
| `assets/screenshots/monitor.webp` | `Astreis_Trailer/reviews/full_recording_2026-11-07/monitor.png` |
| `assets/screenshots/optimize.webp` | `Astreis_Trailer/reviews/full_recording_2026-11-07/recommended.png` |
| `assets/screenshots/ai.webp` | `Astreis_Trailer/reviews/full_recording_2026-11-07/ai.png` |
| `src/shaders.js` | Unchanged shader strings from `Astreis/src/components/background/orbit-shader.ts` and `solar-shader.ts` |
| `downloads/*` | Original files in `Astreis/release/` |

Native screenshots are encoded as WebP without inventing or altering UI state.
The Deep Clean workflow diagram and Setup capability list are explanatory
website graphics, not claimed software screenshots. No synthetic performance
readings, working voice-session demonstration, testimonial, or stock photograph
is used. The original application and trailer assets are preserved.

The package SHA-256 is
`55e117eda95b9fd486e94065c1fdb8e578124a294f2f30d87c5118b76a9163a3`.
The website uses your existing product assets; it assigns no new license to
the application or its artwork. The existing font license is included.
