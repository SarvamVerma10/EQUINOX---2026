import React from "react";
import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "WasteWise — Know it. Sort it. Save it.",
  description: "Identify waste with your phone camera and verify local disposal rules.",
  manifest: "/manifest.json"
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Fredoka:wght@400;500;600;700&family=Luckiest+Guy&family=Noto+Sans+Devanagari:wght@400;600;700&family=Nunito:wght@400;500;600;700;800&display=swap" rel="stylesheet" />
        <meta name="theme-color" content="#4285F4" />
        <link rel="apple-touch-icon" href="/icon-192.png" />
      </head>
      <body className="antialiased">
        {children}
        <script
          dangerouslySetInnerHTML={{
            __html: `
              if ('serviceWorker' in navigator) {
                window.addEventListener('load', function() {
                  navigator.serviceWorker.register('/service-worker.js', { scope: '/' })
                    .then(function(reg) { console.log('[WasteWise SW] registered:', reg.scope); })
                    .catch(function(err) { console.warn('[WasteWise SW] failed:', err); });
                });
              }
            `
          }}
        />
      </body>
    </html>
  );
}
