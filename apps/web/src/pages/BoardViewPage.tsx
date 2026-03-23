import { useState, useCallback, useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  DndContext,
  DragOverlay,
  closestCorners,
  PointerSensor,
  useSensor,
  useSensors,
  type DragStartEvent,
  type DragEndEvent,
  type DragOverEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { useDroppable } from "@dnd-kit/core";
import api from "../api";
import type { Board, Lane, Task, TaskType } from "../types";
import GlassCard from "../components/GlassCard";
import TaskCard from "../components/TaskCard";
import TaskDetailModal from "../components/TaskDetailModal";
import TaskTypeManager from "../components/TaskTypeManager";
import { useToast } from "../components/Toast";

export default function BoardViewPage() {
  const { id: projectId, boardId } = useParams<{ id: string; boardId: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const pid = Number(projectId);
  const bid = Number(boardId);
  const lanesKey = useMemo(() => ["lanes", bid], [bid]);

  const { data: board } = useQuery<Board>({
    queryKey: ["board", bid],
    queryFn: () => api.get(`/boards/${bid}`).then((r) => r.data),
  });

  const { data: lanes = [], isLoading: lanesLoading } = useQuery<Lane[]>({
    queryKey: lanesKey,
    queryFn: () => api.get(`/boards/${bid}/lanes`).then((r) => r.data),
  });

  const { data: taskTypes = [] } = useQuery<TaskType[]>({
    queryKey: ["taskTypes", pid],
    queryFn: () => api.get(`/projects/${pid}/task-types`).then((r) => r.data),
  });

  const allTaskTypes = useMemo(() => {
    const typeMap = new Map<number, TaskType>();
    taskTypes.forEach((tt) => typeMap.set(tt.id, tt));
    lanes.forEach((lane) =>
      lane.tasks.forEach((task) => {
        if (!typeMap.has(task.type.id)) {
          typeMap.set(task.type.id, task.type);
        }
      })
    );
    return Array.from(typeMap.values());
  }, [taskTypes, lanes]);

  const activeTaskTypes = useMemo(
    () => taskTypes.filter((tt) => tt.deletedAt == null),
    [taskTypes]
  );

  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [showTypeManager, setShowTypeManager] = useState(false);
  const [activeId, setActiveId] = useState<string | null>(null);

  const activeTask = useMemo(() => {
    if (!activeId) return null;
    const taskId = Number(activeId.replace("task-", ""));
    for (const lane of lanes) {
      const found = lane.tasks.find((t) => t.id === taskId);
      if (found) return found;
    }
    return null;
  }, [activeId, lanes]);

  // DnD sensors
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } })
  );

  // DnD move mutation
  const moveTask = useMutation({
    mutationFn: (data: { taskId: number; laneId: number; order: number }) =>
      api.patch(`/tasks/${data.taskId}/move`, { laneId: data.laneId, order: data.order }),
    onError: (_err, _vars, context) => {
      if (context) {
        queryClient.setQueryData(lanesKey, context);
      }
      toast("Failed to move task", "error");
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: lanesKey }),
  });

  const handleDragStart = useCallback((event: DragStartEvent) => {
    setActiveId(event.active.id as string);
  }, []);

  const handleDragOver = useCallback(
    (event: DragOverEvent) => {
      const { active, over } = event;
      if (!over) return;

      const activeIdStr = active.id as string;
      const overIdStr = over.id as string;

      if (activeIdStr === overIdStr) return;

      const activeTaskId = Number(activeIdStr.replace("task-", ""));

      queryClient.setQueryData<Lane[]>(lanesKey, (oldLanes) => {
        if (!oldLanes) return oldLanes;

        let sourceLaneIdx = -1;
        let sourceTaskIdx = -1;

        for (let i = 0; i < oldLanes.length; i++) {
          const tIdx = oldLanes[i].tasks.findIndex((t) => t.id === activeTaskId);
          if (tIdx !== -1) {
            sourceLaneIdx = i;
            sourceTaskIdx = tIdx;
            break;
          }
        }

        if (sourceLaneIdx === -1) return oldLanes;

        let destLaneIdx = -1;
        let destTaskIdx = -1;

        if (overIdStr.startsWith("task-")) {
          const overTaskId = Number(overIdStr.replace("task-", ""));
          for (let i = 0; i < oldLanes.length; i++) {
            const tIdx = oldLanes[i].tasks.findIndex((t) => t.id === overTaskId);
            if (tIdx !== -1) {
              destLaneIdx = i;
              destTaskIdx = tIdx;
              break;
            }
          }
        } else if (overIdStr.startsWith("lane-")) {
          const overLaneId = Number(overIdStr.replace("lane-", ""));
          destLaneIdx = oldLanes.findIndex((l) => l.id === overLaneId);
          if (destLaneIdx !== -1) {
            destTaskIdx = oldLanes[destLaneIdx].tasks.length;
          }
        }

        if (destLaneIdx === -1) return oldLanes;
        if (sourceLaneIdx === destLaneIdx && sourceTaskIdx === destTaskIdx) return oldLanes;

        const newLanes = oldLanes.map((l) => ({ ...l, tasks: [...l.tasks] }));
        const [movedTask] = newLanes[sourceLaneIdx].tasks.splice(sourceTaskIdx, 1);
        const adjustedTask = { ...movedTask, laneId: newLanes[destLaneIdx].id };

        if (sourceLaneIdx === destLaneIdx && sourceTaskIdx < destTaskIdx) {
          destTaskIdx = Math.max(0, destTaskIdx - 1);
        }
        newLanes[destLaneIdx].tasks.splice(destTaskIdx, 0, adjustedTask);

        return newLanes;
      });
    },
    [lanesKey, queryClient]
  );

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      setActiveId(null);

      const { active, over } = event;
      if (!over) return;

      const activeIdStr = active.id as string;
      const activeTaskId = Number(activeIdStr.replace("task-", ""));

      const currentLanes = queryClient.getQueryData<Lane[]>(lanesKey);
      if (!currentLanes) return;

      let targetLaneId: number | null = null;
      let targetOrder = 0;

      for (const lane of currentLanes) {
        const idx = lane.tasks.findIndex((t) => t.id === activeTaskId);
        if (idx !== -1) {
          targetLaneId = lane.id;
          targetOrder = idx;
          break;
        }
      }

      if (targetLaneId == null) return;

      const origTask = lanes
        .flatMap((l) => l.tasks)
        .find((t) => t.id === activeTaskId);

      if (origTask && origTask.laneId === targetLaneId && origTask.order === targetOrder) {
        return;
      }

      const prevLanes = lanes;

      moveTask.mutate(
        { taskId: activeTaskId, laneId: targetLaneId, order: targetOrder },
        {
          onError: () => {
            queryClient.setQueryData(lanesKey, prevLanes);
          },
        }
      );
    },
    [lanesKey, queryClient, lanes, moveTask]
  );

  if (lanesLoading) {
    return (
      <div className="page-container">
        <p style={{ color: "var(--color-text-secondary)" }}>Loading board...</p>
      </div>
    );
  }

  return (
    <div style={{ padding: "var(--space-4)", minHeight: "100vh" }}>
      <div className="page-header">
        <div style={{ display: "flex", alignItems: "center", gap: "var(--space-3)" }}>
          <button
            className="btn btn-ghost"
            onClick={() => navigate("/")}
            type="button"
            aria-label="Back to projects"
          >
            &#8592; Back
          </button>
          <h1 className="page-title">{board?.name ?? "Board"}</h1>
        </div>
        <div style={{ display: "flex", gap: "var(--space-2)" }}>
          <button
            className="btn btn-ghost"
            onClick={() => setShowTypeManager(true)}
            type="button"
          >
            Manage Types
          </button>
          <AddLaneButton boardId={bid} />
        </div>
      </div>

      {lanes.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon" aria-hidden="true">&#128466;</div>
          <p className="empty-state-text">No lanes yet. Add a lane to get started.</p>
        </div>
      ) : (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCorners}
          onDragStart={handleDragStart}
          onDragOver={handleDragOver}
          onDragEnd={handleDragEnd}
        >
          <div className="board-lanes">
            {lanes.map((lane) => (
              <LaneColumn
                key={lane.id}
                lane={lane}
                boardId={bid}
                taskTypes={activeTaskTypes}
                isDragDisabled={moveTask.isPending || lanesLoading}
                onTaskClick={setSelectedTask}
              />
            ))}
          </div>
          <DragOverlay>
            {activeTask ? (
              <div style={{ width: "var(--lane-width)", opacity: 0.9 }}>
                <TaskCard task={activeTask} onClick={() => {}} isDragDisabled />
              </div>
            ) : null}
          </DragOverlay>
        </DndContext>
      )}

      {selectedTask && (
        <TaskDetailModal
          task={selectedTask}
          boardId={bid}
          taskTypes={activeTaskTypes}
          allTaskTypes={allTaskTypes}
          onClose={() => setSelectedTask(null)}
        />
      )}

      {showTypeManager && (
        <TaskTypeManager
          projectId={pid}
          taskTypes={allTaskTypes}
          onClose={() => setShowTypeManager(false)}
        />
      )}
    </div>
  );
}

