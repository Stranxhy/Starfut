import Image from "next/image";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/server/auth";
import { LoginForm } from "./LoginForm";

export const metadata = { title: "Iniciar sesión" };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  if (await getCurrentUser()) redirect("/");
  const { next } = await searchParams;
  return (
    <main className="bg-sport flex min-h-dvh items-center justify-center px-4 py-10">
      <div className="w-full max-w-sm">
        <div className="mb-6 flex flex-col items-center text-center">
          <Image src="/brand/logo.png" alt="Starfutbol" width={260} height={113} priority className="h-auto w-56 drop-shadow-lg" />
          <p className="font-display mt-3 text-sm tracking-[0.3em] text-white/80">PANEL ADMINISTRATIVO</p>
        </div>
        <div className="rounded-2xl bg-white p-6 shadow-2xl">
          <h1 className="text-lg font-extrabold text-zinc-900">Iniciar sesión</h1>
          <p className="mb-4 text-sm text-zinc-500">Acceso exclusivo para administradores autorizados.</p>
          <LoginForm next={next} />
        </div>
        <p className="mt-6 text-center text-xs text-white/50">Starfutbol · Liga de futbol 7</p>
      </div>
    </main>
  );
}
