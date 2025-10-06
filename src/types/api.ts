export type LanguageCode = string;

export interface FileTranscribeResponse {
  sessionId: string;
  transcript: string;
  translation?: string;
  status?: 'processing' | 'done' | 'error';
}

export interface LiveTranscribeMessage {
  type: 'partial' | 'final' | 'translation' | 'error' | 'info';
  text?: string;
  language?: LanguageCode;
  sessionId?: string;
}

export type DownloadFormat = 'txt' | 'srt' | 'json';

export interface SessionRecord {
  id: string;
  language: LanguageCode;
  createdAt: number;
  transcript?: string;
  translation?: string;
}