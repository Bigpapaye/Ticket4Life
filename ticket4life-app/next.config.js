const path = require('path');
const fs = require('fs');
const envPath = path.resolve(__dirname, '../contracts/.env');
if (fs.existsSync(envPath)) {
  require('dotenv').config({ path: envPath });
}

/** @type {import('next').NextConfig} */
const nextConfig = {
  eslint: { ignoreDuringBuilds: true },
  async redirects() {
    return [
      {
        source: "/marketplace",
        destination: "/marketplaceV2",
        permanent: true,
      },
      {
        source: "/marketplace/:path*",
        destination: "/marketplaceV2/:path*",
        permanent: true,
      },
    ];
  },
};

module.exports = nextConfig;
