// next.config.js
/** @type {import('next').NextConfig} */
const nextConfig = {
    typescript: {
      // ❌ ignora errores de tipos en el build
      ignoreBuildErrors: true,
    },
    eslint: {
      // ❌ ignora errores de lint en el build
      ignoreDuringBuilds: true,
    },
    reactStrictMode: true,
  };
  
  module.exports = nextConfig;
  