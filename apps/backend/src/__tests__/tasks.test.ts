import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import request from "supertest";
import { app } from "../index.js";
import prisma from "../prisma.js";

let projectId: number;
let boardId: number;
let laneIds: number[];
let typeId: number;

beforeAll(async () => {
  await prisma.$connect();
});

afterAll(async () => {
  await prisma.$disconnect();
});

beforeEach(async () => {
  await prisma.subtask.deleteMany();
  await prisma.task.deleteMany();
  await prisma.lane.deleteMany();
  await prisma.taskType.deleteMany();
  await prisma.board.deleteMany();
  await prisma.project.deleteMany();

  const proj = await request(app).post("/projects").send({ name: "P1" });
  projectId = proj.body.id;
  const board = await request(app)
    .post(`/projects/${projectId}/boards`)
    .send({ name: "B1" });
  boardId = board.body.id;

  const lanes = await request(app).get(`/boards/${boardId}/lanes`);
  laneIds = lanes.body.map((l: { id: number }) => l.id);

  const types = await request(app).get(`/projects/${projectId}/task-types`);
  typeId = types.body[0].id;
});

describe("Tasks API", () => {
  it("GET /boards/:id/tasks returns tasks", async () => {
    const res = await request(app).get(`/boards/${boardId}/tasks`);
    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });

  it("POST /boards/:id/tasks creates a task", async () => {
    const res = await request(app)
      .post(`/boards/${boardId}/tasks`)
      .send({ title: "My Task", laneId: laneIds[0], typeId });
    expect(res.status).toBe(201);
    expect(res.body.title).toBe("My Task");
    expect(res.body.laneId).toBe(laneIds[0]);
    expect(res.body.order).toBe(0);
  });

  it("GET /tasks/:id returns a task", async () => {
    const create = await request(app)
      .post(`/boards/${boardId}/tasks`)
      .send({ title: "T1", laneId: laneIds[0], typeId });
    const res = await request(app).get(`/tasks/${create.body.id}`);
    expect(res.status).toBe(200);
    expect(res.body.title).toBe("T1");
  });

  it("PUT /tasks/:id updates a task", async () => {
    const create = await request(app)
      .post(`/boards/${boardId}/tasks`)
      .send({ title: "Old", laneId: laneIds[0], typeId });
    const res = await request(app)
      .put(`/tasks/${create.body.id}`)
      .send({ title: "New" });
    expect(res.status).toBe(200);
    expect(res.body.title).toBe("New");
  });

  it("DELETE /tasks/:id deletes a task", async () => {
    const create = await request(app)
      .post(`/boards/${boardId}/tasks`)
      .send({ title: "T1", laneId: laneIds[0], typeId });
    const res = await request(app).delete(`/tasks/${create.body.id}`);
    expect(res.status).toBe(204);
  });
});

describe("Subtasks API", () => {
  it("POST /tasks/:id/subtasks creates a subtask", async () => {
    const task = await request(app)
      .post(`/boards/${boardId}/tasks`)
      .send({ title: "T1", laneId: laneIds[0], typeId });
    const res = await request(app)
      .post(`/tasks/${task.body.id}/subtasks`)
      .send({ title: "Sub1" });
    expect(res.status).toBe(201);
    expect(res.body.title).toBe("Sub1");
    expect(res.body.completed).toBe(false);
  });

  it("PATCH /tasks/:id/subtasks/:sid toggles completed", async () => {
    const task = await request(app)
      .post(`/boards/${boardId}/tasks`)
      .send({ title: "T1", laneId: laneIds[0], typeId });
    const sub = await request(app)
      .post(`/tasks/${task.body.id}/subtasks`)
      .send({ title: "Sub1" });

    const toggle1 = await request(app).patch(
      `/tasks/${task.body.id}/subtasks/${sub.body.id}`
    );
    expect(toggle1.body.completed).toBe(true);

    const toggle2 = await request(app).patch(
      `/tasks/${task.body.id}/subtasks/${sub.body.id}`
    );
    expect(toggle2.body.completed).toBe(false);
  });

  it("DELETE /tasks/:id/subtasks/:sid deletes a subtask", async () => {
    const task = await request(app)
      .post(`/boards/${boardId}/tasks`)
      .send({ title: "T1", laneId: laneIds[0], typeId });
    const sub = await request(app)
      .post(`/tasks/${task.body.id}/subtasks`)
      .send({ title: "Sub1" });
    const res = await request(app).delete(
      `/tasks/${task.body.id}/subtasks/${sub.body.id}`
    );
    expect(res.status).toBe(204);
  });
});

