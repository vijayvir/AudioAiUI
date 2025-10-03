import { useContext } from 'react';
import { TranscriptionContext } from './transcription';

export function useTranscription() {
  const ctx = useContext(TranscriptionContext);
  if (!ctx) throw new Error('useTranscription must be used within TranscriptionProvider');
  return ctx;
}

export default useTranscription;

