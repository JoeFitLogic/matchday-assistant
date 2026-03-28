import withPWA from 'next-pwa';

const pwaConfig = withPWA({
  dest: 'public',
  disable: process.env.NODE_ENV === 'development',
  register: true,
  skipWaiting: true,
  fallbacks: {
    document: '/offline',
  },
  runtimeCaching: [
    // ── Supabase REST API: player roster ────────────────────────────────────
    // NetworkFirst — serve cached roster when offline, refresh when online.
    {
      urlPattern: /^https:\/\/[a-z]+\.supabase\.co\/rest\/v1\/players/,
      handler: 'NetworkFirst',
      options: {
        cacheName: 'matchday-players',
        networkTimeoutSeconds: 5,
        expiration: {
          maxEntries: 200,
          maxAgeSeconds: 24 * 60 * 60, // 24 hours
        },
        cacheableResponse: { statuses: [0, 200] },
      },
    },
    // ── Supabase REST API: sessions + related data ───────────────────────────
    // NetworkFirst — active session must be available offline during matches.
    {
      urlPattern: /^https:\/\/[a-z]+\.supabase\.co\/rest\/v1\/(sessions|teams|team_players|matches|attendance|player_match_minutes)/,
      handler: 'NetworkFirst',
      options: {
        cacheName: 'matchday-sessions',
        networkTimeoutSeconds: 5,
        expiration: {
          maxEntries: 500,
          maxAgeSeconds: 12 * 60 * 60, // 12 hours
        },
        cacheableResponse: { statuses: [0, 200] },
      },
    },
    // ── Supabase REST API: other reads (development assessments, seasons) ────
    {
      urlPattern: /^https:\/\/[a-z]+\.supabase\.co\/rest\/v1\//,
      handler: 'NetworkFirst',
      options: {
        cacheName: 'matchday-api',
        networkTimeoutSeconds: 5,
        expiration: {
          maxEntries: 200,
          maxAgeSeconds: 6 * 60 * 60,
        },
        cacheableResponse: { statuses: [0, 200] },
      },
    },
    // ── Next.js app pages ────────────────────────────────────────────────────
    // StaleWhileRevalidate for app shell; offline falls back to /offline.
    {
      urlPattern: /^https?:\/\/.*\/_next\/static\/.*/,
      handler: 'CacheFirst',
      options: {
        cacheName: 'next-static',
        expiration: {
          maxEntries: 200,
          maxAgeSeconds: 30 * 24 * 60 * 60, // 30 days
        },
      },
    },
    {
      urlPattern: /^https?:\/\/.*\/_next\/image.*/,
      handler: 'StaleWhileRevalidate',
      options: {
        cacheName: 'next-images',
        expiration: {
          maxEntries: 100,
          maxAgeSeconds: 7 * 24 * 60 * 60,
        },
      },
    },
    // ── App pages (HTML navigation) ──────────────────────────────────────────
    {
      urlPattern: /^https?:\/\/[^/]+(\/sessions|\/players|\/)?$/,
      handler: 'NetworkFirst',
      options: {
        cacheName: 'matchday-pages',
        networkTimeoutSeconds: 5,
        expiration: {
          maxEntries: 50,
          maxAgeSeconds: 24 * 60 * 60,
        },
        cacheableResponse: { statuses: [0, 200] },
      },
    },
    // ── Google Fonts ─────────────────────────────────────────────────────────
    {
      urlPattern: /^https:\/\/fonts\.(googleapis|gstatic)\.com\/.*/,
      handler: 'CacheFirst',
      options: {
        cacheName: 'google-fonts',
        expiration: {
          maxEntries: 20,
          maxAgeSeconds: 365 * 24 * 60 * 60,
        },
        cacheableResponse: { statuses: [0, 200] },
      },
    },
  ],
});

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
};

export default pwaConfig(nextConfig);
