import React from "react";
import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "WasteWise — Know it. Sort it. Save it.",
  description: "Point the camera at whatever’s in your hand. We’ll say which bin it belongs in — for this ward, not a generic chart.",
  manifest: "/manifest.json"
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1.0,
  maximumScale: 5.0
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
<<<<<<< HEAD
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Fredoka:wght@400;500;600;700&family=Luckiest+Guy&family=Noto+Sans+Devanagari:wght@400;600;700&family=Nunito:wght@400;500;600;700;800&display=swap" rel="stylesheet" />
      </head>
      <body className="antialiased">{children}</body>
=======
    <html lang="en" className="js">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Caveat:wght@500;600;700&family=Fredoka:wght@400;500;600;700&family=Luckiest+Guy&family=Noto+Sans+Devanagari:wght@400;600;700&family=Nunito:ital,wght@0,400;0,500;0,600;0,700;0,800;1,400;1,600&display=swap"
          rel="stylesheet"
        />
      </head>
      <body id="app-theme-root" data-active-theme="brand" className="min-h-screen flex flex-col pb-20 md:pb-10 selection:bg-blue-500 selection:text-white">
        {children}
      </body>
>>>>>>> d95c09d4a4f786b54b806f67fba7b96db5fb6d12
    </html>
  );
}
