import { Router } from "express";
import prisma from "../prisma.js";

const router = Router();

const DEFAULT_TASK_TYPES = ["Task", "Bug", "History", "Feature"];
const DEFAULT_LANES = [
  { name: "Todo", order: 0 },
  { name: "Planning", order: 1 },
  { name: "Developing", order: 2 },
  { name: "Testing", order: 3 },
  { name: "Done", order: 4 },
];

// GET /projects
router.get("/", async (_req, res) => {
  const projects = await prisma.project.findMany({
    include: { boards: true },
    orderBy: { createdAt: "desc" },
  });
  res.json(projects);
});

// POST /projects
router.post("/", async (req, res) => {
  const { name, description } = req.body;
  if (!name) {
    res.status(400).json({ error: "name is required" });
    return;
  }
  const project = await prisma.project.create({
    data: { name, description },
  });
  res.status(201).json(project);
});

// GET /projects/:id
router.get("/:id", async (req, res) => {
  const project = await prisma.project.findUnique({
    where: { id: Number(req.params.id) },
    include: { boards: true, taskTypes: true },
  });
  if (!project) {
    res.status(404).json({ error: "Project not found" });
    return;
  }
  res.json(project);
});

// PUT /projects/:id
router.put("/:id", async (req, res) => {
  const { name, description } = req.body;
  try {
    const project = await prisma.project.update({
      where: { id: Number(req.params.id) },
      data: { name, description },
    });
    res.json(project);
  } catch {
    res.status(404).json({ error: "Project not found" });
  }
});

// DELETE /projects/:id
router.delete("/:id", async (req, res) => {
  try {
    await prisma.project.delete({
      where: { id: Number(req.params.id) },
    });
    res.status(204).end();
  } catch {
    res.status(404).json({ error: "Project not found" });
  }
});

// GET /projects/:id/boards
router.get("/:id/boards", async (req, res) => {
  const boards = await prisma.board.findMany({
    where: { projectId: Number(req.params.id) },
    orderBy: { createdAt: "desc" },
  });
  res.json(boards);
});

// POST /projects/:id/boards
router.post("/:id/boards", async (req, res) => {
  const projectId = Number(req.params.id);
  const { name } = req.body;
  if (!name) {
    res.status(400).json({ error: "name is required" });
    return;
  }

  const project = await prisma.project.findUnique({ where: { id: projectId } });
  if (!project) {
    res.status(404).json({ error: "Project not found" });
    return;
  }

  const board = await prisma.board.create({
    data: {
      projectId,
      name,
      lanes: {
        create: DEFAULT_LANES,
      },
    },
    include: { lanes: true },
  });

  // Seed default task types if none exist for this project
  const existingTypes = await prisma.taskType.count({
    where: { projectId },
  });
  if (existingTypes === 0) {
    await prisma.taskType.createMany({
      data: DEFAULT_TASK_TYPES.map((typeName) => ({
        projectId,
        name: typeName,
      })),
    });
  }

  res.status(201).json(board);
});

export default router;
