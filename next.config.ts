import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // @react-pdf/renderer se ejecuta en Node sin empaquetar (generación de PDF en /api/pdf).
  serverExternalPackages: ["@react-pdf/renderer"],
  // Evita que Next tome como raíz un package-lock.json de una carpeta superior.
  outputFileTracingRoot: process.cwd(),
  poweredByHeader: false,
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "same-origin" },
        ],
      },
    ];
  },
};

export default nextConfig;
