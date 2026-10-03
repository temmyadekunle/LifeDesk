import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // LifeDesk keeps everything in the browser (IndexedDB), so there is no
  // server to run. A static export gives the fastest possible load on a
  // weak connection: pure CDN delivery with no Node function in the path.
  output: "export",
  images: {
    // No image optimiser exists in a static export.
    unoptimized: true,
  },
  trailingSlash: true,
};

export default nextConfig;