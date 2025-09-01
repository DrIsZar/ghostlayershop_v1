# Service Logo Feature

This feature allows users to upload and manage logos for services in the ServicesManager.

## Features

- **Logo Upload**: Upload logos when adding or editing services
- **File Validation**: Supports JPEG, PNG, GIF, and WebP formats (max 5MB)
- **Visual Display**: Logos are displayed in both group headers and individual service rows
- **Persistent Storage**: Logos are stored locally and persist across sessions
- **Error Handling**: Graceful fallback to placeholder icons when logos fail to load

## How to Use

### Adding a Logo to a New Service

1. Click "Add Service" button
2. In the modal, click "Upload Logo" button
3. Select an image file (JPEG, PNG, GIF, or WebP)
4. The logo will be previewed above the upload button
5. Fill in other service details and click "Add Service"

### Editing a Service Logo

1. Click the edit button (pencil icon) on any service row
2. In the edit modal, you can:
   - Upload a new logo (replaces the existing one)
   - Remove the current logo (click the trash icon on the preview)
   - Keep the existing logo unchanged
3. Click "Update Service" to save changes

### Logo Display

- **Group Headers**: Larger logo display (40x40px) in service group headers
- **Service Rows**: Smaller logo display (32x32px) in individual service rows
- **Fallback Icons**: Placeholder icons are shown when no logo is uploaded
- **Error Handling**: If a logo fails to load, it automatically falls back to a placeholder

## Technical Details

### File Storage

- Logos are stored as blob URLs in the browser's localStorage
- Files are validated for type and size before upload
- Automatic cleanup of unused blob URLs after 24 hours

### Supported Formats

- **Image Types**: JPEG, JPG, PNG, GIF, WebP
- **File Size**: Maximum 5MB
- **Resolution**: Any resolution (automatically scaled to display size)

### Storage Structure

```
localStorage:
├── service_logos_map: { serviceName: logoInfo }
└── service_logo_{serviceName}: logoInfo
```

### Logo Information Object

```typescript
interface UploadedFile {
  name: string;        // Filename
  url: string;         // Blob URL
  size: number;        // File size in bytes
  type: string;        // MIME type
  timestamp: number;   // Upload timestamp
}
```

## File Management

### Automatic Cleanup

- Blob URLs are automatically cleaned up after 24 hours
- This prevents memory leaks from unused image data

### Logo Persistence

- Logos persist across browser sessions
- Logos are automatically linked to service names
- When a service name changes, the logo association is updated

## Future Enhancements

- Cloud storage integration (AWS S3, Google Cloud Storage)
- Image optimization and compression
- Multiple logo sizes (thumbnails, high-res)
- Logo cropping and editing tools
- Bulk logo upload for multiple services

## Troubleshooting

### Logo Not Displaying

1. Check if the file was uploaded successfully
2. Verify the file format is supported
3. Check browser console for any errors
4. Ensure the service name matches exactly

### Upload Errors

1. File size must be under 5MB
2. Only image files are supported
3. Check browser storage permissions
4. Clear browser cache if issues persist

### Performance Issues

1. Large logos may affect performance
2. Consider resizing images before upload
3. Use WebP format for better compression
4. Monitor localStorage usage in browser dev tools
