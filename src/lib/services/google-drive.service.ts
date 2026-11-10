import { randomUUID } from "node:crypto";
import { googleDrive } from "@/lib/server/googleDrive";

export class GoogleDriveService {
  async uploadFile(buffer: Buffer, name: string, mimeType: string, folderId: string): Promise<string> {
    const result = await googleDrive.upload({ buffer, name, mimeType, purpose: "attachments", primaryParent: folderId, publicRead: true });
    return result.url;
  }

  async uploadPropertyImages(images: Array<{ buffer: Buffer; name: string; mimeType: string }>, kota: string, alamat: string, coverIndex?: number): Promise<string[]> {
    const uploaded: Array<{ fileId: string; url: string }> = [];
    try {
      for (const image of images) {
        uploaded.push(await googleDrive.upload({ buffer: image.buffer,
          name: `${Date.now()}_${randomUUID()}_${image.name}`, mimeType: image.mimeType,
          purpose: "properties", folders: [kota, alamat], publicRead: true }));
      }
    } catch (error) {
      // These files have not been handed to the caller/database yet.
      await Promise.allSettled(uploaded.map(file => googleDrive.deleteFile(file.fileId)));
      throw error;
    }
    if (coverIndex !== undefined && coverIndex >= 0 && coverIndex < uploaded.length) {
      const [cover] = uploaded.splice(coverIndex, 1);
      uploaded.unshift(cover);
    }
    return uploaded.map(file => file.url);
  }

  getFileInfo(fileId: string) { return googleDrive.getFileInfo(fileId); }
  deleteFile(fileId: string) { return googleDrive.deleteFile(fileId); }
}
