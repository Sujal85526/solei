import type { NextConfig } from "next";

// Product photos uploaded in the admin live in the Supabase Storage `products` bucket.
const supabase = new URL(process.env.NEXT_PUBLIC_SUPABASE_URL ?? "http://127.0.0.1:54321");

const nextConfig: NextConfig = {
  cacheComponents: true,
  partialPrefetching: true,
  // Dev only: let the in-app preview browser (which opens 127.0.0.1) load dev assets and hydrate.
  allowedDevOrigins: ["127.0.0.1"],
  // Site photos: browsers keep them for 31 days (Vercel passes this on to the optimized images,
  // which otherwise go out with max-age=0). Replacing a photo? Give it a new file name.
  async headers() {
    return [
      {
        source: "/images/:path*",
        headers: [
          { key: "Cache-Control", value: "public, max-age=2678400, stale-while-revalidate=86400" },
        ],
      },
    ];
  },
  // Policies live on one Help page; keep old links working.
  async redirects() {
    return [
      { source: "/policies/delivery", destination: "/help?tab=shipping", permanent: true },
      { source: "/policies/returns", destination: "/help?tab=returns", permanent: true },
      { source: "/policies/cookies", destination: "/help?tab=cookies", permanent: true },
      { source: "/policies/privacy", destination: "/help?tab=privacy", permanent: true },
      { source: "/policies/terms", destination: "/help?tab=terms", permanent: true },
      { source: "/policies/:path*", destination: "/help", permanent: true },
      // The destinations pages were removed (client): old links land on the collection.
      { source: "/destinations", destination: "/shop", permanent: true },
      {
        source: "/admin/coupons/:path*",
        destination: "/admin/promotions/:path*",
        permanent: false,
      },
      { source: "/destinations/:path*", destination: "/shop", permanent: true },
    ];
  },
  // CSS ships as one cached stylesheet. (experimental.inlineCss copied the whole sheet into every
  // page's HTML and its RSC payload — ~740 KB per page — so it was turned off.)
  images: {
    // WebP only: AVIF is a little smaller but slow to encode, so the first visit after each deploy
    // waited up to ~1 s per photo while Vercel re-encoded it.
    formats: ["image/webp"],
    // Browsers and the CDN keep optimized photos for 31 days (the default sent max-age=0 to
    // browsers, so every visit fetched every photo again). Replacing a photo? Give it a new name.
    minimumCacheTTL: 2678400,
    remotePatterns: [
      {
        protocol: supabase.protocol.replace(":", "") as "http" | "https",
        hostname: supabase.hostname,
        port: supabase.port,
        pathname: "/storage/v1/object/public/**",
      },
    ],
    // Local Supabase serves storage from 127.0.0.1; only then may the optimizer fetch a local IP.
    dangerouslyAllowLocalIP: ["127.0.0.1", "localhost"].includes(supabase.hostname),
  },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
