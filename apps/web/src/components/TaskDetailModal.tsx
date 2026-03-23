import { useState, useEffect } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import api from "../api";
import type { Task, TaskType, Subtask } from "../types";
import GlassCard from "./GlassCard";
import ConfirmDialog from "./ConfirmDialog";
import { useToast } from "./Toast";

interface TaskDetailModalProps {
  task: Task;
  boardId: number;
  taskTypes: TaskType[];
  allTaskTypes: TaskType[];
  onClose: () => void;
}

const RETRY_DELAYS = [1000, 2000, 3000];

async function withRetry<T>(fn: () => Promise<T>): Promise<T> {
  let lastError: unknown;
  for (let attempt = 0; attempt <= RETRY_DELAYS.length; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err;
      if (attempt < RETRY_DELAYS.length) {
        await new Promise((r) => setTimeout(r, RETRY_DELAYS[attempt]));
      }
    }
  }
  throw lastError;
}

export default function TaskDetailModal({
  task,
  boardId,
  taskTypes,
  allTaskTypes,
  onClose,
}: TaskDetailModalProps) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const lanesKey = ["lanes", boardId];

  const [title, setTitle] = useState(task.title);
  const [description, setDescription] = useState(task.description ?? "");
  const [typeId, setTypeId] = useState(task.typeId);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [newSubtaskTitle, setNewSubtaskTitle] = useState("");

  useEffect(() => {
    setTitle(task.title);
    setDescription(task.description ?? "");
    setTypeId(task.typeId);
  }, [task]);

  const updateTask = useMutation({
    mutationFn: (data: { title?: string; description?: string; typeId?: number }) =>
      withRetry(() => api.put(`/tasks/${task.id}`, data).then((r) => r.data)),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: lanesKey });
    },
    onError: () => toast("Failed to update task after retries", "error"),
  });

  const deleteTask = useMutation({
    mutationFn: () =>
      withRetry(() => api.delete(`/tasks/${task.id}`)),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: lanesKey });
      toast("Task deleted", "success");
      onClose();
    },
    onError: () => toast("Failed to delete task after retries", "error"),
  });

  const addSubtask = useMutation({
    mutationFn: (subtaskTitle: string) =>
      withRetry(() =>
        api.post(`/tasks/${task.id}/subtasks`, { title: subtaskTitle }).then((r) => r.data)
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: lanesKey });
      setNewSubtaskTitle("");
    },
    onError: () => toast("Failed to add subtask", "error"),
  });

  const toggleSubtask = useMutation({
    mutationFn: (subtask: Subtask) =>
      withRetry(() =>
        api.patch(`/tasks/${task.id}/subtasks/${subtask.id}`).then((r) => r.data)
      ),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: lanesKey }),
    onError: () => toast("Failed to toggle subtask", "error"),
  });

  const deleteSubtask = useMutation({
    mutationFn: (sid: number) =>
      withRetry(() => api.delete(`/tasks/${task.id}/subtasks/${sid}`)),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: lanesKey }),
    onError: () => toast("Failed to delete subtask", "error"),
  });

  const handleSave = () => {
    const updates: { title?: string; description?: string; typeId?: number } = {};
    if (title.trim() !== task.title) updates.title = title.trim();
    if (description !== (task.description ?? "")) updates.description = description;
    if (typeId !== task.typeId) updates.typeId = typeId;
    if (Object.keys(updates).length > 0) {
      updateTask.mutate(updates);
    }
  };

  const handleAddSubtask = () => {
    const t = newSubtaskTitle.trim();
    if (!t) return;
    addSubtask.mutate(t);
  };

  const currentType = allTaskTypes.find((tt) => tt.id === task.typeId);
  const isLegacy = currentType?.deletedAt != null;

  const typeOptions = taskTypes.filter((tt) => tt.deletedAt == null);
  if (isLegacy && currentType && !typeOptions.find((tt) => tt.id === currentType.id)) {
    typeOptions.unshift(currentType);
  }

  return (
    <>
      <div
        className="modal-overlay"
        onClick={onClose}
        role="dialog"
        aria-modal="true"
        aria-label="Task details"
      >
        <GlassCard
          className="modal-content"
          onClick={(e) => e.stopPropagation()}
        >
          <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-4)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
              <h2 style={{ fontSize: "var(--font-size-xl)", fontWeight: "var(--font-weight-semibold)" }}>
                Edit Task
              </h2>
              <button className="btn btn-ghost btn-sm" onClick={onClose} type="button" aria-label="Close">
                &#10005;
              </button>
            </div>

            <div>
              <label
                htmlFor="task-title"
                style={{ display: "block", fontSize: "var(--font-size-sm)", color: "var(--color-text-secondary)", marginBottom: "var(--space-1)" }}
              >
                Title
              </label>
              <input
                id="task-title"
                className="input"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                onBlur={handleSave}
              />
            </div>

            <div>
              <label
                htmlFor="task-description"
                style={{ display: "block", fontSize: "var(--font-size-sm)", color: "var(--color-text-secondary)", marginBottom: "var(--space-1)" }}
              >
                Description
              </label>
              <textarea
                id="task-description"
                className="input"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                onBlur={handleSave}
                rows={4}
              />
            </div>

            <div>
              <label
                htmlFor="task-type"
                style={{ display: "block", fontSize: "var(--font-size-sm)", color: "var(--color-text-secondary)", marginBottom: "var(--space-1)" }}
              >
                Type {isLegacy && <span className="badge badge-legacy" style={{ marginLeft: "var(--space-2)" }}>legacy</span>}
              </label>
              <select
                id="task-type"
                className="input"
                value={typeId}
                onChange={(e) => {
                  const newTypeId = Number(e.target.value);
                  setTypeId(newTypeId);
                  updateTask.mutate({ typeId: newTypeId });
                }}
              >
                {typeOptions.map((tt) => (
                  <option key={tt.id} value={tt.id}>
                    {tt.name}{tt.deletedAt ? " (legacy)" : ""}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <h3 style={{ fontSize: "var(--font-size-sm)", fontWeight: "var(--font-weight-semibold)", marginBottom: "var(--space-2)" }}>
                Subtasks ({task.subtasks.filter((s) => s.completed).length}/{task.subtasks.length})
              </h3>
              <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-2)" }}>
                {task.subtasks.map((subtask) => (
                  <div
                    key={subtask.id}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "var(--space-2)",
                      padding: "var(--space-2)",
                      borderRadius: "6px",
                      background: "rgba(255,255,255,0.03)",
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={subtask.completed}
                      onChange={() => toggleSubtask.mutate(subtask)}
                      aria-label={`Toggle subtask: ${subtask.title}`}
                      style={{ accentColor: "var(--color-accent)", flexShrink: 0 }}
                    />
                    <span
                      style={{
                        flex: 1,
                        fontSize: "var(--font-size-sm)",
                        textDecoration: subtask.completed ? "line-through" : "none",
                        color: subtask.completed ? "var(--color-text-muted)" : "var(--color-text)",
                      }}
                    >
                      {subtask.title}
                    </span>
                    <button
                      className="btn btn-ghost btn-sm"
                      onClick={() => deleteSubtask.mutate(subtask.id)}
                      type="button"
                      aria-label={`Delete subtask: ${subtask.title}`}
                      style={{ color: "var(--color-danger)", padding: "2px 4px" }}
                    >
                      &#10005;
                    </button>
                  </div>
                ))}

                <div style={{ display: "flex", gap: "var(--space-2)", marginTop: "var(--space-1)" }}>
                  <input
                    className="input"
                    placeholder="Add subtask..."
                    value={newSubtaskTitle}
                    onChange={(e) => setNewSubtaskTitle(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") handleAddSubtask();
                    }}
                    style={{ fontSize: "var(--font-size-sm)" }}
                  />
                  <button
                    className="btn btn-primary btn-sm"
                    onClick={handleAddSubtask}
                    disabled={!newSubtaskTitle.trim() || addSubtask.isPending}
                    type="button"
                  >
                    Add
                  </button>
                </div>
              </div>
            </div>

            <div style={{ borderTop: "1px solid var(--color-border)", paddingTop: "var(--space-4)" }}>
              <button
                className="btn btn-danger btn-sm"
                onClick={() => setConfirmDelete(true)}
                disabled={deleteTask.isPending}
                type="button"
              >
                Delete Task
              </button>
            </div>
          </div>
        </GlassCard>
      </div>

      {confirmDelete && (
        <ConfirmDialog
          message={`Delete task "${task.title}"? This cannot be undone.`}
          onConfirm={() => {
            deleteTask.mutate();
            setConfirmDelete(false);
          }}
          onCancel={() => setConfirmDelete(false)}
        />
      )}
    </>
  );
}
