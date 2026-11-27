import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  // 师傅端 App 里用的是手机自带的网页组件，华为等手机上版本可能偏旧，所以编译到较老的浏览器也能跑的写法
  build: { target: ['chrome80', 'safari13'] },
})
