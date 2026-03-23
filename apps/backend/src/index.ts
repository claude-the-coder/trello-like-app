import express from "express";
import cors from "cors";
import projectsRouter from "./routes/projects.js";
import boardsRouter from "./routes/boards.js";

export const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

app.get("/health", (_req, res) => {
  res.json({ ok: true });
});

app.use("/projects", projectsRouter);
app.use("/boards", boardsRouter);

if (process.env.NODE_ENV !== "test") {
  app.listen(PORT, () => {
    console.log(`Backend listening on port ${PORT}`);
  });
}
