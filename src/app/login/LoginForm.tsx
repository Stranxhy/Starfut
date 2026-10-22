"use client";

import { useActionState, useState } from "react";
import { loginAction } from "@/server/actions/auth";
import { buttonClass, inputClass } from "@/components/ui/core";

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
          className={inputClass}
        />
      </div>
      <div>
        <label htmlFor="password" className="mb-1 block text-xs font-semibold text-zinc-700">
          Contraseña
        </label>
        <input id="password" name="password" type="password" autoComplete="current-password" required className={inputClass} />
      </div>
      {state?.error && (
        <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-800 ring-1 ring-red-200">
          {state.error}
        </p>
      )}
      <button type="submit" disabled={pending} className={buttonClass("primary", "md", "w-full")}>
        {pending ? "Verificando…" : "Entrar"}
      </button>
    </form>
  );
}
