import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig(({ mode }) => {
  // Load environment variables from the project root .env
  const env = loadEnv(mode, path.resolve(__dirname, '..'), '');
  const targetBackend = env.VITE_API_URL || 'http://localhost:5000';

  return {
    // Read the single root .env file
    envDir: path.resolve(__dirname, '..'),
    plugins: [react()],
    server: {
      port: 5173,
      proxy: {
        '/api': {
          target: targetBackend,
          changeOrigin: true,
        },
        '/socket.io': {
          target: targetBackend,
          ws: true,
        },
      },
    },
  };
});
