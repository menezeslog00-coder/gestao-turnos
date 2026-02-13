
import { defineConfig } from 'vite';

export default defineConfig({
  define: {
    // Injeta a API_KEY do ambiente para que o process.env.API_KEY funcione no navegador
    'process.env.API_KEY': JSON.stringify(process.env.API_KEY),
  },
  server: {
    historyApiFallback: true,
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    rollupOptions: {
      external: [
        'react',
        'react-dom',
        'lucide-react',
        '@google/genai',
        '@tanstack/react-query',
        'zod',
        'react-hook-form',
        '@hookform/resolvers/zod',
        'sonner',
        'clsx',
        'tailwind-merge'
      ],
      output: {
        globals: {
          'react': 'React',
          'react-dom': 'ReactDOM',
        },
      },
    },
  },
});
