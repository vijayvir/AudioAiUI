import { postForm, getBlob, downloadBlob } from './client';
import type { FileTranscribeResponse, DownloadFormat } from '../../types/api';

export async function transcribeFile(file: File, language: string): Promise<FileTranscribeResponse> {
  const form = new FormData();
  form.append('file', file);
  form.append('language', language);
  return postForm<FileTranscribeResponse>('/file-transcribe', form);
}

export async function downloadTranscription(sessionId: string, format: DownloadFormat): Promise<void> {
  const blob = await getBlob(`/download-transcription/${sessionId}?format=${format}`);
  const filename = `transcription_${sessionId}.${format}`;
  downloadBlob(filename, blob);
}