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
      <body className="bg-[#F6F7F2] text-[#27372B] antialiased">{children}</body>
    </html>
  );
}
