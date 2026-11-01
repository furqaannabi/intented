import type { NextConfig } from "next";

// The browser only talks to this app; the read-only API routes are proxied to the API host.
const API_URL = process.env.API_URL ?? "http://localhost:8787";

const nextConfig: NextConfig = {
  cacheComponents: true,
  rewrites: async () => [
    { source: "/api/proposals", destination: `${API_URL}/api/proposals` },
    { source: "/api/proposals/:id", destination: `${API_URL}/api/proposals/:id` },
    { source: "/api/redteam/latest", destination: `${API_URL}/api/redteam/latest` },
  ],
  partialPrefetching: true,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
