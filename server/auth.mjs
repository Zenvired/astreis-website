// These are the same public project settings used by the desktop sign-in flow.
// No Supabase service-role key or project-setting changes are needed.
const PROJECT_URL = 'https://yabglbrkmadospwkkakl.supabase.co';
const PUBLIC_KEY = 'sb_publishable_HUVvV69As78R0B5qG9Nt-A_HEYwOqs3';

export function createSessionVerifier({ fetchAuth = fetch, getConfig = () => ({
  url: process.env.SUPABASE_URL || PROJECT_URL,
  key: process.env.SUPABASE_PUBLISHABLE_KEY || PUBLIC_KEY,
}) } = {}) {
  return async request => {
    const header = request.headers.get('authorization') || '';
    const match = /^Bearer ([A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+)$/i.exec(header);
    if (!match || header.length > 16384) return { status: 401, code: 'authentication', message: 'Sign in to use Astreis AI.' };
    try {
      const { url, key } = getConfig();
      const origin = new URL(url);
      if (origin.protocol !== 'https:' || origin.username || origin.password || origin.pathname !== '/' || origin.search || origin.hash || !key) throw new Error('Invalid auth configuration');
      const response = await fetchAuth(new URL('/auth/v1/user', origin), {
        headers: { apikey: key, Authorization: `Bearer ${match[1]}` },
        signal: AbortSignal.any([request.signal, AbortSignal.timeout(8000)]),
      });
      if ([400, 401, 403].includes(response.status)) return { status: 401, code: 'authentication', message: 'Your session expired. Please sign in again.' };
      if (!response.ok) throw new Error('Auth temporarily unavailable');
      const user = await response.json();
      if (typeof user?.id !== 'string' || !user.id || user.is_anonymous === true) return { status: 401, code: 'authentication', message: 'Sign in to use Astreis AI.' };
      return null;
    } catch {
      return { status: 503, code: 'provider', message: 'Account verification is temporarily unavailable. Please try again shortly.' };
    }
  };
}

export const verifySession = createSessionVerifier();
