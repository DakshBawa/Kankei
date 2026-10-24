// Browser calls /api/* on this app; Next proxies it to your backend (no CORS setup needed).
const BACKEND = process.env.BACKEND_URL || "http://localhost:5000";
export default {
  async rewrites() {
    return [{ source: "/api/:path*", destination: `${BACKEND}/api/:path*` }];
  },
};
