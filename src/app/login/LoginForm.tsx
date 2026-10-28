"use client";

import { useActionState, useState } from "react";
import { loginAction } from "@/server/actions/auth";

const loginInputClass = "block w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-950 focus:border-blue-700 focus:outline-2 focus:outline-offset-2 focus:outline-blue-700";

export function LoginForm({ next }: { next?: string }) {
  const [state, action, pending] = useActionState(loginAction, undefined);
  // El correo se conserva tras un intento fallido (React restablece los campos no controlados).
  const [email, setEmail] = useState("");
  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="next" value={next ?? ""} />
      <div>
        <label htmlFor="email" className="mb-1 block text-xs font-semibold text-zinc-700">
          Correo electrónico
        </label>
        <input
          id="email"
          name="email"
          type="email"
          autoComplete="username"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className={loginInputClass}
        />
      </div>
      <div>
        <label htmlFor="password" className="mb-1 block text-xs font-semibold text-zinc-700">
          Contraseña
        </label>
        <input id="password" name="password" type="password" autoComplete="current-password" required className={loginInputClass} />
      </div>
      {state?.error && (
        <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-800 ring-1 ring-red-200">
          {state.error}
        </p>
      )}
      <button type="submit" disabled={pending} className="inline-flex min-h-11 w-full items-center justify-center rounded-lg bg-[#ff981f] px-4 py-2 text-sm font-bold text-[#102d50] transition-colors hover:bg-[#ffb451] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700 disabled:cursor-not-allowed disabled:opacity-50">
        {pending ? "Verificando…" : "Entrar"}
      </button>
    </form>
  );
}
