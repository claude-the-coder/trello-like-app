import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect } from "vitest";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { http, HttpResponse } from "msw";
import { server } from "./mocks/server";
import TaskDetailModal from "../components/TaskDetailModal";
import { ToastProvider } from "../components/Toast";
import type { Task, TaskType } from "../types";

const taskTypes: TaskType[] = [
  { id: 1, projectId: 1, name: "Task", deletedAt: null },
  { id: 2, projectId: 1, name: "Bug", deletedAt: null },
];

function makeTask(overrides: Partial<Task> = {}): Task {
  return {
    id: 1,
    laneId: 1,
    boardId: 1,
    title: "Test task",
    description: null,
    typeId: 1,
    order: 0,
    createdAt: "2026-01-01T00:00:00.000Z",
    type: { id: 1, projectId: 1, name: "Task", deletedAt: null },
    subtasks: [
      { id: 1, taskId: 1, title: "Subtask A", completed: false },
      { id: 2, taskId: 1, title: "Subtask B", completed: true },
    ],
    ...overrides,
  };
}

function renderModal(task: Task = makeTask()) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <ToastProvider>
        <TaskDetailModal
          task={task}
          boardId={1}
          taskTypes={taskTypes}
          allTaskTypes={taskTypes}
          onClose={() => {}}
        />
      </ToastProvider>
    </QueryClientProvider>
  );
}

describe("SubtaskChecklist", () => {
  it("renders existing subtasks", () => {
    renderModal();
    expect(screen.getByText("Subtask A")).toBeInTheDocument();
    expect(screen.getByText("Subtask B")).toBeInTheDocument();
  });

  it("shows completed subtask with line-through style", () => {
    renderModal();
    const completedSubtask = screen.getByText("Subtask B");
    expect(completedSubtask).toHaveStyle({ textDecoration: "line-through" });
  });

  it("shows uncompleted subtask without line-through", () => {
    renderModal();
    const uncompletedSubtask = screen.getByText("Subtask A");
    expect(uncompletedSubtask).toHaveStyle({ textDecoration: "none" });
  });

  it("calls POST API when adding a subtask", async () => {
    const user = userEvent.setup();
    let postCalled = false;

    server.use(
      http.post("/api/tasks/1/subtasks", async ({ request }) => {
        const body = (await request.json()) as { title: string };
        postCalled = true;
        return HttpResponse.json({
          id: 100,
          taskId: 1,
          title: body.title,
          completed: false,
        });
      })
    );

    renderModal();

    const input = screen.getByPlaceholderText("Add subtask...");
    await user.type(input, "New subtask");
    await user.click(screen.getByRole("button", { name: "Add" }));

    await waitFor(() => expect(postCalled).toBe(true));
  });

  it("calls PATCH API when checking a subtask", async () => {
    const user = userEvent.setup();
    let patchCalled = false;

    server.use(
      http.patch("/api/tasks/1/subtasks/1", () => {
        patchCalled = true;
        return HttpResponse.json({
          id: 1,
          taskId: 1,
          title: "Subtask A",
          completed: true,
        });
      })
    );

    renderModal();

    const checkbox = screen.getByLabelText("Toggle subtask: Subtask A");
    await user.click(checkbox);

    await waitFor(() => expect(patchCalled).toBe(true));
  });

  it("calls DELETE API when deleting a subtask", async () => {
    const user = userEvent.setup();
    let deleteCalled = false;

    server.use(
      http.delete("/api/tasks/1/subtasks/1", () => {
        deleteCalled = true;
        return new HttpResponse(null, { status: 204 });
      })
    );

    renderModal();

    const deleteBtn = screen.getByLabelText("Delete subtask: Subtask A");
    await user.click(deleteBtn);

    await waitFor(() => expect(deleteCalled).toBe(true));
  });
});
