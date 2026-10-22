"use client";

export default function PanelError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="mx-auto max-w-lg rounded-xl bg-white p-6 text-center shadow-sm ring-1 ring-zinc-200">
      <h1 className="text-lg font-bold text-zinc-900">No se pudo cargar esta sección</h1>
      <p className="mt-2 text-sm text-zinc-600">Ocurrió un error inesperado. Los datos guardados no se modificaron.</p>
      {error.digest && <p className="mt-1 text-xs text-zinc-400">Referencia: {error.digest}</p>}
      <button onClick={reset} className="mt-4 rounded-lg bg-brand-700 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-800">
        Reintentar
      </button>
    </div>
  );
}
