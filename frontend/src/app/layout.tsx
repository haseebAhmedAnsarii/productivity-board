import type { Metadata } from "next";
import "./globals.scss";

export const metadata: Metadata = {
  title: "Bento Board",
  description: "Bespoke architectural task management.",
  icons: {
    icon: [
      { url: "/icon.svg", type: "image/svg+xml" },
      { url: "/favicon.ico", sizes: "32x32" },
    ],
  },
};

const themeScript = `
(function() {
  try {
    var saved = localStorage.getItem('pb_theme_mode') || 'default';
    var resolved = saved;
    if (saved === 'default') {
      resolved = (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) ? 'dark' : 'light';
    }
    document.documentElement.setAttribute('data-theme', resolved);
  } catch (e) {}
})();
`;

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head suppressHydrationWarning />
      <body suppressHydrationWarning>
        <script
          id="theme-initializer"
          suppressHydrationWarning
          dangerouslySetInnerHTML={{ __html: themeScript }}
        />
        {children}
      </body>
    </html>
  );
}
