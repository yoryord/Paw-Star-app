import { defineConfig } from 'vite';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const parseJsonBody = async (req) => {
  const chunks = [];
  for await (const chunk of req) {
    chunks.push(chunk);
  }

  const raw = Buffer.concat(chunks).toString('utf8');
  return JSON.parse(raw || '{}');
};

const profileUploadPlugin = () => ({
  name: 'paw-star-profile-upload',
  configureServer(server) {
    server.middlewares.use('/api/profile-photo-upload', async (req, res) => {
      if (req.method !== 'POST') {
        res.statusCode = 405;
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({ error: 'Method not allowed.' }));
        return;
      }

      try {
        const { userId, fileName, mimeType, contentBase64 } = await parseJsonBody(req);

        if (!userId || !fileName || !mimeType || !contentBase64) {
          res.statusCode = 400;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ error: 'Missing upload data.' }));
          return;
        }

        const allowedMime = new Set([
          'image/jpeg',
          'image/png',
          'image/webp',
          'image/gif',
          'image/avif',
        ]);

        if (!allowedMime.has(mimeType)) {
          res.statusCode = 400;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ error: 'Unsupported file type.' }));
          return;
        }

        const uploadDir = path.resolve(__dirname, 'images_temp', 'profiles');
        await fs.mkdir(uploadDir, { recursive: true });

        const ext = path.extname(fileName).toLowerCase() || '.jpg';
        const safeUserId = String(userId).replace(/[^a-zA-Z0-9_-]/g, '');
        const timestamp = Date.now();
        const generatedName = `${safeUserId}-${timestamp}${ext}`;
        const targetPath = path.join(uploadDir, generatedName);

        const buffer = Buffer.from(contentBase64, 'base64');
        await fs.writeFile(targetPath, buffer);

        res.statusCode = 200;
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({
          filePath: `/images_temp/profiles/${generatedName}`,
        }));
      } catch {
        res.statusCode = 500;
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({ error: 'Upload failed.' }));
      }
    });
  },
});

export default defineConfig({
  plugins: [profileUploadPlugin()],
  server: {
    port: 5173,
    strictPort: true
  }
});
