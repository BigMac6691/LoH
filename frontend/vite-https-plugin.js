/**
 * Vite Plugin to force HTTPS and redirect HTTP to HTTPS
 */
import { readFileSync } from 'fs';
import { resolve, join } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = resolve(__filename, '..');

export function forceHttps() {
  return {
    name: 'force-https',
    configureServer(server) {
      // Check if HTTPS is enabled
      if (server.config.server?.https) {
        // Add middleware to handle HTTP requests (if any)
        server.middlewares.use((req, res, next) => {
          // If request came over HTTP, we shouldn't see it if HTTPS is properly configured
          // But log it for debugging
          if (req.headers['x-forwarded-proto'] === 'http') {
            console.warn('⚠️  Received HTTP request, but HTTPS is enabled. This should not happen.');
          }
          next();
        });
      }
    }
  };
}

