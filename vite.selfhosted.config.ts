import {defineConfig} from 'vite';
import react from '@vitejs/plugin-react';
export default defineConfig({plugins:[react()],publicDir:'public',build:{outDir:'dist-selfhosted',emptyOutDir:true,rollupOptions:{input:'standalone/index.html'}}});
