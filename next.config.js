const legacyPreviewRedirects = require("./config/legacy-preview-redirects.json");

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  async redirects() {
    return [...legacyPreviewRedirects, {
      source: "/",
      has: [{ type: "host", value: "mmachine-website-codex\\.muddy-silence-4f5b\\.workers\\.dev" }],
      destination: "https://m-machine.co.uk/",
      permanent: true,
    }, {
      source: "/:path*",
      has: [{ type: "host", value: "mmachine-website-codex\\.muddy-silence-4f5b\\.workers\\.dev" }],
      destination: "https://m-machine.co.uk/:path*",
      permanent: true,
    }];
  },
  async headers() {
    const securityHeaders = [
      { key: "X-Content-Type-Options", value: "nosniff" },
      { key: "X-Frame-Options", value: "DENY" },
      { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
      { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=()" },
      { key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains" },
    ];

    return [
      { source: "/:path*", headers: securityHeaders },
      {
        source: "/dashboard/:path*",
        headers: [{ key: "X-Robots-Tag", value: "noindex, nofollow, noarchive" }],
      },
      {
        source: "/api/:path*",
        headers: [{ key: "X-Robots-Tag", value: "noindex, nofollow, noarchive" }],
      },
    ];
  },
};

module.exports = nextConfig;
