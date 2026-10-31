import Image from "next/image";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/server/auth";
import { LoginForm } from "./LoginForm";

export const metadata = { title: "Iniciar sesión" };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  if (await getCurrentUser()) redirect("/");
  const { next } = await searchParams;
  return (
    <main className="relative flex min-h-dvh items-center justify-center bg-white px-4 py-10">
      <div className="brand-stripe absolute inset-x-0 top-0 h-1.5" />
      <div className="w-full max-w-sm">
        <div className="mb-6 flex flex-col items-center text-center">
          <Image src="/brand/logo.png" alt="Starfutbol" width={260} height={113} priority className="h-auto w-56" />
          <p className="font-display mt-3 text-sm tracking-[0.3em] text-brand-700">PANEL ADMINISTRATIVO</p>
        </div>
        <div className="rounded-2xl bg-white p-6 shadow-lg ring-1 ring-zinc-200">
          <h1 className="text-lg font-extrabold text-zinc-900">Iniciar sesión</h1>
          <p className="mb-4 text-sm text-zinc-500">Acceso exclusivo para administradores autorizados.</p>
          <LoginForm next={next} />
        </div>
        <p className="mt-6 text-center text-xs text-zinc-400">Starfutbol · Liga de futbol 7</p>
      </div>
    </main>
  );
}
