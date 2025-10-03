import React, { useState } from 'react';
import Button from '../atoms/Button';
import Icon from '../atoms/Icon';
import ErrorMessage from '../atoms/ErrorMessage';
import LoadingSpinner from '../atoms/LoadingSpinner';
import { useTranscription } from '../../context/useTranscription';
import { downloadTranscription } from '../../services/api/transcription';
import type { DownloadFormat } from '../../types/api';

const formats: DownloadFormat[] = ['txt', 'srt', 'json'];

const DownloadSection: React.FC<{ className?: string }> = ({ className = '' }) => {
  const { state, dispatch } = useTranscription();
  const [format, setFormat] = useState<DownloadFormat>('txt');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleDownload = async (id?: string) => {
    setError(null);
    if (!id) {
      setError('No session selected for download.');
      return;
    }
    setIsLoading(true);
    try {
      await downloadTranscription(id, format);
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : 'Failed to download transcription';
      setError(message);
    } finally {
      setIsLoading(false);
    }
  };

  const setCurrent = (id: string) => dispatch({ type: 'set_current', payload: id });

  return (
    <section className={`bg-gray-800 rounded-xl p-4 sm:p-6 ${className}`} aria-label="Download section">
      <h2 className="text-xl font-semibold text-white mb-4">Downloads</h2>

      <div className="flex items-center gap-3 mb-4">
        <label htmlFor="format-select" className="text-gray-300">Format</label>
        <select
          id="format-select"
          value={format}
          onChange={(e) => setFormat(e.target.value as DownloadFormat)}
          className="bg-gray-900 text-gray-200 border border-gray-700 rounded-lg px-3 py-2"
        >
          {formats.map((f) => (
            <option key={f} value={f}>{f.toUpperCase()}</option>
          ))}
        </select>
        <Button variant="outline" onClick={() => handleDownload(state.currentSessionId)} className="border-gray-600 text-gray-300 hover:text-white hover:border-gray-500">
          <Icon name="download" size={18} aria-hidden /> Download Current
        </Button>
      </div>

      {isLoading && (
        <LoadingSpinner size="sm" text="Preparing download..." />
      )}

      {error && (
        <ErrorMessage message={error} onDismiss={() => setError(null)} />
      )}

      <div className="mt-6">
        <h3 className="text-lg font-semibold text-white mb-2">Session History</h3>
        {state.sessions.length === 0 ? (
          <p className="text-gray-400">No sessions yet. Process a file or start live transcription.</p>
        ) : (
          <ul className="divide-y divide-gray-700 rounded-lg overflow-hidden border border-gray-700">
            {state.sessions.map((s) => (
              <li key={s.id} className={`p-3 sm:p-4 bg-gray-900 ${s.id === state.currentSessionId ? 'bg-gray-800' : ''}`}>
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-gray-200 font-medium truncate">{s.id}</p>
                    <p className="text-gray-400 text-sm truncate">{s.language} • {new Date(s.createdAt).toLocaleString()}</p>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <Button variant="ghost" size="sm" onClick={() => setCurrent(s.id)} className="text-gray-300 hover:text-white">Select</Button>
                    <Button variant="ghost" size="sm" onClick={() => handleDownload(s.id)} className="text-gray-300 hover:text-white flex items-center gap-1">
                      <Icon name="download" size={16} aria-hidden />
                      <span>Download</span>
                    </Button>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
};

export default DownloadSection;
