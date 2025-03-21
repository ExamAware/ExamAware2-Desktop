<script setup lang="jsx">
import { ref, onMounted, onUnmounted } from 'vue';
import { v4 as uuidv4 } from 'uuid';
const { ipcRenderer } = window.electron;

const taskQueue = ref([]);
const intervalId = ref(null);
const configData = ref(null);

const addTask = (executeTime, taskFunction) => {
  const task = {
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
    task.taskFunction();
  }
};

onMounted(() => {
  intervalId.value = setInterval(checkTasks, 200);

  console.log('Sending load-config event');
  ipcRenderer.on('load-config', (event, data) => {
    configData.value = JSON.parse(data);
    console.log('Config data loaded:', configData.value);
  });
});

onUnmounted(() => {
  if (intervalId.value) {
    clearInterval(intervalId.value);
  }
});

</script>

<template>
  <div v-if="configData">
    <!-- 在这里显示配置文件内容 -->
    <pre>{{ configData }}</pre>
  </div>
</template>
