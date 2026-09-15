import type { Metadata } from "next";
import { env } from "@/env";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL(env.NEXT_PUBLIC_SITE_URL),
  title: "Kenya Rental PMS",
  description: "Rental management for Kenyan landlords — M-Pesa rent collection, KRA-compliant receipts.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
