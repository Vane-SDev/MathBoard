import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Web estática: la sirve el Worker de Cloudflare junto con las salas.
  output: "export",
  /* config options here */
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
