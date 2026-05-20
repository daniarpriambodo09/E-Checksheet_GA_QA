import withPWA from "next-pwa";

const isProd = process.env.NODE_ENV === "production";

const basePath = isProd ? "/e-checksheet-qa" : "";

const nextConfig = {
  basePath,
  assetPrefix: basePath,

  reactStrictMode: true,

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
    "192.168.1.33",
  ],
};

export default withPWA({
  dest: "public",

  register: true,
  skipWaiting: true,

  disable: process.env.NODE_ENV === "development",

  sw: "sw.js",

  scope: "/e-checksheet-qa/",

  buildExcludes: [/middleware-manifest\.json$/],

  fallbacks: {
    document: "/_offline",
  },

  runtimeCaching: [
    {
      urlPattern: ({ request }) =>
        request.mode === "navigate",
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
      },
    },

    {
      urlPattern: ({ url }) =>
        url.pathname.startsWith("/_next/static/"),
      handler: "StaleWhileRevalidate",
      options: {
        cacheName: "next-static-cache",
      },
    },

    {
      urlPattern: ({ url }) =>
        /\.(png|jpg|jpeg|svg|gif|webp|ico)$/i.test(url.pathname),
      handler: "CacheFirst",
      options: {
        cacheName: "image-cache",
      },
    },
  ],
})(nextConfig);