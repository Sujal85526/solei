import type { NextConfig } from "next";

// Product photos uploaded in the admin live in the Supabase Storage `products` bucket.
const supabase = new URL(process.env.NEXT_PUBLIC_SUPABASE_URL ?? "http://127.0.0.1:54321");

const nextConfig: NextConfig = {
  cacheComponents: true,
  partialPrefetching: true,
  // Dev only: let the in-app preview browser (which opens 127.0.0.1) load dev assets and hydrate.
  allowedDevOrigins: ["127.0.0.1"],
  // Policies live on one Help page; keep old links working.
  async redirects() {
    return [
      { source: "/policies/delivery", destination: "/help?tab=shipping", permanent: true },
      { source: "/policies/returns", destination: "/help?tab=returns", permanent: true },
      { source: "/policies/cookies", destination: "/help?tab=cookies", permanent: true },
      { source: "/policies/privacy", destination: "/help?tab=privacy", permanent: true },
      { source: "/policies/terms", destination: "/help?tab=terms", permanent: true },
      { source: "/policies/:path*", destination: "/help", permanent: true },
    ];
  },
  experimental: {
    // Tailwind output is small and atomic; inlining removes the render-blocking stylesheet request.
    inlineCss: true,
  },
  images: {
    formats: ["image/avif", "image/webp"],
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
