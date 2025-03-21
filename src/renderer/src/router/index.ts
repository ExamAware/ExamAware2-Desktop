import { createRouter, createWebHashHistory } from 'vue-router'
import EditorView from '../views/EditorView.vue'
import HomeView from '@renderer/views/HomeView.vue'
import MainpageView from '@renderer/views/home/MainpageView.vue'
import PluginView from '@renderer/views/home/PluginView.vue'
import PlayerHomeView from '@renderer/views/home/PlayerHomeView.vue'

const router = createRouter({
  history: createWebHashHistory(import.meta.env.BASE_URL),
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
