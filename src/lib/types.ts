/**
 * Interface for uploaded file information
 */
export interface UploadedFile {
  name: string;
  url: string;
  size: number;
  type: string;
  timestamp: number;
}
