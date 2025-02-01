<script setup lang="ts">
import {
  type CodeLayoutConfig,
  type CodeLayoutInstance,
  defaultCodeLayoutConfig,
} from 'vue-code-layout'
import { ref, reactive, h, onMounted, nextTick } from 'vue'
import { FileIcon, SearchIcon, InfoCircleIcon, AddIcon } from 'tdesign-icons-vue-next'
import SideExamsPanel from '@renderer/components/SideExamsPanel.vue'
import type { Component } from 'vue'
import type { ExamConfig } from '@renderer/core/configTypes'
import type { MenuOptions } from '@imengyu/vue3-context-menu'
import { parseExamConfig, getSortedExamInfos } from '@renderer/core/parser'
import AboutDialog from '@renderer/components/AboutDialog.vue'
import SideExamInfoPanel from '@renderer/components/SideExamInfoPanel.vue'

// 配置 CodeLayout 的默认设置
const config = reactive<CodeLayoutConfig>({
  ...defaultCodeLayoutConfig,
  primarySideBarSwitchWithActivityBar: true,
  primarySideBarPosition: 'left',
  bottomAlignment: 'center',
  titleBar: true,
  titleBarShowCustomizeLayout: true,
  activityBar: true,
  primarySideBar: true,
  secondarySideBar: false,
  bottomPanel: true,
  statusBar: true,
  menuBar: true,
  bottomPanelMaximize: false,
})

// 定义 ref 和 reactive 变量
const codeLayout = ref<CodeLayoutInstance>()
const showAboutDialog = ref(false)
const windowTitle = ref('ExamAware Editor')
const eaProfile = reactive<ExamConfig>({
  examName: '未命名考试',
  message: '考试信息',
  room: '114考场',
  examInfos: [],
})
const currentExamIndex = ref<number | null>(null)

// 定义面板组件
const panelComponents: Record<string, Component> = {
  'explorer.examlist': SideExamsPanel,
  'explorer.examinfo': SideExamInfoPanel,
}

// 处理配置文件上传
function handleConfigFileUpload(file: File) {
  const reader = new FileReader()
  reader.onload = () => {
    const result = reader.result?.toString() || ''
    const parsed = parseExamConfig(result)
    if (parsed) {
      Object.assign(eaProfile, {
        examName: parsed.examName,
        message: parsed.message,
        room: parsed.room,
        examInfos: parsed.examInfos,
      })
      saveProfileToLocalStorage()
    }
  }
  reader.readAsText(file)
}

// 加载布局
function loadLayout() {
  if (codeLayout.value) {
    const groupExplorer = codeLayout.value.addGroup(
      {
        title: 'Explorer',
        tooltip: 'Explorer',
        name: 'explorer',
        badge: '2',
        iconLarge: () => h(FileIcon, { size: '16pt' }),
      },
      'primarySideBar',
    )

    groupExplorer.addPanel({
      title: '考试列表',
      tooltip: 'vue-code-layout',
      name: 'explorer.examlist',
      noHide: true,
      startOpen: true,
      iconLarge: () => h(FileIcon, { size: '16pt' }),
      iconSmall: () => h(FileIcon),
      actions: [
        {
          name: 'add-exam',
          icon: () => h(AddIcon),
          onClick() {
            const now = new Date()
            const lastExam = eaProfile.examInfos[eaProfile.examInfos.length - 1]
            const start = lastExam ? new Date(new Date(lastExam.end).getTime() + 10 * 60000) : now
            const end = new Date(start.getTime() + 60 * 60000)
            eaProfile.examInfos.push({
              name: '未命名考试' + (eaProfile.examInfos.length + 1),
              start: start.toISOString(),
              end: end.toISOString(),
              alertTime: 15,
            })
            currentExamIndex.value = eaProfile.examInfos.length - 1
            saveProfileToLocalStorage()
          },
        },
      ],
    })

    groupExplorer.addPanel({
      title: '考试信息',
      tooltip: 'Exam info',
      name: 'explorer.examinfo',
      noHide: true,
      startOpen: true,
      iconSmall: () => h(InfoCircleIcon),
      iconLarge: () => h(InfoCircleIcon, { size: '16pt' }),
    })
  }
}

// 获取面板组件
function getPanelComponent(name: string) {
  return panelComponents[name] || 'div'
}

// 处理切换考试信息
function handleSwitchExamInfo(payload: { examId: number }) {
  currentExamIndex.value = payload.examId
  const examInfo = eaProfile.examInfos[payload.examId]
  if (examInfo) {
    console.log('切换到考试信息:', examInfo)
  }
}

