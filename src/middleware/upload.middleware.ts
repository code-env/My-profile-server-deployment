/**
 * @file upload.middleware.ts
 * @description Multer middleware configuration for file uploads
 * ==========================================================
 *
 * This middleware handles file uploads for the Vault system.
 * Supports multiple file types and implements security measures.
 *
 * @version 1.0.0
 * @author My Profile Server
 */

import multer from 'multer';
import { Request } from 'express';
import { logger } from '../utils/logger';

// File size limits (in bytes)
const FILE_SIZE_LIMITS = {
  image: 10 * 1024 * 1024,    // 10MB for images
  video: 100 * 1024 * 1024,   // 100MB for videos
  audio: 50 * 1024 * 1024,    // 50MB for audio
  document: 25 * 1024 * 1024, // 25MB for documents
  default: 10 * 1024 * 1024   // 10MB default
};

// Allowed MIME types
const ALLOWED_MIME_TYPES = {
  // Images
  'image/jpeg': 'image',
  'image/jpg': 'image',
  'image/png': 'image',
  'image/gif': 'image',
  'image/webp': 'image',
  'image/svg+xml': 'image',

  // Videos
  'video/mp4': 'video',
  'video/mpeg': 'video',
  'video/quicktime': 'video',
  'video/x-msvideo': 'video',
  'video/webm': 'video',

  // Audio
  'audio/mpeg': 'audio',
  'audio/wav': 'audio',
  'audio/ogg': 'audio',
  'audio/mp3': 'audio',
  'audio/mp4': 'audio',

  // Documents
  'application/pdf': 'document',
  'application/msword': 'document',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'document',
  'application/vnd.ms-excel': 'document',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'document',
  'application/vnd.ms-powerpoint': 'document',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation': 'document',
  'text/plain': 'document',
  'text/csv': 'document',
  'application/json': 'document',
  'application/xml': 'document',
  'text/xml': 'document'
};

/**
 * File filter function to validate uploaded files
 */
const fileFilter = (req: Request, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
  try {
    logger.debug(`File upload attempt: ${file.originalname}, MIME: ${file.mimetype}`);

    // Check if MIME type is allowed
    if (!ALLOWED_MIME_TYPES[file.mimetype as keyof typeof ALLOWED_MIME_TYPES]) {
      logger.warn(`Rejected file upload - unsupported MIME type: ${file.mimetype}`);
      return cb(new Error(`Unsupported file type: ${file.mimetype}. Please upload a valid image, video, audio, or document file.`));
    }

    // Additional security checks
    const originalNameLower = file.originalname.toLowerCase();

    // Block potentially dangerous file extensions
    const dangerousExtensions = ['.exe', '.bat', '.cmd', '.com', '.pif', '.scr', '.vbs', '.js'];
    const hasDangerousExtension = dangerousExtensions.some(ext => originalNameLower.endsWith(ext));

    if (hasDangerousExtension) {
      logger.warn(`Rejected file upload - dangerous extension: ${file.originalname}`);
      return cb(new Error('File type not allowed for security reasons.'));
    }

    // Check for suspicious file names
    if (originalNameLower.includes('..') || originalNameLower.includes('/') || originalNameLower.includes('\\')) {
      logger.warn(`Rejected file upload - suspicious filename: ${file.originalname}`);
      return cb(new Error('Invalid filename detected.'));
    }

    cb(null, true);
  } catch (error) {
    logger.error('Error in file filter:', error);
    cb(new Error('File validation failed.'));
  }
};

/**
 * Dynamic file size limit based on file type
 */
const getFileSizeLimit = (req: Request, file: Express.Multer.File): number => {
  const fileType = ALLOWED_MIME_TYPES[file.mimetype as keyof typeof ALLOWED_MIME_TYPES];
  return FILE_SIZE_LIMITS[fileType as keyof typeof FILE_SIZE_LIMITS] || FILE_SIZE_LIMITS.default;
};

/**
 * Multer configuration for in-memory storage
 * Files are stored in memory as Buffer objects for direct processing
 */
const storage = multer.memoryStorage();

/**
 * Main upload middleware configuration
 */
const uploadConfig = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: Math.max(...Object.values(FILE_SIZE_LIMITS)), // Use maximum size limit
    files: 10, // Maximum 10 files per request
    fields: 20, // Maximum 20 non-file fields
    fieldNameSize: 50, // Maximum field name size
    fieldSize: 1024 * 1024 // Maximum field value size (1MB)
  }
});

/**
 * Middleware for single file upload
 */
export const uploadSingle = (fieldName: string = 'file') => {
  return uploadConfig.single(fieldName);
};

/**
 * Middleware for multiple file upload
 */
export const uploadMultiple = (fieldName: string = 'files', maxCount: number = 10) => {
  return uploadConfig.array(fieldName, maxCount);
};

/**
 * Middleware for mixed file uploads (different field names)
 */
export const uploadFields = (fields: { name: string; maxCount?: number }[]) => {
  return uploadConfig.fields(fields);
};

/**
 * General upload middleware (handles single or multiple files)
 */
export const upload = {
  single: uploadSingle,
  multiple: uploadMultiple,
  fields: uploadFields,
  any: () => uploadConfig.any(),
  none: () => uploadConfig.none()
};

/**
 * Error handling middleware for multer errors
 */
export const handleUploadError = (error: any, req: Request, res: any, next: any) => {
  if (error instanceof multer.MulterError) {
    logger.warn('Multer upload error:', {
      code: error.code,
      message: error.message,
      field: error.field
    });

    switch (error.code) {
      case 'LIMIT_FILE_SIZE':
        return res.status(400).json({
          success: false,
          error: 'File too large. Please check file size limits.',
          code: 'FILE_TOO_LARGE'
        });
      case 'LIMIT_FILE_COUNT':
        return res.status(400).json({
          success: false,
          error: 'Too many files uploaded.',
          code: 'TOO_MANY_FILES'
        });
      case 'LIMIT_UNEXPECTED_FILE':
        return res.status(400).json({
          success: false,
          error: 'Unexpected file field.',
          code: 'UNEXPECTED_FILE'
        });
      case 'LIMIT_FIELD_COUNT':
        return res.status(400).json({
          success: false,
          error: 'Too many fields.',
          code: 'TOO_MANY_FIELDS'
        });
      default:
        return res.status(400).json({
          success: false,
          error: 'File upload error.',
          code: 'UPLOAD_ERROR'
        });
    }
  }

  // Handle custom file filter errors
  if (error && error.message) {
    logger.warn('File filter error:', error.message);
    return res.status(400).json({
      success: false,
      error: error.message,
      code: 'FILE_VALIDATION_ERROR'
    });
  }

  next(error);
};

/**
 * Utility function to validate file type against expected category
 */
export const validateFileCategory = (file: Express.Multer.File, expectedCategory: string): boolean => {
  const actualCategory = ALLOWED_MIME_TYPES[file.mimetype as keyof typeof ALLOWED_MIME_TYPES];
  return actualCategory === expectedCategory;
};

/**
 * Utility function to get file category from MIME type
 */
export const getFileCategory = (mimeType: string): string | null => {
  return ALLOWED_MIME_TYPES[mimeType as keyof typeof ALLOWED_MIME_TYPES] || null;
};

export default upload;
