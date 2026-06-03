import { readFile } from 'fs/promises';
import { join } from 'path';

export async function GET() {
  const filePath = join(process.cwd(), 'public', 'dictionary.json');
  const data = await readFile(filePath, 'utf-8');
  return new Response(data, {
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'public, max-age=86400',
    },
  });
}
