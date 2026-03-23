import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const DEFAULT_TASK_TYPES = ["Task", "Bug", "History", "Feature"];
const DEFAULT_LANES = ["Todo", "Planning", "Developing", "Testing", "Done"];

async function main() {
  const project = await prisma.project.create({
    data: {
      name: "Sample Project",
      description: "A sample project to get started",
    },
  });

  for (const name of DEFAULT_TASK_TYPES) {
    await prisma.taskType.create({
      data: { projectId: project.id, name },
    });
  }

  const board = await prisma.board.create({
    data: {
      projectId: project.id,
      name: "Main Board",
    },
  });

  for (let i = 0; i < DEFAULT_LANES.length; i++) {
    await prisma.lane.create({
      data: { boardId: board.id, name: DEFAULT_LANES[i], order: i },
    });
  }

  console.log("Seed completed: project, board, lanes, and task types created.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
