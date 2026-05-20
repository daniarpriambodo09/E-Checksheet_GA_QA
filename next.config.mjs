import withPWA from "next-pwa";

const nextConfig = withPWA({
  dest: "public",
  register: true,
  skipWaiting: true,
  disable: process.env.NODE_ENV === "development",

  fallbacks: {
    document: "/_offline",
  },

  additionalManifestEntries: [
    { url: "/home",                  revision: null },
    { url: "/checksheet-final-assy", revision: null },
    { url: "/status-final-assy",     revision: null },
  ],

  runtimeCaching: [
    {
      urlPattern: ({ request }) => request.mode === "navigate",
      handler: "NetworkFirst",
      options: {
        cacheName: "pages-cache",
        networkTimeoutSeconds: 5,
        expiration: {
          maxEntries: 64,
          maxAgeSeconds: 24 * 60 * 60, 
        },
        cacheableResponse: {
          statuses: [0, 200],
        },
        matchOptions: {
          ignoreSearch: true, 
        },
      },
    },

    {
      urlPattern: ({ url }) => url.pathname.startsWith("/_next/static/"),
      handler: "StaleWhileRevalidate",
      options: {
        cacheName: "next-static-cache",
        expiration: {
          maxEntries: 256,
          maxAgeSeconds: 7 * 24 * 60 * 60, // 7 hari
        },
        cacheableResponse: {
          statuses: [0, 200],
        },
      },
    },

    {
      urlPattern: ({ url }) =>
        url.pathname.startsWith("/_next/image") ||
        /\.(png|jpg|jpeg|svg|gif|webp|ico)$/i.test(url.pathname),
      handler: "CacheFirst",
      options: {
        cacheName: "image-cache",
        expiration: {
          maxEntries: 128,
          maxAgeSeconds: 30 * 24 * 60 * 60,
        },
        cacheableResponse: {
          statuses: [0, 200],
        },
      },
    },

    {
      urlPattern: ({ url }) =>
        url.origin === "https://fonts.googleapis.com" ||
        url.origin === "https://fonts.gstatic.com" ||
        /\.(woff|woff2|ttf|otf|eot)$/i.test(url.pathname),
      handler: "CacheFirst",
      options: {
        cacheName: "font-cache",
        expiration: {
          maxEntries: 32,
          maxAgeSeconds: 365 * 24 * 60 * 60, // 1 tahun
        },
        cacheableResponse: {
          statuses: [0, 200],
        },
      },
    },

    {
      urlPattern: ({ url, request }) =>
        url.pathname.startsWith("/api/") && request.method === "GET",
      handler: "NetworkFirst",
      options: {
        cacheName: "api-cache",
        networkTimeoutSeconds: 5,
        expiration: {
          maxEntries: 128,
          maxAgeSeconds: 24 * 60 * 60, // 24 jam
        },
        cacheableResponse: {
          statuses: [0, 200],
        },
      },
    },
  ],
})({
  allowedDevOrigins: [
    "localhost",
    "10.12.199.79",
    "192.168.1.25",
    "192.168.1.23",
    "192.168.1.27",
    "192.168.1.22",
    "192.168.1.18",
    "10.134.26.79",
    "192.168.1.29",
    "192.168.1.33"
  ],
});

export default nextConfig;
