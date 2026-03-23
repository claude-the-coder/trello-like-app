import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import request from "supertest";
import { app } from "../index.js";
import prisma from "../prisma.js";

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
});

async function createProjectAndBoard() {
  const proj = await request(app).post("/projects").send({ name: "P1" });
  const board = await request(app)
    .post(`/projects/${proj.body.id}/boards`)
    .send({ name: "B1" });
  return { projectId: proj.body.id, boardId: board.body.id };
}

describe("Lanes API", () => {
  it("GET /boards/:id/lanes returns lanes with tasks", async () => {
    const { boardId } = await createProjectAndBoard();
    const res = await request(app).get(`/boards/${boardId}/lanes`);
    expect(res.status).toBe(200);
    expect(res.body.length).toBe(5);
    expect(res.body[0].tasks).toEqual([]);
  });

  it("POST /boards/:id/lanes creates a new lane", async () => {
    const { boardId } = await createProjectAndBoard();
    const res = await request(app)
      .post(`/boards/${boardId}/lanes`)
      .send({ name: "Custom Lane" });
    expect(res.status).toBe(201);
    expect(res.body.name).toBe("Custom Lane");
    expect(res.body.order).toBe(5); // 0-4 are defaults
  });

  it("PUT /lanes/:id renames a lane", async () => {
    const { boardId } = await createProjectAndBoard();
    const lanes = await request(app).get(`/boards/${boardId}/lanes`);
    const laneId = lanes.body[0].id;

    const res = await request(app)
      .put(`/lanes/${laneId}`)
      .send({ name: "Renamed" });
    expect(res.status).toBe(200);
    expect(res.body.name).toBe("Renamed");
  });

  it("DELETE /lanes/:id deletes an empty lane", async () => {
    const { boardId } = await createProjectAndBoard();
    const lanes = await request(app).get(`/boards/${boardId}/lanes`);
    const laneId = lanes.body[0].id;

    const res = await request(app).delete(`/lanes/${laneId}`);
    expect(res.status).toBe(204);
  });

  it("DELETE /lanes/:id returns 409 if lane has tasks", async () => {
    const { projectId, boardId } = await createProjectAndBoard();
    const lanes = await request(app).get(`/boards/${boardId}/lanes`);
    const laneId = lanes.body[0].id;
    const types = await prisma.taskType.findMany({
      where: { projectId },
    });

    // Create a task in this lane
    await prisma.task.create({
      data: {
        boardId,
        laneId,
        title: "Test Task",
        typeId: types[0].id,
        order: 0,
      },
    });

    const res = await request(app).delete(`/lanes/${laneId}`);
    expect(res.status).toBe(409);
    expect(res.body.error).toContain("Cannot delete lane with tasks");
  });
});

describe("Task Types API", () => {
  it("GET /projects/:id/task-types returns active types", async () => {
    const { projectId } = await createProjectAndBoard();
    const res = await request(app).get(`/projects/${projectId}/task-types`);
    expect(res.status).toBe(200);
    expect(res.body.length).toBe(4);
  });

  it("POST /projects/:id/task-types creates a new type", async () => {
    const { projectId } = await createProjectAndBoard();
    const res = await request(app)
      .post(`/projects/${projectId}/task-types`)
      .send({ name: "Epic" });
    expect(res.status).toBe(201);
    expect(res.body.name).toBe("Epic");
  });

  it("POST /projects/:id/task-types returns 400 for duplicate name", async () => {
    const { projectId } = await createProjectAndBoard();
    const res = await request(app)
      .post(`/projects/${projectId}/task-types`)
      .send({ name: "Task" }); // already exists as default
    expect(res.status).toBe(400);
    expect(res.body.error).toContain("Duplicate");
  });

  it("DELETE /task-types/:id soft-deletes a type", async () => {
    const { projectId } = await createProjectAndBoard();
    const types = await request(app).get(`/projects/${projectId}/task-types`);
    const typeId = types.body[0].id;

    const res = await request(app).delete(`/task-types/${typeId}`);
    expect(res.status).toBe(204);

    // Should not appear in active types
    const after = await request(app).get(`/projects/${projectId}/task-types`);
    expect(after.body.length).toBe(3);
    expect(after.body.find((t: { id: number }) => t.id === typeId)).toBeUndefined();

    // But still exists in DB
    const dbType = await prisma.taskType.findUnique({ where: { id: typeId } });
    expect(dbType).not.toBeNull();
    expect(dbType!.deletedAt).not.toBeNull();
  });

  it("DELETE /task-types/:id returns 409 if last type", async () => {
    const { projectId } = await createProjectAndBoard();
    const types = await request(app).get(`/projects/${projectId}/task-types`);

    // Delete 3 of 4 types
    for (let i = 0; i < 3; i++) {
      await request(app).delete(`/task-types/${types.body[i].id}`);
    }

    // Try to delete the last one
    const res = await request(app).delete(`/task-types/${types.body[3].id}`);
    expect(res.status).toBe(409);
    expect(res.body.error).toContain("last task type");
  });

  it("soft-deleted types are preserved on existing tasks", async () => {
    const { projectId, boardId } = await createProjectAndBoard();
    const types = await request(app).get(`/projects/${projectId}/task-types`);
    const lanes = await request(app).get(`/boards/${boardId}/lanes`);
    const typeId = types.body[0].id;

    // Create a task with this type
    const task = await prisma.task.create({
      data: {
        boardId,
        laneId: lanes.body[0].id,
        title: "Legacy Task",
        typeId,
        order: 0,
      },
    });

    // Soft-delete the type
    await request(app).delete(`/task-types/${typeId}`);

    // Task still has the type reference
    const dbTask = await prisma.task.findUnique({
      where: { id: task.id },
      include: { type: true },
    });
    expect(dbTask!.type.id).toBe(typeId);
    expect(dbTask!.type.deletedAt).not.toBeNull();
  });
});
