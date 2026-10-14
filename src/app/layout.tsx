import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "Solei — A destination in scent", template: "%s · Solei" },
  description: "Destination-led fragrance house from Abu Dhabi. Made to remain.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" dir="ltr" className="h-full antialiased">
      <body className="flex min-h-full flex-col">{children}</body>
    </html>
  );
}
