import { Router } from "express";
import prisma from "../prisma.js";

const router = Router();

// GET /boards/:id
router.get("/:id", async (req, res) => {
  const board = await prisma.board.findUnique({
    where: { id: Number(req.params.id) },
    include: {
      lanes: { orderBy: { order: "asc" } },
      project: true,
    },
  });
  if (!board) {
    res.status(404).json({ error: "Board not found" });
    return;
  }
  res.json(board);
});

// PUT /boards/:id
router.put("/:id", async (req, res) => {
  const { name } = req.body;
  try {
    const board = await prisma.board.update({
      where: { id: Number(req.params.id) },
      data: { name },
    });
    res.json(board);
  } catch {
    res.status(404).json({ error: "Board not found" });
  }
});

// DELETE /boards/:id
router.delete("/:id", async (req, res) => {
  try {
    await prisma.board.delete({
      where: { id: Number(req.params.id) },
    });
    res.status(204).end();
  } catch {
    res.status(404).json({ error: "Board not found" });
  }
});

export default router;
