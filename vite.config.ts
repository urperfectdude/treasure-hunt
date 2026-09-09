import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { defineConfig } from 'vite'

// GitHub Pages serves the repo at /<repo-name>/, so the production build
// needs a matching base path; local dev serves from '/'. Override the repo
// name here if this project is ever renamed or forked.
export default defineConfig(({ command }) => ({
  base: command === 'build' ? '/treasure-hunt/' : '/',
  plugins: [react(), tailwindcss()],
}))
