import { Router } from "express";
import prisma from "../prisma.js";

const router = Router();

// GET /boards/:boardId/lanes (returns lanes with their tasks)
router.get("/:boardId/lanes", async (req, res, next) => {
  try {
    const lanes = await prisma.lane.findMany({
      where: { boardId: Number(req.params.boardId) },
      include: {
        tasks: {
          include: { type: true, subtasks: true },
          orderBy: { order: "asc" },
        },
      },
      orderBy: { order: "asc" },
    });
    res.json(lanes);
  } catch (err) {
    next(err);
  }
});

// POST /boards/:boardId/lanes
router.post("/:boardId/lanes", async (req, res, next) => {
  try {
    const boardId = Number(req.params.boardId);
    const { name } = req.body;
    if (!name) {
      res.status(400).json({ error: "name is required" });
      return;
    }

    const board = await prisma.board.findUnique({ where: { id: boardId } });
    if (!board) {
      res.status(404).json({ error: "Board not found" });
      return;
    }

    const maxOrder = await prisma.lane.aggregate({
      where: { boardId },
      _max: { order: true },
    });
    const order = (maxOrder._max.order ?? -1) + 1;

    const lane = await prisma.lane.create({
      data: { boardId, name, order },
    });
    res.status(201).json(lane);
  } catch (err) {
    next(err);
  }
});

export default router;
