const BACKEND = process.env.NEXT_PUBLIC_API_URL || process.env.BACKEND_URL || "http://localhost:8000";
/** @type {import('next').NextConfig} */
const nextConfig = {
  async rewrites() {
    return [{ source: "/api/:path*", destination: `${BACKEND}/:path*` }];
  },
  experimental: {},
};
export default nextConfig;
