# Astreis website

For step-by-step publishing instructions, read [DEPLOY.md](DEPLOY.md).

The immersive Astreis landing page, with light/dark themes, the app's animated
sun and black-hole materials, native screenshots, feature explorer, About,
requirements, installation instructions, FAQ, and Debian and Flatpak downloads.

The page uses plain HTML, CSS and JavaScript with no runtime dependencies.
The source also includes an optional server-only Netlify function for shared
desktop Chat. It is separate from the static page. See [SHARED-AI.md](SHARED-AI.md)
for deployment and the desktop release build.

## Preview locally

With Node 20 or newer:

```sh
npm run dev
```

Open the URL printed in your terminal (normally http://localhost:4173).
If that port is already in use, the server automatically tries the next one.
To choose a starting port, use `npm run dev -- --port 4200` or
`PORT=4200 npm run dev`. Press Ctrl+C to stop your preview cleanly.

Use a local server rather than double-clicking
`index.html`, because browsers restrict JavaScript module imports on `file://`.
Any static development server also works.

## Put it on Netlify

### Drag and drop

The supplied `Astreis-Netlify.zip` already contains the deployable files.
This is a **static-page-only** upload. For shared AI, deploy the full source
from Git as described in `SHARED-AI.md`; a static drop doesn't deploy functions.
Unzip it and drag that folder to [Netlify Drop](https://app.netlify.com/drop).
You can also generate it again:

```sh
npm run build
```

Then upload the **dist folder**, with `index.html` at its top level.

### Deploy from your own Git repository

Push this website directory as a repository and import it into Netlify.
The included `netlify.toml` sets:

- Build command: `npm run build`
- Publish directory: `dist`
- Node version: `22`

If the website lives in a larger repository, set Netlify's base directory
to `Astreis_Website`. The deployed website remains ordinary static files.

Official references: [manual deploys](https://docs.netlify.com/deploy/create-deploys/)
and [build configuration](https://docs.netlify.com/build/configure-builds/overview/).

## Editing

- `index.html` — all copy, features, About, FAQ, download links and metadata.
- `styles.css` — layout, colors, typography, responsive rules and transitions.
- `src/main.js` — themes, feature tabs, mobile navigation and copy button.
- `src/celestial.js` — the standalone, low-power WebGL renderer.
- `src/shaders.js` — the actual Astreis solar and orbit shader materials.
- `assets/` — local artwork, logos, font, and genuine native app captures.
- `downloads/` — the Debian and Flatpak installers, `INSTALL.txt`, and `SHA256SUMS`.
- `_headers` — static-host response headers, included with manual deploys.
- `netlify.toml` — Netlify build and response-header configuration.
- `netlify/functions/ai-chat.mjs` — shared streaming Chat endpoint and rate rule.
- `server/ai.mjs` — server-only request validation, credential use and streaming.
- `SHARED-AI.md` — owner setup and shared desktop release instructions.

Build a desktop release with `npm run build:deb` in the sibling `Astreis/`
folder. This automatically synchronizes both packages, checksums, release version,
size, install commands, headers, `dist/`, and delivery ZIPs. To repeat just that
synchronization here, use `npm run sync:release`.

On Netlify, the build also configures the Debian package with the site's main public
URL, so users don't need a separate API address. `GROQ_API_KEY` stays in the
server function's environment. See `SHARED-AI.md`.

The slogan is “A PC optimizer, built for Linux.” It doesn't claim an unverified
“first ever.” AI and voice are described with their external-service setup
requirement. No pricing, license, testimonials, or performance uplift is invented.

## Motion and access

Light is the default; the theme and manual pause preference persist locally.
The background has a pause button, respects reduced-motion preferences, pauses
offscreen and in hidden tabs, and is capped at 30 fps and 1.4 million pixels.
The original static artwork stays visible if WebGL is unavailable. Feature
tabs support arrow keys, Home and End. The layout works on mobile, with a
keyboard-accessible menu, semantic FAQ disclosures and a skip link.

## Checks

```sh
npm run check
npm test
npm run build
```

The first checks local asset references, anchors, accessible tab bindings,
JavaScript syntax, and the original download checksum. The build just copies
the production files into `dist`; there is no framework to install.
The server tests cover an occupied port, CLI overrides, graceful shutdown,
download HEAD responses and invalid-port errors.

Optional browser integration checks use Node 22 and an existing Chromium-based
browser, with the local server running:

```sh
BROWSER_BIN=/path/to/chromium node scripts/browser-qa.mjs
```

On the development machine Brave is the default. This tool is only for local
QA and isn't needed to build or deploy. Review captures and results are written
to `output/`, which is excluded from the source archive and deployment.

## Assets

See `ASSETS.md` for provenance. The desktop application's source and behavior
were not changed to make this website. No generated UI mockups are used in the
finished page; the early layout images were reference concepts only.
