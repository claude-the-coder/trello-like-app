import { Router } from "express";
import prisma from "../prisma.js";

export const boardTasksRouter = Router();
export const tasksCrudRouter = Router();

// GET /boards/:boardId/tasks
boardTasksRouter.get("/:boardId/tasks", async (req, res, next) => {
  try {
    const tasks = await prisma.task.findMany({
      where: { boardId: Number(req.params.boardId) },
      include: { type: true, subtasks: true },
      orderBy: { order: "asc" },
    });
    res.json(tasks);
  } catch (err) {
    next(err);
  }
});

// POST /boards/:boardId/tasks
boardTasksRouter.post("/:boardId/tasks", async (req, res, next) => {
  try {
    const boardId = Number(req.params.boardId);
    const { title, laneId, typeId, description } = req.body;
    if (!title || !laneId || !typeId) {
      res.status(400).json({ error: "title, laneId, and typeId are required" });
      return;
    }

    const maxOrder = await prisma.task.aggregate({
      where: { laneId: Number(laneId) },
      _max: { order: true },
    });
    const order = (maxOrder._max.order ?? -1) + 1;

    const task = await prisma.task.create({
      data: {
        boardId,
        laneId: Number(laneId),
        typeId: Number(typeId),
        title,
        description,
        order,
      },
      include: { type: true, subtasks: true },
    });
    res.status(201).json(task);
  } catch (err) {
    next(err);
  }
});

// GET /tasks/:id
tasksCrudRouter.get("/:id", async (req, res) => {
  const task = await prisma.task.findUnique({
    where: { id: Number(req.params.id) },
    include: { type: true, subtasks: true },
  });
  if (!task) {
    res.status(404).json({ error: "Task not found" });
    return;
  }
  res.json(task);
});

// PUT /tasks/:id
tasksCrudRouter.put("/:id", async (req, res) => {
  const { title, description, typeId } = req.body;
  try {
    const task = await prisma.task.update({
      where: { id: Number(req.params.id) },
      data: {
        ...(title !== undefined && { title }),
        ...(description !== undefined && { description }),
        ...(typeId !== undefined && { typeId: Number(typeId) }),
      },
      include: { type: true, subtasks: true },
    });
    res.json(task);
  } catch {
    res.status(404).json({ error: "Task not found" });
  }
});

// DELETE /tasks/:id
tasksCrudRouter.delete("/:id", async (req, res) => {
  try {
    await prisma.task.delete({ where: { id: Number(req.params.id) } });
    res.status(204).end();
  } catch {
    res.status(404).json({ error: "Task not found" });
  }
});

// POST /tasks/:id/subtasks
tasksCrudRouter.post("/:id/subtasks", async (req, res) => {
  const taskId = Number(req.params.id);
  const { title } = req.body;
  if (!title) {
    res.status(400).json({ error: "title is required" });
    return;
  }

  const task = await prisma.task.findUnique({ where: { id: taskId } });
  if (!task) {
    res.status(404).json({ error: "Task not found" });
    return;
  }

  const subtask = await prisma.subtask.create({
    data: { taskId, title },
  });
  res.status(201).json(subtask);
});

// PATCH /tasks/:id/subtasks/:sid (toggle completed)
tasksCrudRouter.patch("/:id/subtasks/:sid", async (req, res) => {
  try {
    const subtask = await prisma.subtask.findUnique({
      where: { id: Number(req.params.sid) },
    });
    if (!subtask) {
      res.status(404).json({ error: "Subtask not found" });
      return;
    }
    const updated = await prisma.subtask.update({
      where: { id: subtask.id },
      data: { completed: !subtask.completed },
    });
    res.json(updated);
  } catch {
    res.status(404).json({ error: "Subtask not found" });
  }
});

// DELETE /tasks/:id/subtasks/:sid
tasksCrudRouter.delete("/:id/subtasks/:sid", async (req, res) => {
  try {
    await prisma.subtask.delete({ where: { id: Number(req.params.sid) } });
    res.status(204).end();
  } catch {
    res.status(404).json({ error: "Subtask not found" });
  }
});

// PATCH /tasks/:id/move
tasksCrudRouter.patch("/:id/move", async (req, res) => {
  const taskId = Number(req.params.id);
  const { laneId, order } = req.body;

  if (laneId === undefined || order === undefined) {
    res.status(400).json({ error: "laneId and order are required" });
    return;
  }

  const task = await prisma.task.findUnique({ where: { id: taskId } });
  if (!task) {
    res.status(404).json({ error: "Task not found" });
    return;
  }

  const newLaneId = Number(laneId);
  const newOrder = Number(order);

  // No-op check: same lane and same position
  if (task.laneId === newLaneId && task.order === newOrder) {
    res.json(task);
    return;
  }

  await prisma.$transaction(async (tx) => {
    // Remove task from source lane: decrement order of tasks after it
    await tx.task.updateMany({
      where: {
        laneId: task.laneId,
        order: { gt: task.order },
        id: { not: taskId },
      },
      data: { order: { decrement: 1 } },
    });

    // Insert into destination lane: increment order of tasks at or after the target position
    await tx.task.updateMany({
      where: {
        laneId: newLaneId,
        order: { gte: newOrder },
        id: { not: taskId },
      },
      data: { order: { increment: 1 } },
    });

    // Update the task itself
    await tx.task.update({
      where: { id: taskId },
      data: { laneId: newLaneId, order: newOrder },
    });
  });

  const updated = await prisma.task.findUnique({
    where: { id: taskId },
    include: { type: true, subtasks: true },
  });
  res.json(updated);
});
