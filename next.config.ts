import path from "node:path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactCompiler: true,
  experimental: {
    // Product image uploads go through a Server Action; the default cap is 1MB.
    // The action itself rejects anything over 5MB.
    serverActions: {
      bodySizeLimit: "6mb",
    },
  },
  // Pin the workspace root so a stray lockfile in a parent folder is ignored.
  turbopack: {
    root: path.resolve(__dirname),
  },
};

export default nextConfig;
