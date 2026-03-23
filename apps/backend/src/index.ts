import express from "express";
import cors from "cors";
import projectsRouter from "./routes/projects.js";
import boardsRouter from "./routes/boards.js";
import lanesRouter from "./routes/lanes.js";
import lanesCrudRouter from "./routes/lanesCrud.js";
import { projectTaskTypesRouter, taskTypesCrudRouter } from "./routes/taskTypes.js";
import { boardTasksRouter, tasksCrudRouter } from "./routes/tasks.js";

export const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

app.get("/health", (_req, res) => {
  res.json({ ok: true });
});

app.use("/projects", projectsRouter);
app.use("/projects", projectTaskTypesRouter);
app.use("/boards", lanesRouter);
app.use("/boards", boardTasksRouter);
app.use("/boards", boardsRouter);
app.use("/lanes", lanesCrudRouter);
app.use("/tasks", tasksCrudRouter);
app.use("/task-types", taskTypesCrudRouter);

if (process.env.NODE_ENV !== "test") {
  app.listen(PORT, () => {
    console.log(`Backend listening on port ${PORT}`);
  });
}
