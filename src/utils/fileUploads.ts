import { v2 as cloudinary, UploadApiResponse, UploadApiErrorResponse, DeleteApiResponse } from 'cloudinary';
import { v4 as uuidv4 } from 'uuid';

type CloudinaryResourceType = 'image' | 'video' | 'raw' | 'auto';

interface UploadOptions {
  folder?: string;
  resourceType?: CloudinaryResourceType;
  transformation?: any;
  overwrite?: boolean;
  tags?: string[];
}

interface DeleteOptions {
  resourceType?: CloudinaryResourceType;
  invalidate?: boolean;
}

class CloudinaryService {
  constructor() {
    this.configure();
  }

  private configure(): void {
    cloudinary.config({
      cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
      api_key: process.env.CLOUDINARY_API_KEY,
      api_secret: process.env.CLOUDINARY_API_SECRET,
      secure: true,
    });
  }

  /**
   * Upload a base64 encoded image to Cloudinary
   * @param base64Data The base64 encoded image data
   * @param options Upload options
   * @returns Promise with the secure URL of the uploaded image
   */
  public async uploadBase64Image(
    base64Data: string,
    options: UploadOptions = {}
  ): Promise<string> {
    this.validateBase64Image(base64Data);

    const { extension, data } = this.extractBase64Data(base64Data);
    const publicId = options.folder 
      ? `${options.folder}/${uuidv4()}.${extension}` 
      : `${uuidv4()}.${extension}`;

    try {
      const result = await cloudinary.uploader.upload(
        `data:image/${extension};base64,${data}`,
        {
          public_id: publicId,
          resource_type: options.resourceType || 'image',
          transformation: options.transformation,
          overwrite: options.overwrite,
          tags: options.tags,
        }
      );

      return result.secure_url;
    } catch (error) {
      this.handleUploadError(error as UploadApiErrorResponse);
    }
  }

  /**
   * Extract extension and data from base64 string
   * @param base64Data The base64 encoded image data
   * @returns Object with extension and data
   */
  private extractBase64Data(base64Data: string): { extension: string; data: string } {
    const matches = base64Data.match(/^data:image\/([a-zA-Z]+);base64,(.+)$/)!;
    return {
      extension: matches[1].toLowerCase(), // Ensure lowercase extension
      data: matches[2],
    };
  }

  /**
   * Upload a file to Cloudinary
   * @param filePath Path to the file to upload
   * @param options Upload options
   * @returns Promise with the secure URL of the uploaded file
   */
  public async uploadFile(
    filePath: string,
    options: UploadOptions = {}
  ): Promise<string> {
    try {
      const result = await cloudinary.uploader.upload(filePath, {
        folder: options.folder,
        resource_type: options.resourceType,
        transformation: options.transformation,
        overwrite: options.overwrite,
        tags: options.tags,
      });

      return result.secure_url;
    } catch (error) {
      this.handleUploadError(error as UploadApiErrorResponse);
    }
  }

  /**
   * Delete a file from Cloudinary
   * @param publicId The public ID of the file to delete
   * @param options Delete options
   * @returns Promise with the deletion result
   */
  public async deleteFile(
    publicId: string,
    options: DeleteOptions = {}
  ): Promise<DeleteApiResponse> {
    try {
      return await cloudinary.uploader.destroy(publicId, {
        resource_type: options.resourceType || 'image',
        invalidate: options.invalidate,
      });
    } catch (error) {
      throw new Error(`Failed to delete file: ${(error as Error).message}`);
    }
  }

  /**
   * Delete a file by URL from Cloudinary
   * @param url The URL of the file to delete
   * @param options Delete options
   * @returns Promise with the deletion result
   */
  public async deleteFileByUrl(
    url: string,
    options: DeleteOptions = {}
  ): Promise<DeleteApiResponse> {
    const publicId = this.extractPublicIdFromUrl(url);
    return this.deleteFile(publicId, options);
  }

  /**
   * Generate a signed upload URL for client-side uploads
   * @param folder The folder to upload to
   * @param resourceType The type of resource to upload
   * @returns Object containing the upload URL and signature data
   */
  public generateSignedUploadUrl(
    folder: string,
    resourceType: CloudinaryResourceType = 'image'
  ): { url: string; signature: string; timestamp: number; apiKey: string } {
    const timestamp = Math.round(new Date().getTime() / 1000);
    const signature = cloudinary.utils.api_sign_request(
      {
        timestamp,
        folder,
        resource_type: resourceType,
      },
      process.env.CLOUDINARY_API_SECRET!
    );

    return {
      url: `https://api.cloudinary.com/v1_1/${process.env.CLOUDINARY_CLOUD_NAME}/${resourceType}/upload`,
      signature,
      timestamp,
      apiKey: process.env.CLOUDINARY_API_KEY!,
    };
  }

  /**
   * Extract the public ID from a Cloudinary URL
   * @param url The Cloudinary URL
   * @returns The public ID
   */
  private extractPublicIdFromUrl(url: string): string {
    const matches = url.match(/upload\/(?:v\d+\/)?([^\.]+)/);
    if (!matches || matches.length < 2) {
      throw new Error('Invalid Cloudinary URL');
    }
    return matches[1];
  }

  /**
   * Validate base64 image data
   * @param base64Data The base64 encoded image data
   */
  private validateBase64Image(base64Data: string): void {
    if (!base64Data.startsWith('data:image/')) {
      throw new Error('Invalid image format. Only image files are supported.');
    }

    const matches = base64Data.match(/^data:image\/([a-zA-Z]+);base64,(.+)$/);
    if (!matches || matches.length !== 3) {
      throw new Error('Malformed base64 image string');
    }
  }

  /**
   * Handle upload errors
   * @param error The upload error
   */
  private handleUploadError(error: UploadApiErrorResponse): never {
    if (error.message) {
      throw new Error(`Cloudinary upload failed: ${error.message}`);
    }
    throw new Error('Unknown Cloudinary upload error');
  }
}

export default new CloudinaryService();