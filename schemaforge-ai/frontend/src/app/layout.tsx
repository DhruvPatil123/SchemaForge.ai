/* eslint-disable @next/next/no-css-tags */
import type { Metadata } from "next";
import "./globals.css";
import { Navbar } from "@/components/navbar";
import { ThemeProvider } from "@/components/theme-provider";
import { CookieConsent } from "@/components/cookie-consent";
import { SiteFooter } from "@/components/site-footer";

export const metadata: Metadata = {
  title: "SchemaForge AI - Plain English to Database Schema",
  description:
    "Transform plain English descriptions into production-ready database schemas across all major platforms.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark" suppressHydrationWarning>
      <head>
        <link rel="stylesheet" href="/app.css" />
      </head>
      <body className="font-sans">
        <ThemeProvider>
          <Navbar />
          {children}
          <SiteFooter />
          <CookieConsent />
        </ThemeProvider>
      </body>
    </html>
  );
}
