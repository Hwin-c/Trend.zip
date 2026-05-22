// Spotify OAuth 2.0 PKCE Authentication
// No backend server needed — runs entirely in the browser

const CLIENT_ID = import.meta.env.VITE_SPOTIFY_CLIENT_ID || 'e94309da3a494239a7555696397e2e6a';
const getRedirectUri = (): string => {
  const origin = window.location.origin;
  const hostname = window.location.hostname;
  
  // 로컬 개발 환경에서 접속한 주소(localhost 또는 127.0.0.1) 그대로 매핑을 유지
  if (hostname === 'localhost') {
    return 'http://localhost:3000';
  }
  if (hostname === '127.0.0.1') {
    return 'http://127.0.0.1:3000';
  }
  // 파이어베이스 운영 배포 서버 환경 (끝 슬래시 포함 형태 유지)
  return origin.endsWith('/') ? origin : origin + '/';
};

const REDIRECT_URI = getRedirectUri();
const SCOPES = [
  'user-read-private',
  'user-read-email',
  'user-library-read',
  'user-library-modify',
  'playlist-read-private',
  'playlist-modify-public',
  'playlist-modify-private',
].join(' ');

const TOKEN_KEY = 'spotify_access_token';
const TOKEN_EXPIRY_KEY = 'spotify_token_expiry';
const VERIFIER_KEY = 'spotify_code_verifier';

// --- PKCE Helpers ---

function generateCodeVerifier(): string {
  const array = new Uint8Array(64);
  crypto.getRandomValues(array);
  return Array.from(array, (byte) => byte.toString(36).padStart(2, '0')).join('').substring(0, 128);
}

async function generateCodeChallenge(verifier: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(verifier);
  const digest = await crypto.subtle.digest('SHA-256', data);
  return btoa(String.fromCharCode(...new Uint8Array(digest)))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

// --- Public API ---

/**
 * Redirect user to Spotify authorization page
 */
export async function loginWithSpotify(): Promise<void> {
  const verifier = generateCodeVerifier();
  const challenge = await generateCodeChallenge(verifier);

  // Store verifier for the callback
  localStorage.setItem(VERIFIER_KEY, verifier);

  const params = new URLSearchParams({
    client_id: CLIENT_ID,
    response_type: 'code',
    redirect_uri: REDIRECT_URI,
    scope: SCOPES,
    code_challenge_method: 'S256',
    code_challenge: challenge,
    state: crypto.randomUUID(),
  });

  window.location.href = `https://accounts.spotify.com/authorize?${params.toString()}`;
}

/**
 * Handle the callback from Spotify, exchange code for access token
 */
export async function handleSpotifyCallback(): Promise<string | null> {
  const urlParams = new URLSearchParams(window.location.search);
  const code = urlParams.get('code');
  const verifier = localStorage.getItem(VERIFIER_KEY);

  if (!code || !verifier) return null;

  // Consume the verifier immediately to prevent duplicate token exchange requests in React Strict Mode double-mounting
  localStorage.removeItem(VERIFIER_KEY);

  // Clean the URL immediately (remove ?code=... from address bar) to prevent subsequent hook triggers
  const cleanUrl = window.location.pathname + window.location.hash;
  window.history.replaceState({}, document.title, cleanUrl);

  try {
    const res = await fetch('https://accounts.spotify.com/api/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: CLIENT_ID,
        grant_type: 'authorization_code',
        code,
        redirect_uri: REDIRECT_URI,
        code_verifier: verifier,
      }),
    });

    const data = await res.json();

    if (data.access_token) {
      localStorage.setItem(TOKEN_KEY, data.access_token);
      localStorage.setItem(TOKEN_EXPIRY_KEY, String(Date.now() + data.expires_in * 1000));

      return data.access_token;
    }

    console.error('Spotify token exchange failed:', data);
    return null;
  } catch (error) {
    console.error('Spotify callback error:', error);
    return null;
  }
}

/**
 * Get stored access token (returns null if expired or not present)
 */
export function getAccessToken(): string | null {
  const token = localStorage.getItem(TOKEN_KEY);
  const expiry = localStorage.getItem(TOKEN_EXPIRY_KEY);

  if (!token || !expiry) return null;
  if (Date.now() > Number(expiry)) {
    // Token expired, clear it
    logout();
    return null;
  }

  return token;
}

/**
 * Check if user is logged in with a valid token
 */
export function isLoggedIn(): boolean {
  return getAccessToken() !== null;
}

/**
 * Clear all stored Spotify tokens
 */
export function logout(): void {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(TOKEN_EXPIRY_KEY);
  localStorage.removeItem(VERIFIER_KEY);
}

/**
 * Fetch current user's Spotify profile
 */
export async function getSpotifyProfile(): Promise<{ display_name: string; images: { url: string }[] } | null> {
  const token = getAccessToken();
  if (!token) return null;

  try {
    const res = await fetch('https://api.spotify.com/v1/me', {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) return null;
    return res.json();
  } catch {
    return null;
  }
}
