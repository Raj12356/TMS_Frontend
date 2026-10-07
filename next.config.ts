import type { NextConfig } from "next";

const backendUrl =
  process.env.BACKEND_URL ||
  process.env.NEXT_PUBLIC_BACKEND_URL ||
  "http://localhost:8008";

const cleanBackendUrl = backendUrl.replace(/\/$/, "");

const nextConfig: NextConfig = {
  serverExternalPackages: ["pg"],
  async rewrites() {
    // When deployed or when BACKEND_URL is provided, proxy all API calls directly to Spring Boot backend
    if (process.env.BACKEND_URL || process.env.NEXT_PUBLIC_BACKEND_URL) {
      return {
        beforeFiles: [
          {
            source: "/api/:path*",
            destination: `${cleanBackendUrl}/api/:path*`,
          },
        ],
      };
    }

    return [];
  },
};

export default nextConfig;
