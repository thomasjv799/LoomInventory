import type { Metadata } from "next";
import "./globals.css";
export const metadata: Metadata = {
  title: "The Loom · Inventory Studio",
  description: "A simulated inventory intelligence prototype for The Loom.",
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
