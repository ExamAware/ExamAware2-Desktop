import 'misans/lib/Normal/MiSans-Normal.min.css'
// import 'misans/lib/Normal/MiSans-Thin.min.css'
// import 'misans/lib/Normal/MiSans-Semibold.min.css'

import './assets/main.css'

import { createApp } from 'vue'
import { createPinia } from 'pinia'

import App from './App.vue'
import router from './router'

import 'vue-code-layout/lib/vue-code-layout.css'
import CodeLayout from 'vue-code-layout'

// import TDesign from 'tdesign-vue-next'
import 'tdesign-vue-next/es/style/index.css'

const app = createApp(App)

app.use(createPinia())
app.use(router)
app.use(CodeLayout)
// app.use(TDesign)

document.documentElement.setAttribute('theme-mode', 'dark')

app.mount('#app')
