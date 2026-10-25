"use client";

import type { ComponentProps } from "react";

/** Select que envía su formulario al cambiar (sin botón "Aplicar"). */
export function AutoSubmitSelect(props: ComponentProps<"select">) {
  return <select {...props} onChange={(e) => e.currentTarget.form?.requestSubmit()} />;
}
