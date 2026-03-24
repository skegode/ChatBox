import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'developer.nvidia.com' },
      { protocol: 'https', hostname: 'coral.ai' },
      { protocol: 'https', hostname: 'store.arduino.cc' },
      { protocol: 'https', hostname: 'www.raspberrypi.com' },
      { protocol: 'https', hostname: 'img.freepik.com' },
    ],
  },
  turbopack: {
    root: __dirname,
  },
  // Removed invalid 'trustProxy' option.
};

module.exports = nextConfig;
