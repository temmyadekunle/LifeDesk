import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Livanta",
  description:
    "One place to manage the things that keep your life running.",
  icons: {
    // Square set generated from the same source artwork by
    // scripts/make-favicons.mjs, so the tab icon cannot drift from the in-app
    // mark. The source is a 3:2 landscape image, so a square pad is used
    // rather than a crop.
    icon: [
      { url: "/icon-32.png", sizes: "32x32", type: "image/png" },
      { url: "/icon-192.png", sizes: "192x192", type: "image/png" },
    ],
    apple: [{ url: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" }],
  },
  appleWebApp: {
    capable: true,
    title: "Livanta",
    statusBarStyle: "default",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  // Without viewport-fit=cover the layout viewport is inset to the safe area,
  // and every env(safe-area-inset-*) value in the stylesheet resolves to 0.
  // That silently disables the bottom padding that keeps the navigation bar
  // clear of the home indicator on notched phones, which is most of the
  // phones this app is built for.
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f4f6fa" },
    { media: "(prefers-color-scheme: dark)", color: "#0d1117" },
  ],
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}