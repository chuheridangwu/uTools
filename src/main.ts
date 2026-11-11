import { createApp } from 'vue'
import { createPinia } from 'pinia'
import 'element-plus/theme-chalk/dark/css-vars.css'
import './styles/index.css'
import './styles/desktop-pages.css'
import App from './App.vue'
import router from './router'

const app = createApp(App)

app.use(createPinia())
app.use(router)
// Element Plus 已改为按需引入(见 vite.config.ts),语言包由 App.vue 的 el-config-provider 提供

app.mount('#app')
