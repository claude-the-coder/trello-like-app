import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import api from "../api";
import type { Project, Board } from "../types";
import GlassCard from "../components/GlassCard";
import ConfirmDialog from "../components/ConfirmDialog";
import { useToast } from "../components/Toast";

export default function ProjectListPage() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data: projects = [], isLoading } = useQuery<Project[]>({
    queryKey: ["projects"],
    queryFn: () => api.get("/projects").then((r) => r.data),
  });

  const [showNewProject, setShowNewProject] = useState(false);
  const [newProjectName, setNewProjectName] = useState("");

  const createProject = useMutation({
    mutationFn: (name: string) =>
      api.post("/projects", { name }).then((r) => r.data),
    onSuccess: (project: Project) => {
      queryClient.setQueryData<Project[]>(["projects"], (old = []) => [
        { ...project, boards: [] },
        ...old,
      ]);
      setNewProjectName("");
      setShowNewProject(false);
      toast("Project created", "success");
    },
    onError: () => toast("Failed to create project", "error"),
  });

  const handleCreateProject = () => {
    const name = newProjectName.trim();
    if (!name) return;
    createProject.mutate(name);
  };

  if (isLoading) {
    return (
      <div className="page-container">
        <p style={{ color: "var(--color-text-secondary)" }}>Loading projects...</p>
      </div>
    );
  }

  return (
    <div className="page-container">
      <div className="page-header">
        <h1 className="page-title">Projects</h1>
        {!showNewProject && (
          <button
            className="btn btn-primary"
            onClick={() => setShowNewProject(true)}
            type="button"
          >
            + New Project
          </button>
        )}
      </div>

      {showNewProject && (
        <GlassCard style={{ padding: "var(--space-4)", marginBottom: "var(--space-4)" }}>
          <div style={{ display: "flex", gap: "var(--space-3)", alignItems: "center" }}>
            <input
              className="input"
              placeholder="Project name"
              value={newProjectName}
              onChange={(e) => setNewProjectName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleCreateProject();
                if (e.key === "Escape") {
                  setShowNewProject(false);
                  setNewProjectName("");
                }
              }}
              autoFocus
            />
            <button
              className="btn btn-primary"
              onClick={handleCreateProject}
              disabled={!newProjectName.trim() || createProject.isPending}
              type="button"
            >
              Create
            </button>
            <button
              className="btn btn-ghost"
              onClick={() => {
                setShowNewProject(false);
                setNewProjectName("");
              }}
              type="button"
            >
              Cancel
            </button>
          </div>
        </GlassCard>
      )}

      {projects.length === 0 && !showNewProject ? (
        <div className="empty-state">
          <div className="empty-state-icon" aria-hidden="true">
            &#128194;
          </div>
          <p className="empty-state-text">No projects yet</p>
          <button
            className="btn btn-primary"
            onClick={() => setShowNewProject(true)}
            type="button"
          >
            Create your first project
          </button>
        </div>
      ) : (
        <div style={{ display: "grid", gap: "var(--space-4)", gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))" }}>
          {projects.map((project) => (
            <ProjectCard key={project.id} project={project} />
          ))}
        </div>
      )}
    </div>
  );
}

