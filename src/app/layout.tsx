import type { Metadata, Viewport } from "next";
import { Audiowide, Montserrat } from "next/font/google";
import { Toaster } from "sonner";
import "./globals.css";

const montserrat = Montserrat({ variable: "--font-montserrat", subsets: ["latin"], display: "swap" });
const audiowide = Audiowide({ variable: "--font-audiowide", subsets: ["latin"], weight: "400", display: "swap" });

export const metadata: Metadata = {
  title: { default: "Starfutbol · Panel administrativo", template: "%s · Starfutbol" },
  description: "Administración de torneos de futbol 7 de Starfutbol",
  icons: { icon: "/favicon.ico" },
  robots: { index: false, follow: false },
};

export const viewport: Viewport = { themeColor: "#b30f16", width: "device-width", initialScale: 1 };

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="es">
      <body className={`${montserrat.variable} ${audiowide.variable} font-sans antialiased`}>
        {children}
        <Toaster richColors position="top-right" closeButton />
      </body>
    </html>
  );
}
