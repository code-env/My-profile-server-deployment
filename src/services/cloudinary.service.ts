import { v2 as cloudinary, UploadApiResponse, UploadApiErrorResponse, DeleteApiResponse } from 'cloudinary';
import { v4 as uuidv4 } from 'uuid';

type CloudinaryResourceType = 'image' | 'video' | 'raw' | 'auto';

interface UploadOptions {
    folder?: string;
    resourceType?: CloudinaryResourceType;
    transformation?: any;
    overwrite?: boolean;
    tags?: string[];
    format?: string;
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
            timeout: 120000, // 2 minutes timeout
        });
    }

    // ==================== UNIVERSAL METHODS ====================

    /**
     * Upload any file type from base64 or path
     */
    public async upload(
        fileData: string | Buffer,
        options: UploadOptions = {}
    ): Promise<string> {
        try {
            const uploadOptions = {
                folder: options.folder,
                resource_type: options.resourceType || this.detectResourceType(fileData),
                transformation: options.transformation,
                overwrite: options.overwrite,
                tags: options.tags,
                timeout: 120000, // 2 minutes timeout
            };

            const file = Buffer.isBuffer(fileData) ? `data:application/octet-stream;base64,${fileData.toString('base64')}` : fileData;
            const result = await cloudinary.uploader.upload(file, uploadOptions);
            return result.secure_url;
        } catch (error) {
            this.handleUploadError(error as UploadApiErrorResponse);
        }
    }

    public async uploadAndReturnAllInfo(
        fileData: string | Buffer,
        options: UploadOptions = {},
        retryCount: number = 0
    ): Promise<UploadApiResponse> {
        const maxRetries = 3;
        
        try {
            console.log('Uploading file with options:', options);
            const uploadOptions = {
                folder: options.folder,
                resource_type: options.resourceType || this.detectResourceType(fileData),
                transformation: options.transformation,
                overwrite: options.overwrite,
                tags: options.tags,
                timeout: 120000, // 2 minutes timeout
            };

            console.log('Uploading file with options:', uploadOptions);
            const file = Buffer.isBuffer(fileData) ? `data:application/octet-stream;base64,${fileData.toString('base64')}` : fileData;
            return await cloudinary.uploader.upload(file, uploadOptions);
        } catch (error) {
            const uploadError = error as UploadApiErrorResponse;
            
            // Retry on timeout errors
            if ((uploadError.error?.name === 'TimeoutError' || uploadError.error?.http_code === 499) && retryCount < maxRetries) {
                console.log(`Upload timeout, retrying... (attempt ${retryCount + 1}/${maxRetries})`);
                await new Promise(resolve => setTimeout(resolve, 1000 * (retryCount + 1))); // Progressive delay
                return this.uploadAndReturnAllInfo(fileData, options, retryCount + 1);
            }
            
            this.handleUploadError(uploadError);
        }
    }

    /**
  * Delete any file type by URL or public ID
  */
    public async delete(
        identifier: string,
        options: DeleteOptions = {}
    ): Promise<DeleteApiResponse> {
        try {
            const publicId = identifier.includes('http')
                ? this.extractPublicIdFromUrl(identifier)
                : identifier;

            // Determine resource type from the URL if not provided
            let resourceType = options.resourceType;
            if (!resourceType && identifier.includes('http')) {
                resourceType = this.getResourceTypeFromUrl(identifier) as CloudinaryResourceType;
            }

            return await cloudinary.uploader.destroy(publicId, {
                resource_type: resourceType || 'image', // default to 'image' if not specified
                invalidate: options.invalidate,
            });
        } catch (error) {
            throw new Error(`Failed to delete file: ${(error as Error).message}`);
        }
    }

    /**
     * Extract resource type from Cloudinary URL
     */
    private getResourceTypeFromUrl(url: string): string {
        const parts = url.split('/');
        const uploadIndex = parts.indexOf('upload');

        if (uploadIndex !== -1 && uploadIndex + 1 < parts.length) {
            const resourceType = parts[uploadIndex + 1];
            // Cloudinary accepts these resource types for deletion
            if (['image', 'video', 'raw', 'auto'].includes(resourceType)) {
                return resourceType === 'auto' ? 'image' : resourceType;
            }
        }

        return 'image'; // default to image
    }

    // ==================== TYPE-SPECIFIC UPLOAD METHODS ====================

    /**
     * Upload image (supports JPG, PNG, WebP, GIF, etc.)
     */
    public async uploadImage(
        fileData: string | Express.Multer.File,
        options: UploadOptions = {}
    ): Promise<UploadApiResponse> {
        if (typeof fileData === 'string') {
            this.validateBase64Data(fileData, 'image');
            const { data, extension } = this.extractBase64Data(fileData);
            const result = await this.uploadAndReturnAllInfo(`data:image/${extension};base64,${data}`, {
                ...options,
                resourceType: 'image'
            });
            return result;
        } else {
            // Handle Express.Multer.File
            const base64Data = fileData.buffer.toString('base64');
            const mimeType = fileData.mimetype;
            const result = await this.uploadAndReturnAllInfo(`data:${mimeType};base64,${base64Data}`, {
                ...options,
                resourceType: 'image'
            });
            return result;
        }
    }

    /**
     * Upload video (supports MP4, MOV, AVI, etc.)
     */
    public async uploadVideo(
        base64Data: string,
        options: UploadOptions = {}
    ): Promise<string> {
        this.validateBase64Data(base64Data, 'video');
        const { data, extension } = this.extractBase64Data(base64Data);
        return this.upload(`data:video/${extension};base64,${data}`, {
            ...options,
            resourceType: 'video'
        });
    }

    /**
     * Upload audio (supports MP3, WAV, OGG, etc.)
     */
    public async uploadAudio(
        base64Data: string,
        options: UploadOptions = {}
    ): Promise<string> {
        this.validateBase64Data(base64Data, 'audio');
        const { data, extension } = this.extractBase64Data(base64Data);
        return this.upload(`data:audio/${extension};base64,${data}`, {
            ...options,
            resourceType: 'video' // Cloudinary treats audio as video
        });
    }

    /**
     * Upload animated GIF
     */
    public async uploadGif(
        base64Data: string,
        options: UploadOptions = {}
    ): Promise<string> {
        this.validateBase64Data(base64Data, 'image');
        const { data } = this.extractBase64Data(base64Data);
        return this.upload(`data:image/gif;base64,${data}`, {
            ...options,
            resourceType: 'image',
            format: 'gif'
        });
    }

    /**
     * Upload document (supports PDF, DOCX, XLSX, etc.)
     */
    public async uploadDocument(
        base64Data: string,
        options: UploadOptions = {}
    ): Promise<string> {
        const { data, extension } = this.extractBase64Data(base64Data);
        return this.upload(`data:application/${extension};base64,${data}`, {
            ...options,
            resourceType: 'raw'
        });
    }

    /**
     * Delete image by public ID
     */
    public async deleteImage(publicId: string): Promise<DeleteApiResponse> {
        return this.delete(publicId, { resourceType: 'image' });
    }

    // ==================== UTILITY METHODS ====================

    /**
     * Generate signed upload URL for client-side uploads
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
     * Get URL from public ID
     */
    public getUrlFromPublicId(
        publicId: string,
        resourceType: CloudinaryResourceType = 'image',
        transformations?: any
    ): string {
        return cloudinary.url(publicId, {
            resource_type: resourceType,
            secure: true,
            transformation: transformations
        });
    }

    // ==================== PRIVATE HELPERS ====================

    private detectResourceType(fileData: string | Buffer): CloudinaryResourceType {
        if (typeof fileData === 'string') {
            if (fileData.startsWith('data:image/')) return 'image';
            if (fileData.startsWith('data:video/')) return 'video';
            if (fileData.startsWith('data:audio/')) return 'video';
            if (fileData.startsWith('data:application/')) return 'raw';
        }
        return 'auto';
    }

    private validateBase64Data(base64Data: string, expectedType: string): void {
        if (!base64Data.startsWith(`data:${expectedType}/`)) {
            throw new Error(`Invalid ${expectedType} format`);
        }

        const matches = base64Data.match(new RegExp(`^data:${expectedType}/([a-zA-Z]+);base64,(.+)$`));
        if (!matches || matches.length !== 3) {
            throw new Error(`Malformed base64 ${expectedType} string`);
        }
    }

    private extractBase64Data(base64Data: string): { extension: string; data: string } {
        const matches = base64Data.match(/^data:[\w]+\/([\w]+);base64,(.+)$/)!;
        return {
            extension: matches[1].toLowerCase(),
            data: matches[2],
        };
    }

    private extractPublicIdFromUrl(url: string): string {
        const matches = url.match(/upload\/(?:v\d+\/)?([^\.]+)/);
        if (!matches || matches.length < 2) {
            throw new Error('Invalid Cloudinary URL');
        }
        return matches[1];
    }

    private handleUploadError(error: UploadApiErrorResponse): never {
        console.error('Cloudinary upload error:', error);
        
        // Handle specific error types
        if (error.error?.name === 'TimeoutError' || error.error?.http_code === 499) {
            throw new Error('Upload failed: Request timeout. The file may be too large or the connection is slow. Please try again.');
        }
        
        if (error.error?.http_code === 400) {
            throw new Error('Upload failed: Invalid file format or corrupted file.');
        }
        
        if (error.error?.http_code === 401) {
            throw new Error('Upload failed: Authentication error. Please check Cloudinary credentials.');
        }
        
        if (error.error?.http_code === 413) {
            throw new Error('Upload failed: File too large. Please reduce file size and try again.');
        }
        
        throw new Error(`Upload failed: ${error.error?.message || error.message || 'Unknown error'}`);
    }

    async moveToArchive(publicId: string): Promise<void> {
        if (!publicId) return;
        
        const archiveFolder = 'archive';
        const newPublicId = `${archiveFolder}/${publicId}`;
        
        await cloudinary.uploader.rename(publicId, newPublicId);
    }
}

export default CloudinaryService;