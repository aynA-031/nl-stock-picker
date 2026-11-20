import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Reduce optional native deps pressure in constrained networks
  images: { unoptimized: true },
};

export default nextConfig;
