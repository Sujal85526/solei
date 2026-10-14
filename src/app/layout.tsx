import type { Metadata, Viewport } from "next";
import { fontVariables } from "./fonts";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000"),
  title: { default: "Solei — A destination in scent", template: "%s · Solei" },
  description:
    "Solei is a destination-led fragrance house from Abu Dhabi. Perfumes and all-over sprays inspired by Cannes, Capri, Santorini and more. Made to remain.",
  openGraph: { siteName: "Solei", locale: "en_AE", type: "website" },
};

export const viewport: Viewport = {
  themeColor: "#460328",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" dir="ltr" className={`${fontVariables} h-full antialiased`}>
      <body className="flex min-h-full flex-col">{children}</body>
    </html>
  );
}
