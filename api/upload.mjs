import { handleUpload } from '@vercel/blob/client';
import { del } from '@vercel/blob';

export default async function handler(req, res) {
  try {
    if (req.method === 'DELETE') {
      const url = req.query.url;
      if (!url || !/\.public\.blob\.vercel-storage\.com\//.test(url)) {
        return res.status(400).json({ error: 'Invalid blob URL' });
      }
      await del(url);
      return res.status(200).json({ ok: true });
    }

    if (req.method !== 'POST') {
      res.setHeader('Allow', 'POST, DELETE');
      return res.status(405).json({ error: 'Method not allowed' });
    }

    const json = await handleUpload({
      body: req.body,
      request: req,
      onBeforeGenerateToken: async () => ({
        allowedContentTypes: ['video/*', 'image/*'],
        maximumSizeInBytes: 10 * 1024 * 1024 * 1024,
        addRandomSuffix: true
      }),
      onUploadCompleted: async () => {}
    });
    return res.status(200).json(json);
  } catch (err) {
    return res.status(400).json({ error: err.message });
  }
}
