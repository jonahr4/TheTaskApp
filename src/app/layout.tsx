import type { Metadata } from "next";
import "./globals.css";
import { AuthProvider } from "@/hooks/useAuth";
import { Analytics } from "@vercel/analytics/next";

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

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <AuthProvider>{children}</AuthProvider>
        <Analytics />
      </body>
    </html>
  );
}
