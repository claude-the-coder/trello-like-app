export interface Project {
  id: number;
  name: string;
  description: string | null;
  createdAt: string;
  boards: Board[];
}

export interface Board {
  id: number;
  projectId: number;
  name: string;
  createdAt: string;
  project?: Project;
  lanes?: Lane[];
}

export interface Lane {
  id: number;
  boardId: number;
  name: string;
  order: number;
  tasks: Task[];
}

export interface TaskType {
  id: number;
  projectId: number;
  name: string;
  deletedAt: string | null;
}

export interface Task {
  id: number;
  laneId: number;
  boardId: number;
  title: string;
  description: string | null;
  typeId: number;
  order: number;
  createdAt: string;
  type: TaskType;
  subtasks: Subtask[];
}

export interface Subtask {
  id: number;
  taskId: number;
  title: string;
  completed: boolean;
}
