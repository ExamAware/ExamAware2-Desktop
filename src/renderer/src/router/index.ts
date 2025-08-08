import { createRouter, createWebHashHistory } from 'vue-router'
import EditorView from '../views/EditorView.vue'
import HomeView from '@renderer/views/HomeView.vue'
import MainpageView from '@renderer/views/home/MainpageView.vue'
import PluginView from '@renderer/views/home/PluginView.vue'
import PlayerHomeView from '@renderer/views/home/PlayerHomeView.vue'
import ntpSettingsPage from '@renderer/views/home/ntpSettingsPage.vue'
import PluginManager from '@renderer/components/PluginManager.vue'
import PluginDevPanel from '@renderer/components/PluginDevPanel.vue'

const router = createRouter({
  history: createWebHashHistory(),
  routes: [
    {
      path: '/',
      name: 'home',
      component: HomeView,
      children: [
        {
          path: 'mainpage',
          name: 'mainpage',
          component: MainpageView,
        },
        {
          path: 'playerhome',
          name: 'playerhome',
          component: PlayerHomeView,
        },
        {
          path: 'pluginpage',
          name: 'pluginpage',
          component: PluginView,
        },
        {
          path: 'ntpsettings',
          name: 'ntpsettings',
          component: ntpSettingsPage,
        },
        {
          path: 'plugin-manager',
          name: 'plugin-manager',
          component: PluginManager,
        },
        {
          path: 'plugin-dev',
          name: 'plugin-dev',
          component: PluginDevPanel,
        }
      ],
    },
    {
      path: '/editor',
      name: 'editor',
      component: EditorView,
    },
    {
      path: '/playerview',
      name: 'playerview',
      component: () => import('../views/PlayerView.vue'),
    }
  ],
})

export default router
