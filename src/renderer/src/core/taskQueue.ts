import { ref } from 'vue';
import { v4 as uuidv4 } from 'uuid';

interface Task {
  id: string;
  executeTime: number;
  taskFunction: () => void;
}

const taskQueue = ref<Task[]>([]);
const intervalId = ref<number | null>(null);

const addTask = (executeTime: number, taskFunction: () => void) => {
  const task: Task = {
    id: uuidv4(),
    executeTime,
    taskFunction,
  };
  taskQueue.value.push(task);
  taskQueue.value.sort((a, b) => a.executeTime - b.executeTime);
};

const checkTasks = () => {
  const now = new Date().getTime();
  while (taskQueue.value.length > 0 && taskQueue.value[0].executeTime <= now) {
    const task = taskQueue.value.shift();
    if (task) {
      task.taskFunction();
    }
  }
};

const startTaskQueue = () => {
  if (!intervalId.value) {
    intervalId.value = window.setInterval(checkTasks, 200);
  }
};

const stopTaskQueue = () => {
  if (intervalId.value) {
    clearInterval(intervalId.value);
    intervalId.value = null;
  }
};

export { addTask, startTaskQueue, stopTaskQueue };
