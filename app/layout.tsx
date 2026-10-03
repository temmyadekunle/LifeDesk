import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "LifeDesk",
  description:
    "One place to manage the things that keep your life running.",
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