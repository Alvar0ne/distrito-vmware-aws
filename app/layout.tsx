import type { Metadata } from "next";
import { SiteVisitTracker } from "@/components/SiteVisitTracker";
import "./globals.css";

export const metadata: Metadata = {
  title: "Distrito Miami",
  description: "Ropa y accesorios originales importados desde Estados Unidos.",
  icons: {
    icon: [
      {
        url: "/distrito-miami-logo.png",
        type: "image/png"
      }
    ],
    apple: [
      {
        url: "/distrito-miami-logo.png",
        type: "image/png"
      }
    ]
  }
};

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es">
      <body>
        <SiteVisitTracker />
        {children}
      </body>
    </html>
  );
}
