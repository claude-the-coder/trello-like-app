import { Router } from "express";
import prisma from "../prisma.js";

export const projectTaskTypesRouter = Router();
export const taskTypesCrudRouter = Router();

// GET /projects/:projectId/task-types (excludes soft-deleted)
projectTaskTypesRouter.get("/:projectId/task-types", async (req, res) => {
  const types = await prisma.taskType.findMany({
    where: {
      projectId: Number(req.params.projectId),
      deletedAt: null,
    },
    orderBy: { id: "asc" },
  });
  res.json(types);
});

// POST /projects/:projectId/task-types
projectTaskTypesRouter.post("/:projectId/task-types", async (req, res) => {
  const projectId = Number(req.params.projectId);
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

  const existing = await prisma.taskType.findUnique({
    where: { projectId_name: { projectId, name } },
  });
  if (existing) {
    if (existing.deletedAt) {
      const restored = await prisma.taskType.update({
        where: { id: existing.id },
        data: { deletedAt: null },
      });
      res.status(201).json(restored);
      return;
    }
    res.status(400).json({ error: "Duplicate type name within this project" });
    return;
  }

  const type = await prisma.taskType.create({
    data: { projectId, name },
  });
  res.status(201).json(type);
});

// DELETE /task-types/:id (soft-delete; blocked if last active type)
taskTypesCrudRouter.delete("/:id", async (req, res) => {
  const typeId = Number(req.params.id);
  const type = await prisma.taskType.findUnique({ where: { id: typeId } });
  if (!type) {
    res.status(404).json({ error: "Task type not found" });
    return;
  }
  if (type.deletedAt) {
    res.status(404).json({ error: "Task type already deleted" });
    return;
  }

  const activeCount = await prisma.taskType.count({
    where: { projectId: type.projectId, deletedAt: null },
  });
  if (activeCount <= 1) {
    res.status(409).json({ error: "Cannot delete the last task type" });
    return;
  }

  await prisma.taskType.update({
    where: { id: typeId },
    data: { deletedAt: new Date() },
  });
  res.status(204).end();
});
