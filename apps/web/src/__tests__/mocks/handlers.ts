import { http, HttpResponse } from "msw";

export const handlers = [
  // Board
  http.get("/api/boards/:id", ({ params }) => {
    return HttpResponse.json({
      id: Number(params.id),
      projectId: 1,
      name: "Test Board",
      createdAt: "2026-01-01T00:00:00.000Z",
    });
  }),

  // Lanes with tasks
  http.get("/api/boards/:boardId/lanes", () => {
    return HttpResponse.json([
      {
        id: 1,
        boardId: 1,
        name: "Todo",
        order: 0,
        tasks: [
          {
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
          },
        ],
      },
      {
        id: 2,
        boardId: 1,
        name: "Done",
        order: 1,
        tasks: [],
      },
    ]);
  }),

  // Task types
  http.get("/api/projects/:projectId/task-types", () => {
    return HttpResponse.json([
      { id: 1, projectId: 1, name: "Task", deletedAt: null },
      { id: 2, projectId: 1, name: "Bug", deletedAt: null },
    ]);
  }),

  // Create task
  http.post("/api/boards/:boardId/tasks", async ({ request }) => {
    const body = (await request.json()) as { title: string; laneId: number; typeId: number };
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
  }),

  // Update task
  http.put("/api/tasks/:id", async ({ request }) => {
    const body = (await request.json()) as Record<string, unknown>;
    return HttpResponse.json({ id: 1, ...body });
  }),

  // Delete task
  http.delete("/api/tasks/:id", () => {
    return new HttpResponse(null, { status: 204 });
  }),

  // Add subtask
  http.post("/api/tasks/:taskId/subtasks", async ({ request, params }) => {
    const body = (await request.json()) as { title: string };
    return HttpResponse.json({
      id: 100,
      taskId: Number(params.taskId),
      title: body.title,
      completed: false,
    });
  }),

  // Toggle subtask
  http.patch("/api/tasks/:taskId/subtasks/:sid", ({ params }) => {
    return HttpResponse.json({
      id: Number(params.sid),
      taskId: Number(params.taskId),
      title: "Subtask",
      completed: true,
    });
  }),

  // Delete subtask
  http.delete("/api/tasks/:taskId/subtasks/:sid", () => {
    return new HttpResponse(null, { status: 204 });
  }),
];
