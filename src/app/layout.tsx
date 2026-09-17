import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { ZoneDataProvider } from "@/lib/data/zone-context";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Haven Zone E4 Portal",
  description: "Member management and analytics for Haven Zone E4",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <ZoneDataProvider>{children}</ZoneDataProvider>
      </body>
    </html>
  );
}
