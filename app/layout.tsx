import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Livanta",
  description:
    "One place to manage the things that keep your life running.",
  icons: { icon: "/logo.jpeg" },
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