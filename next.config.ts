import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  images: {
    domains: [
      "developer.nvidia.com",
      "coral.ai",
      "store.arduino.cc",
      "www.raspberrypi.com",
      "img.freepik.com"
    ],
  },
  // Add this to trust proxy headers (for correct protocol/host in SSR)
  trustProxy: true,
};

module.exports = nextConfig;

export default nextConfig;
