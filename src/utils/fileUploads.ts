import fs from 'fs';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';

export function handleBase64ImageUpload(base64Image: string, uploadSubFolder = ''): string {
  if (!base64Image.startsWith('data:image/')) {
    throw new Error('Invalid image format');
  }

  const matches = base64Image.match(/^data:image\/([a-zA-Z]+);base64,(.+)$/);
  if (!matches || matches.length !== 3) {
    throw new Error('Malformed base64 image string');
  }

  const extension = matches[1];
  const base64Data = matches[2];
  const fileName = `${uuidv4()}.${extension}`;

  const uploadDir = path.join(__dirname, '../../uploads', uploadSubFolder);
  if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
  }

  const filePath = path.join(uploadDir, fileName);
  fs.writeFileSync(filePath, base64Data, { encoding: 'base64' });

  return filePath;
}