function ProjectCard({ project }: { project: Project }) {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const { toast } = useToast();

  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState(project.name);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [showNewBoard, setShowNewBoard] = useState(false);
  const [newBoardName, setNewBoardName] = useState("");

  const renameProject = useMutation({
    mutationFn: (name: string) =>
      api.put(`/projects/${project.id}`, { name }).then((r) => r.data),
    onMutate: async (name) => {
      await queryClient.cancelQueries({ queryKey: ["projects"] });
      const prev = queryClient.getQueryData<Project[]>(["projects"]);
      queryClient.setQueryData<Project[]>(["projects"], (old = []) =>
        old.map((p) => (p.id === project.id ? { ...p, name } : p))
      );
      return { prev };
    },
    onError: (_err, _name, context) => {
      if (context?.prev) {
        queryClient.setQueryData(["projects"], context.prev);
      }
      toast("Failed to rename project", "error");
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: ["projects"] }),
    onSuccess: () => setIsEditing(false),
  });

  const deleteProject = useMutation({
    mutationFn: () => api.delete(`/projects/${project.id}`),
    onMutate: async () => {
      await queryClient.cancelQueries({ queryKey: ["projects"] });
      const prev = queryClient.getQueryData<Project[]>(["projects"]);
      queryClient.setQueryData<Project[]>(["projects"], (old = []) =>
        old.filter((p) => p.id !== project.id)
      );
      return { prev };
    },
    onError: (_err, _vars, context) => {
      if (context?.prev) {
        queryClient.setQueryData(["projects"], context.prev);
      }
      toast("Failed to delete project", "error");
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: ["projects"] }),
    onSuccess: () => toast("Project deleted", "success"),
  });

  const createBoard = useMutation({
    mutationFn: (name: string) =>
      api.post(`/projects/${project.id}/boards`, { name }).then((r) => r.data),
    onSuccess: (board: Board) => {
      queryClient.setQueryData<Project[]>(["projects"], (old = []) =>
        old.map((p) =>
          p.id === project.id ? { ...p, boards: [board, ...p.boards] } : p
        )
      );
      setNewBoardName("");
      setShowNewBoard(false);
      toast("Board created", "success");
    },
    onError: () => toast("Failed to create board", "error"),
  });

  const handleRename = () => {
    const name = editName.trim();
    if (!name || name === project.name) {
      setIsEditing(false);
      setEditName(project.name);
      return;
    }
    renameProject.mutate(name);
  };

  const handleCreateBoard = () => {
    const name = newBoardName.trim();
    if (!name) return;
    createBoard.mutate(name);
  };

  return (
    <>
      <GlassCard
        interactive
        style={{ padding: "var(--space-4)", display: "flex", flexDirection: "column", gap: "var(--space-3)" }}
      >
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "var(--space-2)" }}>
          {isEditing ? (
            <input
              className="input"
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
              onBlur={handleRename}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleRename();
                if (e.key === "Escape") {
                  setIsEditing(false);
                  setEditName(project.name);
                }
              }}
              autoFocus
            />
          ) : (
            <h3
              style={{
                fontSize: "var(--font-size-lg)",
                fontWeight: "var(--font-weight-semibold)",
                cursor: "pointer",
                flex: 1,
              }}
              className="truncate"
              onDoubleClick={() => {
                setEditName(project.name);
                setIsEditing(true);
              }}
              title="Double-click to rename"
            >
              {project.name}
            </h3>
          )}
          <button
            className="btn btn-ghost btn-sm"
            onClick={() => setConfirmDelete(true)}
            title="Delete project"
            type="button"
            aria-label={`Delete project ${project.name}`}
            style={{ color: "var(--color-danger)", flexShrink: 0 }}
          >
            &#10005;
          </button>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-2)" }}>
          {project.boards.length === 0 && (
            <p style={{ color: "var(--color-text-muted)", fontSize: "var(--font-size-sm)" }}>
              No boards yet
            </p>
          )}
          {project.boards.map((board) => (
            <button
              key={board.id}
              className="btn btn-ghost"
              style={{ justifyContent: "flex-start", textAlign: "left" }}
              onClick={() => navigate(`/projects/${project.id}/boards/${board.id}`)}
              type="button"
            >
              &#9654; {board.name}
            </button>
          ))}
        </div>

        {showNewBoard ? (
          <div style={{ display: "flex", gap: "var(--space-2)", alignItems: "center" }}>
            <input
              className="input"
              placeholder="Board name"
              value={newBoardName}
              onChange={(e) => setNewBoardName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleCreateBoard();
                if (e.key === "Escape") {
                  setShowNewBoard(false);
                  setNewBoardName("");
                }
              }}
              autoFocus
              style={{ fontSize: "var(--font-size-sm)" }}
            />
            <button
              className="btn btn-primary btn-sm"
              onClick={handleCreateBoard}
              disabled={!newBoardName.trim() || createBoard.isPending}
              type="button"
            >
              Add
            </button>
            <button
              className="btn btn-ghost btn-sm"
              onClick={() => {
                setShowNewBoard(false);
                setNewBoardName("");
              }}
              type="button"
            >
              &#10005;
            </button>
          </div>
        ) : (
          <button
            className="btn btn-ghost btn-sm"
            onClick={() => setShowNewBoard(true)}
            type="button"
            style={{ alignSelf: "flex-start" }}
          >
            + New Board
          </button>
        )}
      </GlassCard>

      {confirmDelete && (
        <ConfirmDialog
          message={`Delete project "${project.name}" and all its boards? This cannot be undone.`}
          onConfirm={() => {
            deleteProject.mutate();
            setConfirmDelete(false);
          }}
          onCancel={() => setConfirmDelete(false)}
        />
      )}
    </>
  );
}
