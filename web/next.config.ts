import type { NextConfig } from "next";

// The browser only talks to this app; the API routes it uses are proxied to the API host.
const API_URL = process.env.API_URL ?? "http://localhost:8787";

const nextConfig: NextConfig = {
  cacheComponents: true,
  rewrites: async () => [
    { source: "/api/mandate", destination: `${API_URL}/api/mandate` },
    { source: "/api/mandates/:hash", destination: `${API_URL}/api/mandates/:hash` },
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
