<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue';
import { addTask, startTaskQueue, stopTaskQueue } from '@renderer/core/taskQueue';
const { ipcRenderer } = window.electron;

const configData = ref<any>(null);

onMounted(() => {
  startTaskQueue();

  console.log('Sending load-config event');
  ipcRenderer.on('load-config', (event, data) => {
    configData.value = JSON.parse(data);
    console.log('Config data loaded:', configData.value);
  });
});

onUnmounted(() => {
  stopTaskQueue();
});
</script>

<template>

</template>
