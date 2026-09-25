import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Files",
  description: "Private file upload on Bunny.net",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="h-full">
      <body className="min-h-full bg-zinc-100 text-zinc-900 antialiased">
        {children}
      </body>
    </html>
  );
}
