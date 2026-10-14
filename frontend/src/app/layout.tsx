import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Bento Board",
  description: "Bespoke architectural task management.",
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
