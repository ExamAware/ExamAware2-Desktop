<template>
  <t-card
    :bordered="false"
    style="
      text-align: center;
      height: 150px;
      display: flex;
      align-items: center;
      justify-content: center;
      margin-top: 20px;
    "
  >
    <div>
      <h2 style="font-size: 2rem; margin: 0">{{ examInfo?.name }}</h2>
      <p style="font-size: 1.2rem; margin: 10px 0 0">
        开始时间: {{ examInfo?.start ? new Date(examInfo.start).toLocaleString() : '未知' }}
      </p>
      <p style="font-size: 1.2rem; margin: 10px 0 0">
        结束时间: {{ examInfo?.end ? new Date(examInfo.end).toLocaleString() : '未知' }}
      </p>
      <p style="font-size: 1.2rem; margin: 10px 0 0">
        状态:
        <t-tag v-if="examStatus.status === 'pending'" theme="warning">未开始</t-tag>
        <t-tag v-else-if="examStatus.status === 'inProgress'" theme="success">进行中</t-tag>
        <t-tag v-else-if="examStatus.status === 'completed'" theme="default">已结束</t-tag>
      </p>
    </div>
  </t-card>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { ExamInfo } from '@renderer/core/configTypes'
import { useTimeSync } from '@renderer/utils/timeUtils'

const { getSyncedTime } = useTimeSync()

const props = defineProps<{
  examInfo: ExamInfo | undefined
}>()

const examStatus = computed(() => {
  if (!props.examInfo) return { status: 'unknown', message: '未知状态' }

  const now = getSyncedTime()
  const startTime = new Date(props.examInfo.start).getTime()
  const endTime = new Date(props.examInfo.end).getTime()

  if (now < startTime) {
    return {
      status: 'pending',
      message: `将于 ${new Date(startTime).toLocaleString()} 开始`
    }
  } else if (now >= startTime && now < endTime) {
    return {
      status: 'inProgress',
      message: `将于 ${new Date(endTime).toLocaleString()} 结束`
    }
  } else {
    return {
      status: 'completed',
      message: '已结束'
    }
  }
})
</script>
