import { useState } from "react";
import type { Scenario, ScenarioInput } from "../lib/types";
import { ScenarioCard } from "../components/scenario/ScenarioCard";
import { ScenarioForm } from "../components/scenario/ScenarioForm";
import { Button } from "../components/ui/Button";
import { EmptyState } from "../components/ui/EmptyState";
import { Modal } from "../components/ui/Modal";
import { Panel } from "../components/ui/Panel";

interface ScenariosPageProps {
  scenarios: Scenario[];
  loading: boolean;
  busy: boolean;
  onCreate: (input: ScenarioInput) => Promise<void>;
  onUpdate: (id: string, input: ScenarioInput) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  onRun: (scenario: Scenario) => void;
}

export function ScenariosPage({ scenarios, loading, busy, onCreate, onUpdate, onDelete, onRun }: ScenariosPageProps) {
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Scenario | null>(null);
  const [deleting, setDeleting] = useState<Scenario | null>(null);

  const openCreate = () => {
    setEditing(null);
    setFormOpen(true);
  };

  const openEdit = (scenario: Scenario) => {
    setEditing(scenario);
    setFormOpen(true);
  };

  const handleDelete = async () => {
    if (!deleting) return;
    await onDelete(deleting.id);
    setDeleting(null);
  };

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm text-sky/55">
            {loading ? "Cargando escenarios…" : `${scenarios.length} escenario${scenarios.length === 1 ? "" : "s"} configurado${scenarios.length === 1 ? "" : "s"}`}
          </p>
          <p className="text-xs text-sky/35">Define el destino, el modelo de carga y los umbrales de aceptación.</p>
        </div>
        <Button variant="primary" onClick={openCreate} disabled={busy}>
          + Nuevo escenario
        </Button>
      </div>

      {!loading && scenarios.length === 0 ? (
        <Panel>
          <EmptyState
            icon="⬡"
            title="Crea tu primer escenario"
            description="Apunta a cualquier URL — pública o de tu red interna —, define cuánta carga aplicar y lanza la prueba desde el tablero."
            action={
              <Button variant="primary" onClick={openCreate}>
                Crear escenario
              </Button>
            }
          />
        </Panel>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2 2xl:grid-cols-3">
          {scenarios.map((scenario) => (
            <ScenarioCard
              key={scenario.id}
              scenario={scenario}
              disabled={busy}
              onRun={onRun}
              onEdit={openEdit}
              onDelete={setDeleting}
            />
          ))}
        </div>
      )}

      <ScenarioForm
        open={formOpen}
        initial={editing}
        onClose={() => setFormOpen(false)}
        onSubmit={editing ? (input) => onUpdate(editing.id, input) : onCreate}
      />

      <Modal
        open={deleting !== null}
        title="Eliminar escenario"
        onClose={() => setDeleting(null)}
        footer={
          <>
            <Button variant="quiet" onClick={() => setDeleting(null)}>
              Cancelar
            </Button>
            <Button variant="danger" onClick={handleDelete}>
              Eliminar
            </Button>
          </>
        }
      >
        <p className="text-sm text-sky/70">
          Se eliminará <span className="font-semibold text-sky/90">{deleting?.name}</span> de forma permanente. El
          historial de corridas ya ejecutadas se conserva.
        </p>
      </Modal>
    </div>
  );
}
