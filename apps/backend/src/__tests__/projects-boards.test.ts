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

describe("Projects API", () => {
  it("GET /projects returns empty array initially", async () => {
    const res = await request(app).get("/projects");
    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });

  it("POST /projects creates a project", async () => {
    const res = await request(app)
      .post("/projects")
      .send({ name: "Test Project", description: "Desc" });
    expect(res.status).toBe(201);
    expect(res.body.name).toBe("Test Project");
    expect(res.body.description).toBe("Desc");
    expect(res.body.id).toBeDefined();
  });

  it("POST /projects returns 400 without name", async () => {
    const res = await request(app).post("/projects").send({});
    expect(res.status).toBe(400);
  });

  it("GET /projects/:id returns a project", async () => {
    const create = await request(app)
      .post("/projects")
      .send({ name: "P1" });
    const res = await request(app).get(`/projects/${create.body.id}`);
    expect(res.status).toBe(200);
    expect(res.body.name).toBe("P1");
  });

  it("GET /projects/:id returns 404 for nonexistent", async () => {
    const res = await request(app).get("/projects/99999");
    expect(res.status).toBe(404);
  });

  it("PUT /projects/:id updates a project", async () => {
    const create = await request(app)
      .post("/projects")
      .send({ name: "Old" });
    const res = await request(app)
      .put(`/projects/${create.body.id}`)
      .send({ name: "New" });
    expect(res.status).toBe(200);
    expect(res.body.name).toBe("New");
  });

  it("DELETE /projects/:id deletes a project", async () => {
    const create = await request(app)
      .post("/projects")
      .send({ name: "ToDelete" });
    const res = await request(app).delete(`/projects/${create.body.id}`);
    expect(res.status).toBe(204);

    const check = await request(app).get(`/projects/${create.body.id}`);
    expect(check.status).toBe(404);
  });

  it("DELETE /projects/:id cascades to boards, lanes, and task types", async () => {
    const proj = await request(app)
      .post("/projects")
      .send({ name: "CascadeTest" });
    const board = await request(app)
      .post(`/projects/${proj.body.id}/boards`)
      .send({ name: "Board1" });

    // Verify board and lanes exist
    const boardRes = await request(app).get(`/boards/${board.body.id}`);
    expect(boardRes.status).toBe(200);
    expect(boardRes.body.lanes.length).toBe(5);

    // Delete the project
    await request(app).delete(`/projects/${proj.body.id}`);

    // Board should be gone
    const boardCheck = await request(app).get(`/boards/${board.body.id}`);
    expect(boardCheck.status).toBe(404);

    // Task types should be gone
    const types = await prisma.taskType.findMany({
      where: { projectId: proj.body.id },
    });
    expect(types.length).toBe(0);
  });
});

describe("Boards API", () => {
  it("GET /projects/:id/boards returns boards", async () => {
    const proj = await request(app)
      .post("/projects")
      .send({ name: "P1" });
    await request(app)
      .post(`/projects/${proj.body.id}/boards`)
      .send({ name: "B1" });

    const res = await request(app).get(`/projects/${proj.body.id}/boards`);
    expect(res.status).toBe(200);
    expect(res.body.length).toBe(1);
    expect(res.body[0].name).toBe("B1");
  });

  it("POST /projects/:id/boards creates board with default lanes and task types", async () => {
    const proj = await request(app)
      .post("/projects")
      .send({ name: "P1" });
    const res = await request(app)
      .post(`/projects/${proj.body.id}/boards`)
      .send({ name: "B1" });

    expect(res.status).toBe(201);
    expect(res.body.lanes.length).toBe(5);
    expect(res.body.lanes.map((l: { name: string }) => l.name)).toEqual([
      "Todo",
      "Planning",
      "Developing",
      "Testing",
      "Done",
    ]);

    // Check task types were seeded
    const types = await prisma.taskType.findMany({
      where: { projectId: proj.body.id },
    });
    expect(types.length).toBe(4);
    expect(types.map((t) => t.name).sort()).toEqual([
      "Bug",
      "Feature",
      "History",
      "Task",
    ]);
  });

  it("POST /projects/:id/boards returns 400 without name", async () => {
    const proj = await request(app)
      .post("/projects")
      .send({ name: "P1" });
    const res = await request(app)
      .post(`/projects/${proj.body.id}/boards`)
      .send({});
    expect(res.status).toBe(400);
  });

  it("GET /boards/:id returns a board with lanes", async () => {
    const proj = await request(app)
      .post("/projects")
      .send({ name: "P1" });
    const board = await request(app)
      .post(`/projects/${proj.body.id}/boards`)
      .send({ name: "B1" });

    const res = await request(app).get(`/boards/${board.body.id}`);
    expect(res.status).toBe(200);
    expect(res.body.name).toBe("B1");
    expect(res.body.lanes.length).toBe(5);
  });

  it("PUT /boards/:id updates a board", async () => {
    const proj = await request(app)
      .post("/projects")
      .send({ name: "P1" });
    const board = await request(app)
      .post(`/projects/${proj.body.id}/boards`)
      .send({ name: "Old" });

    const res = await request(app)
      .put(`/boards/${board.body.id}`)
      .send({ name: "New" });
    expect(res.status).toBe(200);
    expect(res.body.name).toBe("New");
  });

  it("DELETE /boards/:id deletes a board", async () => {
    const proj = await request(app)
      .post("/projects")
      .send({ name: "P1" });
    const board = await request(app)
      .post(`/projects/${proj.body.id}/boards`)
      .send({ name: "B1" });

    const res = await request(app).delete(`/boards/${board.body.id}`);
    expect(res.status).toBe(204);

    const check = await request(app).get(`/boards/${board.body.id}`);
    expect(check.status).toBe(404);
  });
});
