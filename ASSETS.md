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
| `assets/screenshots/*.webp` | Native 1280×720 captures of Astreis 0.1.6 in both themes |
| `src/shaders.js` | Unchanged shader strings from `Astreis/src/components/background/orbit-shader.ts` and `solar-shader.ts` |
| `downloads/*` | Original files in `Astreis/release/` |

The screenshots show the running desktop app. The Deep Clean workflow and
Setup capability list are diagrams. The package hashes are in
`downloads/SHA256SUMS`.

The website uses your existing product assets; it assigns no new license to
the application or its artwork. The existing font license is included.
