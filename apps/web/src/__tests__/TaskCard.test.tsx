import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { DndContext } from "@dnd-kit/core";
import {
  SortableContext,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import TaskCard from "../components/TaskCard";
import type { Task } from "../types";

function makeTask(overrides: Partial<Task> = {}): Task {
  return {
    id: 1,
    laneId: 1,
    boardId: 1,
    title: "My Task",
    description: null,
    typeId: 1,
    order: 0,
    createdAt: "2026-01-01T00:00:00.000Z",
    type: { id: 1, projectId: 1, name: "Bug", deletedAt: null },
    subtasks: [],
    ...overrides,
  };
}

function renderTaskCard(task: Task, onClick = vi.fn()) {
  return render(
    <DndContext>
      <SortableContext
        items={[`task-${task.id}`]}
        strategy={verticalListSortingStrategy}
      >
        <TaskCard task={task} onClick={onClick} />
      </SortableContext>
    </DndContext>
  );
}

describe("TaskCard", () => {
  it("renders the task title", () => {
    renderTaskCard(makeTask({ title: "Implement login" }));
    expect(screen.getByText("Implement login")).toBeInTheDocument();
  });

  it("renders the type badge", () => {
    renderTaskCard(makeTask({ type: { id: 2, projectId: 1, name: "Feature", deletedAt: null } }));
    expect(screen.getByText("Feature")).toBeInTheDocument();
  });

  it("renders the subtask count badge when subtasks exist", () => {
    const task = makeTask({
      subtasks: [
        { id: 1, taskId: 1, title: "Sub A", completed: true },
        { id: 2, taskId: 1, title: "Sub B", completed: false },
        { id: 3, taskId: 1, title: "Sub C", completed: true },
      ],
    });
    renderTaskCard(task);
    expect(screen.getByText("2/3")).toBeInTheDocument();
  });

  it("hides the subtask count badge when task has 0 subtasks", () => {
    renderTaskCard(makeTask({ subtasks: [] }));
    expect(screen.queryByText(/\d+\/\d+/)).not.toBeInTheDocument();
  });

  it("sets title attribute for long titles (ellipsis truncation)", () => {
    const longTitle = "A".repeat(200);
    renderTaskCard(makeTask({ title: longTitle }));
    const titleElement = screen.getByText(longTitle);
    expect(titleElement).toHaveAttribute("title", longTitle);
    expect(titleElement).toHaveClass("truncate");
  });
});
