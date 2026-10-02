import { handleUpload } from '@vercel/blob/client';
import { del } from '@vercel/blob';

export default async function handler(req, res) {
  try {
    if (req.method === 'POST') {
      let body = req.body;
      if (typeof body === 'string') {
        try { body = JSON.parse(body || '{}'); } catch { body = {}; }
      }
      if (!body || typeof body !== 'object') body = {};

      if (!body.type || !body.payload) {
        return res.status(400).json({ error: 'Invalid upload request body' });
      }

      const jsonResponse = await handleUpload({
        body,
        request: req,
        onBeforeGenerateToken: async (pathname) => {
          return {
            allowedContentTypes: [
              'image/jpeg', 'image/png', 'image/webp', 'image/gif',
              'video/mp4', 'video/quicktime', 'video/webm',
              'video/x-matroska', 'video/ogg'
            ],
            maximumSizeInBytes: 10 * 1024 * 1024 * 1024,
            addRandomSuffix: true,
          };
        },
        onUploadCompleted: async ({ blob, tokenPayload }) => {
          console.log('✅ Blob upload completed:', blob.url);
        },
      });

      return res.status(200).json(jsonResponse);
    }

    if (req.method === 'DELETE') {
      const url = req.query.url;
      if (!url || typeof url !== 'string') {
        return res.status(400).json({ error: 'Missing url query param' });
      }
      await del(url);
      return res.status(200).json({ ok: true });
    }

    res.setHeader('Allow', ['POST', 'DELETE']);
    return res.status(405).json({ error: 'Method not allowed' });
  } catch (err) {
    console.error('upload.js error:', err);

    const msg = String(err?.message || err || 'Upload failed');
    if (msg.includes('BLOB_READ_WRITE_TOKEN')) {
      return res.status(500).json({
        error: 'Server is missing BLOB_READ_WRITE_TOKEN. Connect a Blob store to this project in the Vercel dashboard.',
      });
    }
    if (msg.toLowerCase().includes('cannot be reached') || msg.toLowerCase().includes('localhost')) {
      return res.status(500).json({
        error: 'Vercel Blob cannot call back to localhost. Test uploads on your deployed URL.',
      });
    }

    return res.status(500).json({ error: msg });
  }
}
