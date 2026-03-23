import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import api from "../api";
import type { TaskType } from "../types";
import GlassCard from "./GlassCard";
import { useToast } from "./Toast";

interface TaskTypeManagerProps {
  projectId: number;
  taskTypes: TaskType[];
  onClose: () => void;
}

export default function TaskTypeManager({ projectId, taskTypes, onClose }: TaskTypeManagerProps) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [newTypeName, setNewTypeName] = useState("");

  const activeTypes = taskTypes.filter((tt) => tt.deletedAt == null);

  const createType = useMutation({
    mutationFn: (name: string) =>
      api.post(`/projects/${projectId}/task-types`, { name }).then((r) => r.data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["taskTypes", projectId] });
      setNewTypeName("");
      toast("Task type created", "success");
    },
    onError: (err) => {
      const msg =
        (err as { response?: { data?: { error?: string } } })?.response?.data?.error ??
        "Failed to create task type";
      toast(msg, "error");
    },
  });

  const deleteType = useMutation({
    mutationFn: (id: number) => api.delete(`/task-types/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["taskTypes", projectId] });
      toast("Task type deleted", "success");
    },
    onError: (err) => {
      const msg =
        (err as { response?: { data?: { error?: string } } })?.response?.data?.error ??
        "Failed to delete task type";
      toast(msg, "error");
    },
  });

  const handleCreate = () => {
    const name = newTypeName.trim();
    if (!name) return;
    const duplicate = activeTypes.find(
      (tt) => tt.name.toLowerCase() === name.toLowerCase()
    );
    if (duplicate) {
      toast("A type with that name already exists", "error");
      return;
    }
    createType.mutate(name);
  };

  return (
    <div className="modal-overlay" onClick={onClose} role="dialog" aria-modal="true" aria-label="Manage task types">
      <GlassCard className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-4)" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <h2 style={{ fontSize: "var(--font-size-xl)", fontWeight: "var(--font-weight-semibold)" }}>
              Manage Task Types
            </h2>
            <button className="btn btn-ghost btn-sm" onClick={onClose} type="button" aria-label="Close">
              &#10005;
            </button>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-2)" }}>
            {activeTypes.map((tt) => (
              <div
                key={tt.id}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  padding: "var(--space-2) var(--space-3)",
                  borderRadius: "8px",
                  background: "rgba(255,255,255,0.03)",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: "var(--space-2)" }}>
                  <span className="badge badge-accent">{tt.name}</span>
                </div>
                <button
                  className="btn btn-ghost btn-sm"
                  onClick={() => deleteType.mutate(tt.id)}
                  disabled={deleteType.isPending}
                  type="button"
                  aria-label={`Delete type ${tt.name}`}
                  style={{ color: "var(--color-danger)" }}
                >
                  &#10005;
                </button>
              </div>
            ))}

            {activeTypes.length === 0 && (
              <p style={{ color: "var(--color-text-muted)", fontSize: "var(--font-size-sm)" }}>
                No active task types
              </p>
            )}
          </div>

          <div style={{ display: "flex", gap: "var(--space-2)" }}>
            <input
              className="input"
              placeholder="New type name..."
              value={newTypeName}
              onChange={(e) => setNewTypeName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleCreate();
              }}
            />
            <button
              className="btn btn-primary"
              onClick={handleCreate}
              disabled={!newTypeName.trim() || createType.isPending}
              type="button"
            >
              Add
            </button>
          </div>
        </div>
      </GlassCard>
    </div>
  );
}
