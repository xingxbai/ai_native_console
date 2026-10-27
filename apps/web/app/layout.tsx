import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "AI Native Console",
  description: "AI Native Console learning workspace",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  );
}
