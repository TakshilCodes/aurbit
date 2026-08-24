import type { Metadata } from "next";
import "@repo/ui/styles.css";

export const metadata: Metadata = {
  title: "Aurbit Admin",
  description: "The Aurbit customer dashboard.",
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
