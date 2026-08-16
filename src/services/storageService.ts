import { supabase } from './supabaseClient';

export const DOCUMENTS_BUCKET = 'trip-documents';

export interface UploadResult {
  fileUrl: string;
  fileSize: string;
  error?: string;
}

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/**
 * Uploads a document file to Supabase Storage bucket scoped by trip_id.
 */
export async function uploadDocumentFile(
  tripId: string,
  file: File | Blob,
  fileName: string,
): Promise<UploadResult> {
  try {
    const cleanFileName = fileName.replace(/[^a-zA-Z0-9._-]/g, '_');
    const path = `${tripId}/${Date.now()}_${cleanFileName}`;

    const { error } = await supabase.storage
      .from(DOCUMENTS_BUCKET)
      .upload(path, file, { upsert: true });

    if (error) {
      return { fileUrl: '', fileSize: '', error: error.message };
    }

    const { data: urlData } = supabase.storage.from(DOCUMENTS_BUCKET).getPublicUrl(path);
    const sizeStr = 'size' in file ? formatFileSize(file.size) : '0 B';

    return {
      fileUrl: urlData.publicUrl,
      fileSize: sizeStr,
    };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Erro ao realizar upload do arquivo.';
    return { fileUrl: '', fileSize: '', error: msg };
  }
}
