import { defineConfig } from 'vite';
import basicSsl from '@vitejs/plugin-basic-ssl';

const httpsRedirectPlugin = () => ({
  name: 'https-redirect',
  configureServer(server) {
    server.middlewares.use((req, res, next) => {
      if (req.headers['x-forwarded-proto'] === 'http' ||
          (!req.socket.encrypted && req.headers.host)) {
        const httpsUrl = `https://${req.headers.host}${req.url}`;
        res.writeHead(301, { Location: httpsUrl });
        res.end();
        return;
      }
      next();
    });
  }
});

export default defineConfig({
  plugins: [basicSsl(), httpsRedirectPlugin()],
  server: {
    port: 3000,
    host: true,
    https: true
  },
  build: {
    outDir: 'dist'
  }
});
