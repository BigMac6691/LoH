import { defineConfig } from 'vite';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// HTTPS Configuration - Use same certificates as backend
const certPath = path.resolve(__dirname, '..'); // Project root (one level up from frontend/)
const keyFile = path.join(certPath, 'localhost+1-key.pem');
const certFile = path.join(certPath, 'localhost+1.pem');

// Check if certificates exist, if so enable HTTPS
let httpsConfig = undefined;
if (fs.existsSync(keyFile) && fs.existsSync(certFile)) {
  httpsConfig = {
    key: fs.readFileSync(keyFile),
    cert: fs.readFileSync(certFile)
  };
  console.log('🔒 Frontend: HTTPS enabled with certificates');
} else {
  console.warn('⚠️  Frontend: Certificate files not found, using HTTP');
  console.warn(`   Expected: ${keyFile} and ${certFile}`);
}

export default defineConfig({
  root: '.',
  publicDir: 'public',
  build: {
    outDir: '../dist',
    emptyOutDir: true
  },
  server: {
    port: 5173,
    host: true,
    open: httpsConfig ? 'https://localhost:5173' : true, // Force HTTPS URL when HTTPS is enabled
    https: httpsConfig, // Enable HTTPS if certificates are available
    proxy: {
      '/api': {
        target: 'https://localhost:3000',
        changeOrigin: true,
        secure: false, // Allow self-signed certificates
        ws: true // Enable WebSocket proxy if needed
      }
    }
  },
  preview: {
    port: 4173,
    host: true
  }
}); 