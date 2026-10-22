import Link from "next/link";

export default function NotFound() {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-3 p-6 text-center">
      <p className="font-display text-5xl text-brand-700">404</p>
      <h1 className="text-lg font-bold">Página no encontrada</h1>
      <Link href="/" className="text-sm font-semibold text-brand-700 hover:underline">
        Volver al dashboard
      </Link>
    </main>
  );
}
