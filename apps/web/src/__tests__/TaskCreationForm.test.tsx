import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect } from "vitest";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import { http, HttpResponse } from "msw";
import { server } from "./mocks/server";
import BoardViewPage from "../pages/BoardViewPage";
import { ToastProvider } from "../components/Toast";

function renderBoardView() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <ToastProvider>
        <MemoryRouter initialEntries={["/projects/1/boards/1"]}>
          <Routes>
            <Route
              path="/projects/:id/boards/:boardId"
              element={<BoardViewPage />}
            />
          </Routes>
        </MemoryRouter>
      </ToastProvider>
    </QueryClientProvider>
  );
}

describe("Task creation form", () => {
  it("shows the quick-create form when clicking '+ Add task'", async () => {
    const user = userEvent.setup();
    renderBoardView();

    const addBtns = await screen.findAllByRole("button", { name: "+ Add task" });
    await user.click(addBtns[0]);

    expect(screen.getByPlaceholderText("Task title")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Add Task" })).toBeInTheDocument();
  });

  it("disables submit when title is empty", async () => {
    const user = userEvent.setup();
    renderBoardView();

    const addBtns = await screen.findAllByRole("button", { name: "+ Add task" });
    await user.click(addBtns[0]);

    const submitBtn = screen.getByRole("button", { name: "Add Task" });
    expect(submitBtn).toBeDisabled();
  });

  it("has a type select field pre-populated with available types", async () => {
    const user = userEvent.setup();
    renderBoardView();

    const addBtns = await screen.findAllByRole("button", { name: "+ Add task" });
    await user.click(addBtns[0]);

    const typeSelect = screen.getByRole("combobox");
    expect(typeSelect).toBeInTheDocument();

    const options = typeSelect.querySelectorAll("option");
    const optionTexts = Array.from(options).map((o) => o.textContent);
    expect(optionTexts).toContain("Task");
    expect(optionTexts).toContain("Bug");
  });

  it("calls POST API and closes form on successful submit", async () => {
    const user = userEvent.setup();
    let postCalled = false;
    let postBody: { title: string; laneId: number; typeId: number } | null = null;

    server.use(
      http.post("/api/boards/1/tasks", async ({ request }) => {
        const body = (await request.json()) as { title: string; laneId: number; typeId: number };
        postCalled = true;
        postBody = body;
        return HttpResponse.json({
          id: 99,
          laneId: body.laneId,
          boardId: 1,
          title: body.title,
          description: null,
          typeId: body.typeId,
          order: 0,
          createdAt: "2026-01-01T00:00:00.000Z",
          type: { id: body.typeId, projectId: 1, name: "Task", deletedAt: null },
          subtasks: [],
        });
      })
    );

    renderBoardView();

    // Wait for lanes to load and click add task on the first lane
    const addBtns = await screen.findAllByRole("button", { name: "+ Add task" });
    await user.click(addBtns[0]);

    // Fill in the title
    const titleInput = screen.getByPlaceholderText("Task title");
    await user.type(titleInput, "New task from test");

    // Submit
    const submitBtn = screen.getByRole("button", { name: "Add Task" });
    expect(submitBtn).not.toBeDisabled();
    await user.click(submitBtn);

    await waitFor(() => expect(postCalled).toBe(true));
    expect(postBody!.title).toBe("New task from test");
    expect(postBody!.laneId).toBe(1);

    // Form should close after successful creation
    await waitFor(() => {
      expect(screen.queryByPlaceholderText("Task title")).not.toBeInTheDocument();
    });
  });
});
