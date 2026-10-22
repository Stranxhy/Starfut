"use client";

import { ConfirmAction, ModalButton, type ServerAction } from "@/components/ui/form";
import { MatchForm, type MatchFormProps } from "./MatchForm";

export function MatchActionsBar({
  matchId,
  status,
  hasResult,
  isPlayoff,
  cancelAction,
  reschedule,
}: {
  matchId: string;
  status: string;
  hasResult: boolean;
  isPlayoff: boolean;
  cancelAction: ServerAction;
  reschedule?: Omit<MatchFormProps, "mode">;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {reschedule && (
        <ModalButton
          label={status === "CANCELADO" ? "Reprogramar (reactivar)" : "Reprogramar"}
          title="Reprogramar partido"
          description="Elige la nueva fecha, horario y cancha. El cambio queda registrado con su motivo."
          variant="secondary"
          size="sm"
          wide
        >
          {() => <MatchForm {...reschedule} mode="reschedule" teamsEditable={false} />}
        </ModalButton>
      )}
      {status !== "CANCELADO" && !hasResult && !isPlayoff && (
        <ConfirmAction
          action={cancelAction}
          hidden={{ id: matchId }}
          label="Cancelar partido"
          title="Cancelar partido"
          description="El partido conserva su historial y no genera puntos. El espacio quedará libre para programar una sustitución."
          reason="required"
          confirmLabel="Cancelar partido"
          successMessage="Partido cancelado."
        />
      )}
    </div>
  );
}
