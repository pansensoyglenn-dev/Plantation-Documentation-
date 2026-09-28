import { handleUpload, del } from '@vercel/blob';

export default async function handler(req, res) {
  try {
    if (req.method === 'POST') {
      const body = req.body && typeof req.body === 'object'
        ? req.body
        : JSON.parse(req.body || '{}');

      const jsonResponse = await handleUpload({
        body,
        request: req,
        onBeforeGenerateToken: async (pathname) => {
          return {
            allowedContentTypes: [
              'image/jpeg', 'image/png', 'image/webp', 'image/gif',
              'video/mp4', 'video/quicktime', 'video/webm', 'video/x-matroska',
              'video/ogg'
            ],
            maximumSizeInBytes: 10 * 1024 * 1024 * 1024,
            addRandomSuffix: true
          };
        },
        onUploadCompleted: async ({ blob, tokenPayload }) => {
          console.log('Blob upload completed:', blob.url);
        }
      });

      return res.status(200).json(jsonResponse);
    }

    if (req.method === 'DELETE') {
      const url = req.query.url;
      if (!url) return res.status(400).json({ error: 'Missing url query param' });
      await del(url);
      return res.status(200).json({ ok: true });
    }

    res.setHeader('Allow', 'POST, DELETE');
    return res.status(405).json({ error: 'Method not allowed' });
  } catch (err) {
    console.error('upload.js error:', err);
    return res.status(500).json({ error: err.message || 'Upload failed' });
  }
}
