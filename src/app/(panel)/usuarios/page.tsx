import { prisma } from "@/lib/prisma";
import { requireUser } from "@/server/auth";
import { changeOwnPasswordAction, createUserAction, resetPasswordAction, setUserActiveAction } from "@/server/actions/users";
import { UserCreateButton, OwnPasswordForm, ResetPasswordButton } from "@/components/forms/user-forms";
import { SimpleToggleForm } from "@/components/forms/entity-forms";
import { Alert, Badge, Card, CardHeader, LinkButton, PageHeader, Table, TD, TH } from "@/components/ui/core";
import { formatDateTime } from "@/lib/dates";
import { ROLE } from "@/lib/labels";

export const metadata = { title: "Usuarios y respaldos" };

export default async function UsuariosPage() {
  const me = await requireUser();
  const users = await prisma.user.findMany({ orderBy: [{ active: "desc" }, { name: "asc" }] });
  const isAdmin = me.role === "ADMIN";
  return (
    <>
      <PageHeader
        title="Usuarios y respaldos"
        actions={isAdmin ? <UserCreateButton action={createUserAction} /> : undefined}
      />
      <Card>
        <Table>
          <thead><tr><TH>Nombre</TH><TH>Correo</TH><TH>Rol</TH><TH>Último acceso</TH><TH>Estado</TH><TH className="text-right">Acciones</TH></tr></thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id}>
                <TD className="font-semibold">{u.name}{u.id === me.id && <Badge className="ml-2">tú</Badge>}</TD>
                <TD>{u.email}</TD>
                <TD>{ROLE[u.role]}</TD>
                <TD className="text-zinc-500">{u.lastLoginAt ? formatDateTime(u.lastLoginAt) : "—"}</TD>
                <TD>{u.active ? <Badge className="bg-emerald-100 text-emerald-900 ring-emerald-300">Activo</Badge> : <Badge>Inactivo</Badge>}</TD>
                <TD>
                  {isAdmin && (
                    <div className="flex justify-end gap-2">
                      <ResetPasswordButton action={resetPasswordAction} userId={u.id} name={u.name} />
                      {u.id !== me.id && <SimpleToggleForm action={setUserActiveAction} hidden={{ id: u.id, active: u.active ? "0" : "1" }} label={u.active ? "Desactivar" : "Activar"} variant={u.active ? "danger" : "secondary"} />}
                    </div>
                  )}
                </TD>
              </tr>
            ))}
          </tbody>
        </Table>
      </Card>

      <div className="mt-5 grid gap-5 xl:grid-cols-2">
        <Card>
          <CardHeader title="Cambiar mi contraseña" description="Mínimo 10 caracteres, con letras y números." />
          <div className="px-4 py-4 sm:px-5">
            <OwnPasswordForm action={changeOwnPasswordAction} />
          </div>
        </Card>
        <Card>
          <CardHeader title="Copias de seguridad" />
          <div className="space-y-3 px-5 py-4 text-sm text-zinc-700">
            <p>
              <strong>Respaldo completo (recomendado):</strong> ejecuta <code className="rounded bg-zinc-100 px-1">npm run db:backup</code> en el servidor. Genera un archivo
              <code className="rounded bg-zinc-100 px-1">.dump</code> de PostgreSQL en la carpeta <code className="rounded bg-zinc-100 px-1">backups/</code>. Para restaurar:
              <code className="rounded bg-zinc-100 px-1">npm run db:restore -- backups/archivo.dump</code>. Consulta el manual (docs/RESPALDOS.md).
            </p>
            <p><strong>Respaldo lógico descargable:</strong> exporta todos los registros en JSON (sin contraseñas ni escudos) para conservar una copia externa.</p>
            {isAdmin ? <LinkButton href="/api/respaldo" variant="secondary">Descargar respaldo JSON</LinkButton> : <Alert tone="info">Solo un administrador puede descargar respaldos.</Alert>}
          </div>
        </Card>
      </div>
    </>
  );
}
