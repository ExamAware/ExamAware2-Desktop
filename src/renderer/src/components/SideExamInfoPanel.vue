<template>
  <div class="exam_info_editor">
    <t-form labelAlign="top">
      <t-form-item label="考试名称" name="examName">
        <t-input v-model="localProfile.examName"></t-input>
      </t-form-item>
      <t-form-item label="考试信息" name="message">
        <t-input v-model="localProfile.message"></t-input>
      </t-form-item>
    </t-form>
  </div>
</template>

<script setup lang="ts">
import { defineProps, defineEmits, watch, ref } from 'vue'
import type { ExamConfig } from '@renderer/core/configTypes'

const props = defineProps({
  profile: Object as () => ExamConfig,
})

const emit = defineEmits(['update:profile'])

const localProfile = ref({ ...props.profile })

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

<style scoped>
.exam_info_editor {
  padding: 20px;
  overflow: auto;
}
</style>
