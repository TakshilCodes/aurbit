import type { Metadata } from "next";
import "@aurbit/ui/styles.css";

export const metadata: Metadata = {
  title: "Aurbit",
  description: "Bug reporting for modern product teams.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
