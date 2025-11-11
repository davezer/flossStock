import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';


/** @type {import('vite').UserConfig} */
export default defineConfig({
  plugins: [sveltekit()],
  server: {
    port: 5173,
    strictPort: true,
    proxy: {
      // forward all SvelteKit API routes to wrangler pages dev
      '/api': 'http://127.0.0.1:8788'
    }
  },

  // prevent prebundling issues in dev
  optimizeDeps: {
    exclude: ['lucia', '@lucia-auth/adapter-sqlite']
  },
  // ensure SSR bundler includes these packages instead of trying to externalize weirdly
  ssr: {
    noExternal: ['lucia', '@lucia-auth/adapter-sqlite']
  },
  build: {
  rollupOptions: {
    external: ['lucia/middleware']
  }
}

});
