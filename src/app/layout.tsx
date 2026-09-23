import type { Metadata } from "next";
import "./globals.css";
import { AuthProvider } from "@/hooks/useAuth";
import { ThemeProvider } from "@/hooks/useTheme";
import { Analytics } from "@vercel/analytics/next";
import { SpeedInsights } from "@vercel/speed-insights/next";
export const metadata: Metadata = {
  title: "TaskApp",
  description: "Google Tasks + Eisenhower Matrix + Calendar",
  icons: {
    icon: "/icon.svg",
    apple: "/icon.png",
  },
  openGraph: {
    images: ["/opengraph-image.png"],
  },
  twitter: {
    card: "summary_large_image",
    images: ["/twitter-image.png"],
  },
};

// Runs before first paint so the correct theme is applied with no flash.
const themeInitScript = `
(function() {
  try {
    var choice = localStorage.getItem("taskapp.theme") || "auto";
    var dark = choice === "dark" || (choice === "auto" && window.matchMedia("(prefers-color-scheme: dark)").matches);
    document.documentElement.dataset.theme = dark ? "dark" : "light";
  } catch (e) {
    document.documentElement.dataset.theme = "light";
  }
})();
`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
      </head>
      <body>
        <ThemeProvider>
          <AuthProvider>{children}</AuthProvider>
        </ThemeProvider>
        <Analytics />
        <SpeedInsights />
      </body>
    </html>
  );
}
