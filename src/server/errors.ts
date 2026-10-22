/** Error de negocio con mensaje comprensible para el administrador. */
export class ActionError extends Error {
  constructor(
    message: string,
    public extra: { warnings?: string[]; needsConfirmation?: boolean; fieldErrors?: Record<string, string> } = {},
  ) {
    super(message);
  }
}
