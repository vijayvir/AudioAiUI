import React, { useState, useRef } from 'react';
import Button from '../atoms/Button';
import Icon from '../atoms/Icon';
import LoadingSpinner from '../atoms/LoadingSpinner';
import ErrorMessage from '../atoms/ErrorMessage';
import { DEFAULT_LANGUAGES } from '../../config/env';
import { transcribeFile } from '../../services/api/transcription';
import { useTranscription } from '../../context/useTranscription';

const FileProcessingSection: React.FC<{ className?: string }> = ({ className = '' }) => {
  const { state, dispatch } = useTranscription();
  const [language, setLanguage] = useState(state.language);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ transcript?: string; translation?: string }>();
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const handleUpload = async () => {
    setError(null);
    setResult(undefined);
    const file = fileInputRef.current?.files?.[0];
    if (!file) {
      setError('Please select an audio file to upload.');
      return;
    }
    setIsLoading(true);
    try {
      const res = await transcribeFile(file, language);
      setResult({ transcript: res.transcript, translation: res.translation });
      dispatch({ type: 'set_language', payload: language });
      dispatch({ type: 'add_session', payload: { id: res.sessionId, language, createdAt: Date.now(), transcript: res.transcript, translation: res.translation } });
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : 'Failed to process file';
      setError(message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <section className={`bg-gray-800 rounded-xl p-4 sm:p-6 ${className}`} aria-label="File processing">
      <h2 className="text-xl font-semibold text-white mb-4">File Processing</h2>
      <div className="flex flex-col gap-4">
        <div className="flex flex-col sm:flex-row gap-3 items-center">
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <Icon name="upload" size={20} aria-hidden />
            <input
              ref={fileInputRef}
              type="file"
              accept="audio/*"
              className="text-gray-300"
              aria-label="Select audio file for transcription"
            />
          </div>
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <label htmlFor="language-select" className="text-gray-300">Language</label>
            <select
              id="language-select"
              value={language}
              onChange={(e) => setLanguage(e.target.value)}
              className="bg-gray-900 text-gray-200 border border-gray-700 rounded-lg px-3 py-2"
              aria-label="Select transcription language"
            >
              {DEFAULT_LANGUAGES.map((lang) => (
                <option key={lang} value={lang}>{lang}</option>
              ))}
            </select>
          </div>
          <Button variant="outline" onClick={handleUpload} className="border-gray-600 text-gray-300 hover:text-white hover:border-gray-500">
            Process File
          </Button>
        </div>

        {isLoading && (
          <div className="flex items-center justify-center">
            <LoadingSpinner size="md" text="Uploading and transcribing..." />
          </div>
        )}

        {error && (
          <ErrorMessage message={error} onDismiss={() => setError(null)} />
        )}

        {!isLoading && !error && result?.transcript && (
          <div className="bg-gray-900 rounded-lg p-4 text-gray-300 leading-relaxed">
            <h3 className="text-lg font-semibold text-white mb-2">Transcript</h3>
            <p>{result.transcript}</p>
            {result.translation && (
              <div className="mt-4">
                <h4 className="text-md font-semibold text-white mb-2">Translation</h4>
                <p>{result.translation}</p>
              </div>
            )}
          </div>
        )}
      </div>
    </section>
  );
};

export default FileProcessingSection;
