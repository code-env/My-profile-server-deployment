# Vault System Documentation

## Overview

The Vault System is a comprehensive digital asset management platform that organizes digital assets into three main categories: **Wallet**, **Documents**, and **Media**. It provides secure storage, encryption, analytics, and seamless integration with existing scan and NFC systems.

## Table of Contents

1. [Architecture](#architecture)
2. [Core Components](#core-components)
3. [Data Models](#data-models)
4. [API Endpoints](#api-endpoints)
5. [Relationships](#relationships)
6. [Security Features](#security-features)
7. [Integration Points](#integration-points)
8. [Usage Examples](#usage-examples)

## Architecture

The Vault System follows a modular architecture with clear separation of concerns:

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Controllers   │────│    Services     │────│     Models      │
└─────────────────┘    └─────────────────┘    └─────────────────┘
         │                       │                       │
         │                       │                       │
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│     Routes      │    │   Middleware    │    │    Database     │
└─────────────────┘    └─────────────────┘    └─────────────────┘
```

## Core Components

### 1. Vault Categories

#### **Wallet Items**
Digital representations of physical cards and identity documents:
- **Identity Cards**: ID cards, passports, driver's licenses
- **Financial Cards**: Credit cards, debit cards, bank cards
- **Membership Cards**: Loyalty cards, club memberships
- **Passes/Tickets**: Event tickets, transit passes, vouchers

#### **Documents**
File-based digital assets with OCR integration:
- **Files**: PDFs, Word documents, spreadsheets
- **Receipts**: Purchase receipts, invoices
- **Forms**: Application forms, contracts
- **Vouchers**: Digital vouchers, coupons

#### **Media**
Multimedia content with album organization:
- **Gallery**: Photos, images
- **Videos**: Video files with thumbnail generation
- **Audio**: Music, voice recordings

### 2. Key Features

- **Encryption**: AES-256-CBC encryption for sensitive data
- **File Upload**: Secure file handling with Cloudinary integration
- **Search**: Full-text search across all vault items
- **Analytics**: Comprehensive usage tracking and statistics
- **Sharing**: Granular access controls and sharing capabilities
- **Albums**: Organization system for media items
- **Activity Logging**: Detailed audit trail for all operations

## Data Models

### Base Vault Item Schema

```typescript
interface IVaultItemBase {
  _id: ObjectId;
  profileId: ObjectId;
  category: 'wallet' | 'documents' | 'media';
  name: string;
  description?: string;
  tags: string[];
  isFavorite: boolean;
  isEncrypted: boolean;
  accessLevel: 'private' | 'shared' | 'public';
  sharedWith: ObjectId[];
  createdAt: Date;
  updatedAt: Date;

  // Relationships
  albumId?: ObjectId;           // For media organization
  nfcCardId?: ObjectId;         // NFC integration
  relatedScanId?: ObjectId;     // Scan integration
}
```

### Wallet Item Schema

```typescript
interface IWalletItem extends IVaultItemBase {
  category: 'wallet';
  subcategory: WalletSubcategory;
  cardType: 'credit' | 'debit' | 'id' | 'membership' | 'pass';

  // Card details
  cardNumber?: string;          // Encrypted
  documentNumber?: string;      // Encrypted
  lastFourDigits?: string;
  expiryDate?: Date;
  issuer?: string;

  // Images
  frontImage?: string;          // Cloudinary URL
  backImage?: string;           // Cloudinary URL

  // Status
  isActive: boolean;
  isExpired: boolean;

  // Security
  pinRequired: boolean;
  biometricRequired: boolean;
}
```

### Document Item Schema

```typescript
interface IDocumentItem extends IVaultItemBase {
  category: 'documents';
  subcategory: DocumentSubcategory;
  documentType: 'pdf' | 'image' | 'word' | 'excel' | 'other';

  // File details
  fileUrl: string;              // Cloudinary URL
  fileName: string;
  fileType: string;             // MIME type
  fileSize: number;             // In bytes

  // OCR and processing
  extractedText?: string;       // OCR results
  keywords?: string[];          // Extracted keywords

  // Versioning
  version: number;
  previousVersions: ObjectId[];
}
```

### Media Item Schema

```typescript
interface IMediaItem extends IVaultItemBase {
  category: 'media';
  subcategory: MediaSubcategory;
  mediaType: 'image' | 'video' | 'audio';

  // File details
  fileUrl: string;              // Cloudinary URL
  fileName: string;
  fileType: string;             // MIME type
  fileSize: number;             // In bytes
  cloudinaryPublicId: string;

  // Media-specific
  thumbnailUrl?: string;        // For videos
  dimensions?: {
    width: number;
    height: number;
  };
  duration?: number;            // For audio/video

  // Processing
  processingStatus: 'pending' | 'processing' | 'completed' | 'failed';
}
```

### Album Schema

```typescript
interface IAlbum {
  _id: ObjectId;
  profileId: ObjectId;
  name: string;
  description?: string;
  coverImageId?: ObjectId;      // Reference to media item
  mediaCount: number;
  sortOrder: number;
  isPrivate: boolean;
  createdAt: Date;
  updatedAt: Date;
}
```

## API Endpoints

### General Vault Operations

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/vault/items` | Get all vault items with filtering |
| GET | `/api/vault/items/:itemId` | Get specific vault item |
| DELETE | `/api/vault/items/:itemId` | Delete vault item |
| GET | `/api/vault/stats` | Get vault statistics |
| GET | `/api/vault/activity` | Get vault activity logs |
| POST | `/api/vault/search` | Search vault items |

### Wallet Operations

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/vault/wallet` | Create wallet item |
| PUT | `/api/vault/wallet/:itemId` | Update wallet item |
| POST | `/api/vault/wallet/:itemId/image/:side` | Upload card image |

### Document Operations

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/vault/documents` | Create document item |
| PUT | `/api/vault/documents/:itemId` | Update document item |
| POST | `/api/vault/documents/:itemId/scan/:scanId` | Link to scan |

### Media Operations

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/vault/media` | Create media item |
| PUT | `/api/vault/media/:itemId` | Update media item |

### Album Operations

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/vault/albums` | Get all albums |
| POST | `/api/vault/albums` | Create album |
| PUT | `/api/vault/albums/:albumId` | Update album |
| DELETE | `/api/vault/albums/:albumId` | Delete album |

### Sharing Operations

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/vault/items/:itemId/share` | Share vault item |
| GET | `/api/vault/shared` | Get shared items |

## Relationships

### Vault ↔ Scan Integration

The Vault system has a bidirectional relationship with the Scan system:

```typescript
// Vault items can reference scans
interface IVaultItemBase {
  relatedScanId?: ObjectId;     // Links to scan that created this item
}

// Scans can be linked to vault items
interface IScan {
  vaultItemId?: ObjectId;       // Links to created vault item
}
```

**Integration Flow:**
1. User performs a scan (document, NFC card, QR code)
2. Scan system processes the data
3. Vault system creates appropriate vault item
4. Both systems maintain cross-references

### Vault ↔ NFC Integration

```typescript
// Vault items can be linked to NFC cards
interface IVaultItemBase {
  nfcCardId?: ObjectId;         // Links to NFC card
}

// NFC cards can reference vault items
interface INFCCard {
  linkedVaultItems: ObjectId[]; // Multiple vault items per card
}
```

### Media ↔ Album Relationship

```typescript
// Media items belong to albums
interface IMediaItem {
  albumId?: ObjectId;           // Optional album membership
}

// Albums contain multiple media items
interface IAlbum {
  mediaCount: number;           // Auto-calculated count
}
```

## Security Features

### 1. Encryption
- **Algorithm**: AES-256-CBC
- **Scope**: Sensitive data (card numbers, document numbers)
- **Key Management**: Environment-based encryption keys

```typescript
class VaultService {
  private encrypt(text: string): string {
    const cipher = crypto.createCipher('aes-256-cbc', this.encryptionKey);
    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    return encrypted;
  }
}
```

### 2. Access Control
- **Private**: Only owner can access
- **Shared**: Specific profiles can access
- **Public**: Anyone can view (read-only)

### 3. Authentication
- JWT-based authentication required for all endpoints
- User context maintained throughout requests

### 4. File Security
- Secure file upload with type validation
- Cloudinary integration for secure storage
- File size limits and malware protection

## Integration Points

### 1. Scan System Integration

**Document Scanning → Vault Storage:**
```typescript
// Scan creates document
const scanResult = await scanService.processScan(file);
const vaultItem = await vaultService.createDocumentItem(profileId, {
  name: scanResult.fileName,
  fileUrl: scanResult.fileUrl,
  extractedText: scanResult.ocrText,
  relatedScanId: scanResult._id
});
```

### 2. NFC System Integration

**NFC Card → Wallet Item:**
```typescript
// NFC scan creates wallet item
const nfcData = await nfcService.readCard(cardId);
const walletItem = await vaultService.createWalletItem(profileId, {
  name: nfcData.cardName,
  cardType: nfcData.type,
  nfcCardId: nfcData._id
});
```

### 3. Cloudinary Integration

**File Upload → Cloud Storage:**
```typescript
// Upload with automatic optimization
const uploadResult = await cloudinaryService.uploadAndReturnAllInfo(file.buffer, {
  folder: `vault/${category}/${profileId}`,
  resourceType: 'auto'
});
```

## NFC Card Integration

The Vault System integrates with the new NFC card management and programming architecture:

- **Wallet items** can be linked to NFC cards (see `nfcCardId` field)
- **NFC cards** can reference multiple vault items (see `linkedVaultItems`)
- **Batch programming and analytics** are available for enterprise fulfillment
- **All NFC programming is performed server-side for quality, security, and auditability**

### Example Integration Flow
1. User or admin provisions a new NFC card (see SCAN_API.md for endpoints)
2. Card is configured and programmed server-side using nfc-pcsc hardware
3. Card is linked to wallet item(s) in the vault for digital asset management
4. All scans, analytics, and access control are tracked and available via API

See [SCAN_API.md](./SCAN_API.md) for full NFC API details and workflows.

## Usage Examples

### 1. Creating a Wallet Item

```javascript
POST /api/vault/wallet
{
  "name": "My Credit Card",
  "subcategory": "credit_card",
  "cardType": "credit",
  "cardNumber": "1234567890123456",
  "expiryDate": "2025-12-31",
  "issuer": "Bank of Example",
  "isEncrypted": true
}
```

### 2. Uploading a Document

```javascript
POST /api/vault/documents
Content-Type: multipart/form-data

{
  "name": "Insurance Policy",
  "subcategory": "insurance",
  "documentType": "pdf",
  "file": [binary file data]
}
```

### 3. Creating a Media Album

```javascript
POST /api/vault/albums
{
  "name": "Vacation Photos 2025",
  "description": "Summer vacation memories",
  "isPrivate": false
}
```

### 4. Searching Vault Items

```javascript
POST /api/vault/search
{
  "query": "insurance",
  "filters": {
    "categories": ["documents"],
    "dateFrom": "2025-01-01",
    "dateTo": "2025-12-31"
  }
}
```

### 5. Sharing a Vault Item

```javascript
POST /api/vault/items/:itemId/share
{
  "shareWithProfileIds": ["60d5ecb74b9c1c001f5e4e85"],
  "accessLevel": "shared"
}
```

## Best Practices

### 1. Security
- Always encrypt sensitive data before storage
- Use HTTPS for all API communications
- Implement proper access controls
- Regular security audits

### 2. Performance
- Implement pagination for large result sets
- Use efficient database queries
- Optimize file upload sizes
- Cache frequently accessed data

### 3. User Experience
- Provide real-time upload progress
- Implement search suggestions
- Use meaningful error messages
- Support bulk operations

### 4. Data Management
- Regular backups of vault data
- Implement data retention policies
- Monitor storage usage
- Clean up orphaned files

## File Structure

```
src/
├── models/
│   └── vault.model.ts          # Vault data models
├── services/
│   └── vault.service.ts        # Business logic
├── controllers/
│   └── vault.controller.ts     # HTTP handlers
├── routes/
│   └── vault.routes.ts         # API routes
├── middleware/
│   └── upload.middleware.ts    # File upload handling
└── types/
    └── vault.types.ts          # TypeScript definitions
```

## Environment Variables

```bash
# Encryption
VAULT_ENCRYPTION_KEY=your-256-bit-encryption-key

# Cloudinary
CLOUDINARY_CLOUD_NAME=your-cloud-name
CLOUDINARY_API_KEY=your-api-key
CLOUDINARY_API_SECRET=your-api-secret

# Database
MONGODB_URI=mongodb://localhost:27017/myprofile
```

## Conclusion

The Vault System provides a comprehensive solution for digital asset management with robust security, flexible organization, and seamless integration capabilities. It serves as the central hub for all user digital assets while maintaining security and usability.

For technical support or feature requests, please refer to the project documentation or contact the development team.
