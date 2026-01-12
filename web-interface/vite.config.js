import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    allowedHosts: ['localhost', '127.0.0.1', '0.0.0.0', '192.168.1.100', '0447ba843dc9.ngrok-free.app']
  }
})