import { Router } from "express";
import prisma from "../prisma.js";

const router = Router();

// PUT /lanes/:id
router.put("/:id", async (req, res) => {
  const { name } = req.body;
  try {
    const lane = await prisma.lane.update({
      where: { id: Number(req.params.id) },
      data: { name },
    });
    res.json(lane);
  } catch {
    res.status(404).json({ error: "Lane not found" });
  }
});

// DELETE /lanes/:id (blocked with 409 if lane has tasks)
router.delete("/:id", async (req, res) => {
  const laneId = Number(req.params.id);
  const lane = await prisma.lane.findUnique({ where: { id: laneId } });
  if (!lane) {
    res.status(404).json({ error: "Lane not found" });
    return;
  }

  const taskCount = await prisma.task.count({ where: { laneId } });
  if (taskCount > 0) {
    res.status(409).json({ error: "Cannot delete lane with tasks. Move tasks first." });
    return;
  }

  await prisma.lane.delete({ where: { id: laneId } });
  res.status(204).end();
});

export default router;
