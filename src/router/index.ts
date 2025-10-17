import { createRouter, createWebHistory } from 'vue-router'
import TopPage from '../views/TopPage.vue'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/',
      name: 'top',
      component: TopPage
    }
  ]
})

export default router