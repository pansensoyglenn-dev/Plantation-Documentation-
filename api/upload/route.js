import { handleUpload } from '@vercel/blob/client';

export async function POST(request) {
  const body = await request.json();
  const jsonResponse = await handleUpload({
    body,
    request,
    onBeforeGenerateToken: async (pathname) => {
      return {
        allowedContentTypes: ['video/*', 'image/*'],
        maximumSizeInBytes: 10 * 1024 * 1024 * 1024, // 10 GB
      };
    },
  });
  return Response.json(jsonResponse);
}
