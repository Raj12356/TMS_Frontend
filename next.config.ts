import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["pg"],
  async rewrites() {
    // When using the Spring Boot backend on port 8008
    return [
      {
        source: "/api/:path*",
        destination: "http://localhost:8008/api/:path*",
      },
    ];
  },
};

export default nextConfig;
