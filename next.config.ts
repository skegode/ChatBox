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
  // ESLint config: rely on project ESLint rules (we relaxed some rules in eslint.config.mjs)
  // Remove temporary build bypass so Vercel will run real lint checks.
  // Removed invalid 'trustProxy' option.
};

module.exports = nextConfig;