// --- Lane Column ---
interface LaneColumnProps {
  lane: Lane;
  boardId: number;
  taskTypes: TaskType[];
  isDragDisabled: boolean;
  onTaskClick: (task: Task) => void;
}

function LaneColumn({ lane, boardId, taskTypes, isDragDisabled, onTaskClick }: LaneColumnProps) {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const [showMenu, setShowMenu] = useState(false);
  const [isRenaming, setIsRenaming] = useState(false);
  const [renameName, setRenameName] = useState(lane.name);
  const [showQuickCreate, setShowQuickCreate] = useState(false);
  const [newTaskTitle, setNewTaskTitle] = useState("");
  const [newTaskTypeId, setNewTaskTypeId] = useState<number>(taskTypes[0]?.id ?? 0);

  const lanesKey = ["lanes", boardId];

  const { setNodeRef } = useDroppable({
    id: `lane-${lane.id}`,
    data: { type: "lane", laneId: lane.id },
  });

  const renameLane = useMutation({
    mutationFn: (name: string) => api.put(`/lanes/${lane.id}`, { name }).then((r) => r.data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: lanesKey });
      setIsRenaming(false);
    },
    onError: () => toast("Failed to rename lane", "error"),
  });

  const deleteLane = useMutation({
    mutationFn: () => api.delete(`/lanes/${lane.id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: lanesKey });
      toast("Lane deleted", "success");
    },
    onError: (err) => {
      const msg =
        (err as { response?: { data?: { error?: string } } })?.response?.data?.error ??
        "Failed to delete lane";
      toast(msg, "error");
    },
  });

  const createTask = useMutation({
    mutationFn: (data: { title: string; laneId: number; typeId: number }) =>
      api.post(`/boards/${boardId}/tasks`, data).then((r) => r.data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: lanesKey });
      setNewTaskTitle("");
      setShowQuickCreate(false);
    },
    onError: () => toast("Failed to create task", "error"),
  });

  const handleRename = () => {
    const name = renameName.trim();
    if (!name || name === lane.name) {
      setIsRenaming(false);
      setRenameName(lane.name);
      return;
    }
    renameLane.mutate(name);
  };

  const handleCreateTask = () => {
    const title = newTaskTitle.trim();
    if (!title || !newTaskTypeId) return;
    createTask.mutate({ title, laneId: lane.id, typeId: newTaskTypeId });
  };

  const taskIds = lane.tasks.map((t) => `task-${t.id}`);

  return (
    <div className="lane">
      <GlassCard style={{ display: "flex", flexDirection: "column", flex: 1 }}>
        {/* Lane Header */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "var(--space-3) var(--space-3) 0",
            gap: "var(--space-2)",
            position: "relative",
          }}
        >
          {isRenaming ? (
            <input
              className="input"
              value={renameName}
              onChange={(e) => setRenameName(e.target.value)}
              onBlur={handleRename}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleRename();
                if (e.key === "Escape") {
                  setIsRenaming(false);
                  setRenameName(lane.name);
                }
              }}
              autoFocus
              style={{ fontSize: "var(--font-size-sm)" }}
            />
          ) : (
            <h3
              style={{
                fontSize: "var(--font-size-sm)",
                fontWeight: "var(--font-weight-semibold)",
                textTransform: "uppercase",
                letterSpacing: "0.05em",
                color: "var(--color-text-secondary)",
                flex: 1,
              }}
              className="truncate"
            >
              {lane.name}
              <span
                style={{
                  marginLeft: "var(--space-2)",
                  fontSize: "var(--font-size-xs)",
                  color: "var(--color-text-muted)",
                }}
              >
                {lane.tasks.length}
              </span>
            </h3>
          )}
          <div style={{ position: "relative" }}>
            <button
              className="btn btn-ghost btn-icon btn-sm"
              onClick={() => setShowMenu(!showMenu)}
              type="button"
              aria-label="Lane menu"
              style={{ fontSize: "var(--font-size-base)" }}
            >
              &#8942;
            </button>
            {showMenu && (
              <div
                className="glass-card"
                style={{
                  position: "absolute",
                  top: "100%",
                  right: 0,
                  zIndex: 50,
                  minWidth: "140px",
                  padding: "var(--space-1)",
                  display: "flex",
                  flexDirection: "column",
                }}
              >
                <button
                  className="btn btn-ghost btn-sm"
                  style={{ justifyContent: "flex-start" }}
                  onClick={() => {
                    setRenameName(lane.name);
                    setIsRenaming(true);
                    setShowMenu(false);
                  }}
                  type="button"
                >
                  Rename
                </button>
                <button
                  className="btn btn-ghost btn-sm"
                  style={{ justifyContent: "flex-start", color: "var(--color-danger)" }}
                  onClick={() => {
                    deleteLane.mutate();
                    setShowMenu(false);
                  }}
                  type="button"
                >
                  Delete
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Task List */}
        <div className="lane-content" ref={setNodeRef}>
          <SortableContext items={taskIds} strategy={verticalListSortingStrategy}>
            {lane.tasks.map((task) => (
              <TaskCard
                key={task.id}
                task={task}
                onClick={() => onTaskClick(task)}
                isDragDisabled={isDragDisabled}
              />
            ))}
          </SortableContext>

          {/* Quick Create */}
          {showQuickCreate ? (
            <div
              className="glass-card"
              style={{ padding: "var(--space-3)", display: "flex", flexDirection: "column", gap: "var(--space-2)" }}
            >
              <input
                className="input"
                placeholder="Task title"
                value={newTaskTitle}
                onChange={(e) => setNewTaskTitle(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleCreateTask();
                  if (e.key === "Escape") {
                    setShowQuickCreate(false);
                    setNewTaskTitle("");
                  }
                }}
                autoFocus
                style={{ fontSize: "var(--font-size-sm)" }}
              />
              {taskTypes.length > 0 && (
                <select
                  className="input"
                  value={newTaskTypeId}
                  onChange={(e) => setNewTaskTypeId(Number(e.target.value))}
                  style={{ fontSize: "var(--font-size-sm)" }}
                >
                  {taskTypes.map((tt) => (
                    <option key={tt.id} value={tt.id}>
                      {tt.name}
                    </option>
                  ))}
                </select>
              )}
              <div style={{ display: "flex", gap: "var(--space-2)" }}>
                <button
                  className="btn btn-primary btn-sm"
                  onClick={handleCreateTask}
                  disabled={!newTaskTitle.trim() || !newTaskTypeId || createTask.isPending}
                  type="button"
                >
                  Add Task
                </button>
                <button
                  className="btn btn-ghost btn-sm"
                  onClick={() => {
                    setShowQuickCreate(false);
                    setNewTaskTitle("");
                  }}
                  type="button"
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <button
              className="btn btn-ghost btn-sm"
              onClick={() => {
                if (taskTypes.length > 0 && !newTaskTypeId) {
                  setNewTaskTypeId(taskTypes[0].id);
                }
                setShowQuickCreate(true);
              }}
              type="button"
              style={{ alignSelf: "stretch", marginTop: "auto" }}
            >
              + Add task
            </button>
          )}
        </div>
      </GlassCard>
    </div>
  );
}

// --- Add Lane Button ---
function AddLaneButton({ boardId }: { boardId: number }) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [isAdding, setIsAdding] = useState(false);
  const [name, setName] = useState("");

  const createLane = useMutation({
    mutationFn: (laneName: string) =>
      api.post(`/boards/${boardId}/lanes`, { name: laneName }).then((r) => r.data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["lanes", boardId] });
      setName("");
      setIsAdding(false);
      toast("Lane created", "success");
    },
    onError: () => toast("Failed to create lane", "error"),
  });

  const handleCreate = () => {
    const n = name.trim();
    if (!n) return;
    createLane.mutate(n);
  };

  if (isAdding) {
    return (
      <div style={{ display: "flex", gap: "var(--space-2)", alignItems: "center" }}>
        <input
          className="input"
          placeholder="Lane name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") handleCreate();
            if (e.key === "Escape") {
              setIsAdding(false);
              setName("");
            }
          }}
          autoFocus
          style={{ width: "150px" }}
        />
        <button
          className="btn btn-primary btn-sm"
          onClick={handleCreate}
          disabled={!name.trim() || createLane.isPending}
          type="button"
        >
          Add
        </button>
        <button
          className="btn btn-ghost btn-sm"
          onClick={() => {
            setIsAdding(false);
            setName("");
          }}
          type="button"
        >
          &#10005;
        </button>
      </div>
    );
  }

  return (
    <button className="btn btn-primary" onClick={() => setIsAdding(true)} type="button">
      + Add Lane
    </button>
  );
}
