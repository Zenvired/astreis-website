# Shared Astreis AI

The updated installer includes the shared Chat client and load-limit message.
The service becomes available after the full website source is deployed with
its server key configured. No provider secret is included in the installer.

## Deploy once as the owner

1. Put this full website source in your own Git repository and import it in
   Netlify. Use `Astreis_Website` as the base directory if your repository also
   contains the desktop app.
2. Add `GROQ_API_KEY` in Netlify environment variables with **Functions** scope.
   Redeploy after setting it. Never put the key in client files or the `.deb`.
3. The website build reads Netlify's main `URL` automatically and writes that
   public origin into `/usr/share/astreis/service.json` inside the downloadable
   installer. It then regenerates its checksum, size and public metadata.
   Users downloading this package connect to the shared service automatically.
   There is no second Rust build needed merely to learn the assigned URL.

On another host, set `ASTREIS_API_BASE_URL` when running `npm run build`, with
an actual HTTPS service origin. Configuring a package at website build time
requires the Linux `dpkg-deb` tool; the build fails rather than silently shipping
an installer with an outdated address if that preparation cannot complete.

## Update the desktop release

Run `npm run build:deb` from `Astreis/`. It now copies the real new release to
this website, updates all download links, versions, sizes, hashes and install
commands, builds `dist`, and recreates both delivery ZIPs. It fails if any
synchronization or verification step fails. Run `npm run sync:release` here to
repeat the synchronization without recompiling an already built app.

**A static Netlify Drop upload alone cannot install these server functions.**
Use the source/Git deploy above (or Netlify CLI from the full source). The
static upload ZIP remains useful for the page, but not for shared AI.

## What users get

The public service URL is configured in the installer at website deployment,
or can be compiled in by the owner with `ASTREIS_API_BASE_URL`.
Users sign in with their Astreis account. The backend verifies that session
before using the shared API key; users never enter a provider key.
The installed app sends its existing bounded Chat request to the backend,
which calls Groq with the owner's server-held key and streams tokens back.
The microphone, realtime voice transport and approved app artwork are unchanged.
LiveKit still needs its existing service/runtime configuration.

On provider or gateway HTTP 429, the desktop displays:

> Under heavy load. Please try again shortly.

There is no automatic request loop. The server returns a bounded `Retry-After`
value for provider limits. Netlify enforces 8 requests per IP/domain per minute;
the model is fixed to `openai/gpt-oss-120b`, chat output to 1536 tokens and brief
voice-mode chat output to 192. Requests are bounded to 64 KiB and 40,000 text
characters across at most 17 messages. The service doesn't provide a general
proxy, let a caller choose a model/endpoint, or return raw provider errors.
Limits and quota remain shared across the owner's Groq account. The rate rule
is per IP, not a global budget or authenticated per-person quota.

Tests use fake upstream responses and don't consume API credits. Run:

```sh
npm test
npm run check
npm run build
```

References: [Netlify build URLs](https://docs.netlify.com/build/configure-builds/environment-variables/),
[Netlify streaming Functions](https://docs.netlify.com/build/functions/api/),
[Netlify rate limits](https://docs.netlify.com/manage/security/secure-access-to-sites/rate-limiting/),
[Groq rate limits](https://console.groq.com/docs/rate-limits).
