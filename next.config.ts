import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // resvg ships a native .node binary; keep it out of the server bundle.
  serverExternalPackages: ["@resvg/resvg-js"],
  // Font files are read from disk at runtime by the text-to-path renderer.
  outputFileTracingIncludes: { "/api/**": ["./assets/fonts/**"] },
};

export default nextConfig;
