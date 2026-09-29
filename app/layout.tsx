import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "SCORECRAFT | Product Design & Market Driven Innovation",
  description: "2-Day workshop by the School of Computing, KARE.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
