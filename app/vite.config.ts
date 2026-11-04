import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  // относительные пути: сайт работает и локально, и на GitHub Pages в подпапке /vocal-trainer/
  base: './',
})