describe("Move API", () => {
  it("PATCH /tasks/:id/move moves task to another lane", async () => {
    const task = await request(app)
      .post(`/boards/${boardId}/tasks`)
      .send({ title: "T1", laneId: laneIds[0], typeId });

    const res = await request(app)
      .patch(`/tasks/${task.body.id}/move`)
      .send({ laneId: laneIds[2], order: 0 });
    expect(res.status).toBe(200);
    expect(res.body.laneId).toBe(laneIds[2]);
    expect(res.body.order).toBe(0);
  });

  it("no-op move returns task without DB write", async () => {
    const task = await request(app)
      .post(`/boards/${boardId}/tasks`)
      .send({ title: "T1", laneId: laneIds[0], typeId });

    const res = await request(app)
      .patch(`/tasks/${task.body.id}/move`)
      .send({ laneId: laneIds[0], order: 0 });
    expect(res.status).toBe(200);
    expect(res.body.laneId).toBe(laneIds[0]);
    expect(res.body.order).toBe(0);
  });

  it("move to empty lane works", async () => {
    const task = await request(app)
      .post(`/boards/${boardId}/tasks`)
      .send({ title: "T1", laneId: laneIds[0], typeId });

    const res = await request(app)
      .patch(`/tasks/${task.body.id}/move`)
      .send({ laneId: laneIds[4], order: 0 });
    expect(res.status).toBe(200);
    expect(res.body.laneId).toBe(laneIds[4]);
  });

  it("moving the only task in a lane works", async () => {
    const task = await request(app)
      .post(`/boards/${boardId}/tasks`)
      .send({ title: "Only", laneId: laneIds[0], typeId });

    await request(app)
      .patch(`/tasks/${task.body.id}/move`)
      .send({ laneId: laneIds[1], order: 0 });

    // Verify source lane is now empty
    const lanes = await request(app).get(`/boards/${boardId}/lanes`);
    const srcLane = lanes.body.find((l: { id: number }) => l.id === laneIds[0]);
    expect(srcLane.tasks.length).toBe(0);

    const destLane = lanes.body.find((l: { id: number }) => l.id === laneIds[1]);
    expect(destLane.tasks.length).toBe(1);
    expect(destLane.tasks[0].title).toBe("Only");
  });

  it("order persists correctly after move", async () => {
    // Create 3 tasks in lane 0
    const t1 = await request(app)
      .post(`/boards/${boardId}/tasks`)
      .send({ title: "T1", laneId: laneIds[0], typeId });
    const t2 = await request(app)
      .post(`/boards/${boardId}/tasks`)
      .send({ title: "T2", laneId: laneIds[0], typeId });
    const t3 = await request(app)
      .post(`/boards/${boardId}/tasks`)
      .send({ title: "T3", laneId: laneIds[0], typeId });

    // Move T2 to lane 1, position 0
    await request(app)
      .patch(`/tasks/${t2.body.id}/move`)
      .send({ laneId: laneIds[1], order: 0 });

    // Check lane 0: T1(0), T3(1)
    const lanes = await request(app).get(`/boards/${boardId}/lanes`);
    const lane0 = lanes.body.find((l: { id: number }) => l.id === laneIds[0]);
    expect(lane0.tasks.length).toBe(2);
    expect(lane0.tasks[0].title).toBe("T1");
    expect(lane0.tasks[0].order).toBe(0);
    expect(lane0.tasks[1].title).toBe("T3");
    expect(lane0.tasks[1].order).toBe(1);

    // Check lane 1: T2(0)
    const lane1 = lanes.body.find((l: { id: number }) => l.id === laneIds[1]);
    expect(lane1.tasks.length).toBe(1);
    expect(lane1.tasks[0].title).toBe("T2");
  });
});
