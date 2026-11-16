import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "File Sorter",
  description: "Sort files in a folder by extension into capitalized folders",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="min-h-screen antialiased">{children}</body>
    </html>
  );
}