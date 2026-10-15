import type { Metadata, Viewport } from "next";
import { publicEnv } from "@/lib/env";
import { motionScript } from "@/components/motion/motion-script";
import { fontVariables } from "./fonts";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL(publicEnv.NEXT_PUBLIC_SITE_URL),
  title: { default: "Solei — A destination in scent", template: "%s · Solei" },
  description:
    "Solei is a UAE-based fragrance brand with eight destination-inspired scents and a signature physical loyalty passport.",
  openGraph: { siteName: "Solei", locale: "en_AE", type: "website" },
  appleWebApp: { capable: true, title: "Solei POS", statusBarStyle: "black-translucent" },
  icons: { apple: "/icons/apple-touch-icon.png" },
};

export const viewport: Viewport = {
  themeColor: "#460328",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    // suppressHydrationWarning: the inline motion script may add `data-intro` before hydration.
    <html
      lang="en"
      dir="ltr"
      className={`${fontVariables} h-full antialiased`}
      suppressHydrationWarning
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: motionScript }} />
        {/* The logo sprite every <Logo> points to — fetch it early so the wordmark never pops in. */}
        <link rel="preload" href="/images/brand/logo-sprite.svg" as="image" type="image/svg+xml" />
      </head>
      <body className="flex min-h-full flex-col">{children}</body>
    </html>
  );
}
