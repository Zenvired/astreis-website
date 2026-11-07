# Put Astreis online with shared AI

Use the **full source** (`Astreis-Source.zip`), rather than the static upload ZIP.
The website and shared AI function are deployed together. Netlify holds the
owner's Groq key; users sign in to their Astreis account to access AI.

## 1. Create the repository

Unzip `Astreis-Source.zip`. Inside it is an `Astreis_Website` folder.
Create a GitHub repository and upload that folder's **contents**, including
`package.json`, `netlify.toml`, `netlify/`, `server/`, `scripts/`, `downloads/`,
`assets/`, and the page files. Keep `package.json` and `netlify.toml` at the
repository root. Don't upload an actual `.env` file or your secret API key.

## 2. Import into Netlify

In your Netlify team dashboard, select **Add new project → Import an existing
project → GitHub**, then choose the repository. Authorize access when prompted.

Confirm these settings:

| Setting | Value |
| --- | --- |
| Base directory | Leave empty if you uploaded the folder contents at repository root |
| Build command | `npm run build` |
| Publish directory | `dist` |

The included configuration also sets the Functions directory to
`netlify/functions`. If you uploaded the outer `Astreis_Website` folder itself,
set the base directory to `Astreis_Website` instead.

## 3. Set your API key on Netlify

In the project's Environment variables settings, add:

```text
GROQ_API_KEY = your existing Groq API key
```

If Netlify shows scope controls, include **Functions**. Keep the key out of
`netlify.toml`, browser JavaScript, source files, and the installer. There is no
Supabase admin/service-role key to add: the backend already uses the same
public Supabase project settings as the desktop app for verifying sign-in.

Publish the site, or trigger a new production deploy after setting the key.
Use the assigned `https://….netlify.app` address; no custom domain is required.
The production site must be accessible to visitors for the desktop service to
reach it. If your team has private-by-default enabled, make production public;
the AI endpoint independently checks the user's Astreis sign-in.

## 4. Check the setup

Open your site's `/api/ai/status` URL, for example:

```text
https://YOUR-REAL-SITE.netlify.app/api/ai/status
```

It should show `service: "astreis-ai"`, `configured: true` and
`signInRequired: true`. This confirms the function is deployed and the key is
present; the actual sign-in and Chat test are still necessary. A 404 means the
functions weren't deployed. `configured: false` means the function cannot see
the key: check the variable name and scope, then redeploy.

## 5. Install from the deployed website

Download the new `.deb` **from your live website**, then install it through
your software manager. The Netlify build puts its actual public origin inside
this installer automatically. The local pre-deployment `.deb` has no service
origin yet, so it cannot reach a server that hasn't been published.

Open Astreis → Astreis AI → **Continue with Google**. Complete the existing
Google sign-in and send a short Chat message. Signed-out users and invalid
sessions are rejected by the AI backend before it contacts Groq.

Core system tools remain available without signing in. Realtime Voice uses
`/api/voice/session` with the same account verification. Set `LIVEKIT_URL`,
`LIVEKIT_API_KEY` and `LIVEKIT_API_SECRET` in Netlify with Functions scope, then
redeploy. `/api/ai/status` reports `voiceConfigured: true` when they are present.
The 0.1.3 Debian installer includes the native voice runtime; no Python setup
or LiveKit secret is required on users' computers. The existing cloud
`astreis-transcriber` worker must remain deployed. It can take a few seconds
to wake after inactivity.

## Future updates

`npm run build:deb` in the desktop project builds a new installer and updates
the website download, public metadata, production files and delivery ZIPs.
Push the changed website source to GitHub to let Netlify redeploy it.

References: [Netlify repository deploy](https://docs.netlify.com/start/quickstarts/deploy-from-repository/),
[Function environment variables](https://docs.netlify.com/build/functions/environment-variables/),
[Build URL variables](https://docs.netlify.com/build/configure-builds/environment-variables/).
