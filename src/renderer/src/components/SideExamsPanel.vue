<template>
  <div>
    <t-list v-for="(item, index) in localProfile.examInfos" :key="index" :split="true">
      <t-list-item>
        {{ item.name }}
        <template #action>
          <t-link
            theme="primary"
            hover="color"
            style="margin-left: 16px"
            @click="switchExamInfo(index)"
          >
            编辑
          </t-link>
          <t-link theme="danger" hover="color" style="margin-left: 16px" @click="deleteExam(index)">
            删除
          </t-link>
        </template>
      </t-list-item>
    </t-list>
  </div>
</template>

<script setup lang="ts">
import { defineEmits, watch, ref } from 'vue'
import type { ExamConfig } from '@renderer/core/configTypes'
import { ArrowUpIcon, ArrowDownIcon } from 'tdesign-icons-vue-next'

const props = defineProps({
  profile: Object as () => ExamConfig,
})

const emit = defineEmits(['switch-exam-info', 'update:profile'])

function switchExamInfo(examId: number) {
  emit('switch-exam-info', { examId }) // 传递需要切换的 examInfo ID
}

function deleteExam(examId: number) {
  if (localProfile.value.examInfos) {
    localProfile.value.examInfos.splice(examId, 1)
  }
  emit('update:profile', localProfile.value)
  emit('switch-exam-info', { examId: null }) // 删除考试后将 currentExamIndex 设为 null
}

const localProfile = ref({ ...props.profile })

watch(
  localProfile,
  (newProfile) => {
    emit('update:profile', newProfile)
  },
  { deep: true },
)

watch(
  () => props.profile,
  (newProfile) => {
    localProfile.value = { ...newProfile }
  },
  { deep: true },
)

watch(
  localProfile,
  (newProfile) => {
    console.log('更新考试信息', newProfile)
    emit('update:profile', newProfile)
  },
  { deep: true },
)
</script>
