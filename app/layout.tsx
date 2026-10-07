import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "CareNBuddi",
  description:
    "Your Health, Your Buddi - Personal health navigation system for finding care, booking appointments, and managing health records.",
  icons: {
    icon: [
      { url: "/icon-32.png", sizes: "32x32", type: "image/png" },
      { url: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icon-maskable-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [{ url: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" }],
  },
  appleWebApp: {
    capable: true,
    title: "CareNBuddi",
    statusBarStyle: "default",
  },
  manifest: "/manifest.webmanifest",
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
  // Kept in sync with --bg in globals.css and with the manifest. The browser
  // chrome is painted from this before the page loads, so a mismatch here is a
  // visible seam between the status bar and the app. tests/pwa.test.tsx asserts
  // the light value still matches.
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f7f8fb" },
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