// 关闭关于对话框
function closeAboutDialog() {
  showAboutDialog.value = false
}

// 定义菜单数据
const menuData: MenuOptions = {
  x: 0,
  y: 0,
  items: [
    {
      label: '文件',
      children: [
        {
          label: '新建',
          onClick: () => {
            eaProfile.examName = '未命名考试'
            eaProfile.message = '考试信息'
            eaProfile.room = '114考场'
            currentExamIndex.value = null
            eaProfile.examInfos = []
            saveProfileToLocalStorage()
          },
        },
        {
          label: '打开...',
          onClick: () => {
            const input = document.createElement('input')
            input.type = 'file'
            input.accept = '.json'
            input.onchange = (e) => {
              const files = (e.target as HTMLInputElement).files
              if (files && files.length > 0) {
                handleConfigFileUpload(files[0])
              }
            }
            input.click()
          },
        },
        {
          label: '另存为...',
          divided: true,
          onClick: () => {
            const blob = new Blob([JSON.stringify(getSortedExamInfos(eaProfile))], {
              type: 'application/json',
            })
            const url = URL.createObjectURL(blob)
            const a = document.createElement('a')
            a.href = url
            a.download = 'exam.json'
            a.click()
            URL.revokeObjectURL(url)
          },
        },
      ],
    },
    {
      label: '放映',
      children: [{ label: '开始全屏放映' }],
    },
    {
      label: '帮助',
      children: [
        {
          label: 'Github',
          onClick: () => {
            window.open('https://github.com/ExamAware/')
          },
        },
        {
          label: '关于 DSZ知试',
          onClick: () => {
            showAboutDialog.value = true
          },
        },
      ],
    },
  ],
  zIndex: 3,
  minWidth: 230,
}

// 更新配置文件
function updateProfile(newProfile: ExamConfig) {
  eaProfile.examName = newProfile.examName
  eaProfile.message = newProfile.message
  eaProfile.room = newProfile.room
  eaProfile.examInfos = newProfile.examInfos
  saveProfileToLocalStorage()
}

// 保存配置文件到本地存储
function saveProfileToLocalStorage() {
  localStorage.setItem('eaProfile', JSON.stringify(eaProfile))
}

// 从本地存储加载配置文件
function loadProfileFromLocalStorage() {
  const storedProfile = localStorage.getItem('eaProfile')
  if (storedProfile) {
    const parsedProfile = JSON.parse(storedProfile) as ExamConfig
    Object.assign(eaProfile, parsedProfile)
  }
}

// 组件挂载时加载布局和配置文件
onMounted(() => {
  nextTick(() => {
    loadLayout()
    loadProfileFromLocalStorage()
  })
})
</script>

<template>
  <CodeLayout ref="codeLayout" :layout-config="config" :mainMenuConfig="menuData">
    <template #statusBar></template>
    <template #panelRender="{ panel }">
      <component
        :is="getPanelComponent(panel.name)"
        :profile="eaProfile"
        @switch-exam-info="handleSwitchExamInfo"
        @update:profile="updateProfile"
      />
    </template>
    <template #titleBarIcon>
      <img src="@renderer/assets/logo.svg" style="margin: 10px" alt="logo" width="25px" />
    </template>
    <template #titleBarCenter>
      <span>{{ windowTitle }}</span>
    </template>
    <template #centerArea>
      <div style="padding: 20px">
        <p v-if="currentExamIndex === null">
          请从左侧的考试列表中选择一个考试进行编辑。如果列表中没有考试，请先添加一个考试。
        </p>
        <div v-else>
          <t-form labelAlign="top">
            <t-form-item label="考试名称" name="examName">
              <t-input v-model="eaProfile.examInfos[currentExamIndex].name"></t-input>
            </t-form-item>
            <t-form-item label="开始时间" name="start">
              <t-date-picker
                enable-time-picker
                allow-input
                clearable
                v-model="eaProfile.examInfos[currentExamIndex].start"
              />
            </t-form-item>
            <t-form-item label="结束时间" name="end">
              <t-date-picker
                enable-time-picker
                allow-input
                clearable
                v-model="eaProfile.examInfos[currentExamIndex].end"
              />
            </t-form-item>
            <t-form-item label="考试结束提醒时间" name="alertTime">
              <t-input-number
                v-model="eaProfile.examInfos[currentExamIndex].alertTime"
                suffix="分钟"
                style="width: 200px"
                :min="5"
              />
            </t-form-item>
          </t-form>
        </div>
      </div>
    </template>
  </CodeLayout>
  <AboutDialog :visible="showAboutDialog" @update:closedialog="closeAboutDialog" />
</template>

