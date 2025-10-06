import React, { useState } from 'react';
import Button from '../atoms/Button';
import Icon from '../atoms/Icon';
import ErrorMessage from '../atoms/ErrorMessage';
import LoadingSpinner from '../atoms/LoadingSpinner';

interface DemoSectionProps {
  className?: string;
}

const DemoSection: React.FC<DemoSectionProps> = ({ className = '' }) => {
  const [selectedLanguage, setSelectedLanguage] = useState('English');
  const [isRecording, setIsRecording] = useState(false);
  const [transcription, setTranscription] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const languages = ['English'];

  const handleSpeak = () => {
    setError(null);
    setIsRecording(!isRecording);
    if (!isRecording) {
      setIsLoading(true);
      // Simulate recording with potential error
      setTimeout(() => {
        if (Math.random() > 0.8) {
          setError("Failed to access microphone. Please check your permissions and try again.");
          setIsLoading(false);
          setIsRecording(false);
        } else {
          setTranscription("Speak your mind, we'll turn it into text.");
          setIsLoading(false);
          setIsRecording(false);
        }
      }, 3000);
    } else {
      setTranscription('');
      setIsLoading(false);
    }
  };

  const handleFileUpload = () => {
    setError(null);
    setIsLoading(true);
    // Simulate file upload with potential error
    setTimeout(() => {
      if (Math.random() > 0.9) {
        setError("Failed to upload file. Please check the file format and try again.");
        setIsLoading(false);
      } else {
        setTranscription("File uploaded successfully. Processing audio...");
        setTimeout(() => {
          setTranscription("Your uploaded audio has been transcribed with high accuracy using our advanced speech recognition technology.");
          setIsLoading(false);
        }, 2000);
      }
    }, 1000);
  };

  const handleTranscribeLive = () => {
    setError(null);
    setIsLoading(true);
    setTimeout(() => {
      if (Math.random() > 0.85) {
        setError("Unable to start live transcription. Please check your microphone settings.");
        setIsLoading(false);
      } else {
        setTranscription("Live transcription started. Speak into your microphone to see real-time results.");
        setIsLoading(false);
      }
    }, 1500);
  };

  const handleRetry = () => {
    setError(null);
    setTranscription('');
  };

  const handleDismissError = () => {
    setError(null);
  };

  const copyToClipboard = () => {
    navigator.clipboard.writeText(transcription);
  };

  const downloadTranscription = () => {
    const element = document.createElement('a');
    const file = new Blob([transcription], { type: 'text/plain' });
    element.href = URL.createObjectURL(file);
    element.download = 'transcription.txt';
    document.body.appendChild(element);
    element.click();
    document.body.removeChild(element);
  };

  return (
    <section className={`bg-gray-900 py-4 ${className}`}>
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Language Selector */}
        <div className="mb-6 sm:mb-8 animate-slide-in-left">
          <label htmlFor="language-select" className="block text-sm font-medium text-gray-300 mb-3">
            Select Language
          </label>
          <div className="relative">
            <select
              id="language-select"
              value={selectedLanguage}
              onChange={(e) => setSelectedLanguage(e.target.value)}
              className="w-full sm:w-auto bg-gray-800 border border-gray-600 text-white rounded-lg px-4 py-3 pr-10 focus:ring-2 focus:ring-blue-500 focus:border-transparent appearance-none cursor-pointer transition-all duration-200 hover:border-gray-500"
              aria-describedby="language-help"
            >
              {languages.map((language) => (
                <option key={language} value={language}>
                  {language}
                </option>
              ))}
            </select>
            <Icon 
              name="chevron-down" 
              size={20} 
              className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 pointer-events-none" 
              aria-hidden={true}
            />
          </div>
          <p id="language-help" className="mt-2 text-sm text-gray-500">
            Choose the language for speech recognition and synthesis
          </p>
        </div>

        {/* Demo Controls */}
        <div className="bg-gray-800 rounded-xl p-4 sm:p-6 mb-6 animate-slide-in-right animate-delay-200">
          <div className="flex flex-col lg:flex-row items-center justify-center gap-3 sm:gap-4 mb-6">
            <Button
              variant={isRecording ? 'secondary' : 'primary'}
              size="lg"
              onClick={handleSpeak}
              className={`flex items-center gap-2 w-full sm:w-auto justify-center ${isRecording ? 'bg-red-600 hover:bg-red-700 animate-pulse-glow' : ''}`}
              aria-label={isRecording ? 'Stop recording audio' : 'Start recording audio'}
            >
              <Icon name="microphone" size={20} aria-hidden={true} />
              {isRecording ? 'Stop Recording' : 'Speak'}
            </Button>
            
            <span className="text-gray-400 hidden lg:block" aria-hidden="true">OR</span>
            
            <Button
              variant="outline"
              size="lg"
              onClick={handleFileUpload}
              className="flex items-center gap-2 border-gray-600 text-gray-300 hover:text-white hover:border-gray-500 w-full sm:w-auto justify-center"
              aria-label="Upload audio file for transcription"
            >
              <Icon name="upload" size={20} aria-hidden={true} />
              <span className="hidden sm:inline">Use Your Own File</span>
              <span className="sm:hidden">Upload File</span>
            </Button>
            
            <Button
              variant="outline"
              size="lg"
              onClick={handleTranscribeLive}
              className="flex items-center gap-2 border-gray-600 text-gray-300 hover:text-white hover:border-gray-500 w-full sm:w-auto justify-center"
              aria-label="Start live transcription"
            >
              <Icon name="play" size={20} aria-hidden={true} />
              <span className="hidden sm:inline">Transcribe Live</span>
              <span className="sm:hidden">Live</span>
            </Button>
          </div>

          {/* Placeholder Text */}
          <div className="text-center text-gray-400 text-sm">
            {isRecording ? (
              <div className="flex items-center justify-center gap-2">
                <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse"></div>
                Recording... Speak now
              </div>
            ) : (
              "Speak your mind, we'll turn it into text. No typos, no autocorrect drama. Nova-3 transcribes it all."
            )}
          </div>
        </div>

        {/* Error Display */}
        {error && (
          <div className="mb-6 animate-fade-in">
            <ErrorMessage
              title="Transcription Error"
              message={error}
              variant="error"
              onRetry={handleRetry}
              onDismiss={handleDismissError}
            />
          </div>
        )}

        {/* Loading Display */}
        {isLoading && (
          <div className="bg-gray-800 rounded-xl p-4 sm:p-6 mb-6 flex items-center justify-center animate-fade-in">
            <LoadingSpinner size="md" text="Processing audio..." />
          </div>
        )}

        {/* Transcription Output */}
        {!error && !isLoading && !transcription && (
          <div className="bg-gray-800 rounded-xl p-4 sm:p-6 min-h-[200px] flex items-center justify-center animate-fade-in">
            <p className="text-gray-500 text-sm sm:text-base">
              Your transcription will appear here...
            </p>
          </div>
        )}
        
        {transcription && !error && !isLoading && (
          <div className="bg-gray-800 rounded-xl p-4 sm:p-6 animate-fade-in">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4">
              <h3 className="text-lg font-semibold text-white">Transcription</h3>
              <div className="flex flex-wrap items-center gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={copyToClipboard}
                  className="text-gray-400 hover:text-white flex items-center gap-1"
                  aria-label="Copy transcription to clipboard"
                >
                  <Icon name="copy" size={16} aria-hidden={true} />
                  <span className="hidden sm:inline">Copy</span>
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={downloadTranscription}
                  className="text-gray-400 hover:text-white flex items-center gap-1"
                  aria-label="Download transcription as text file"
                >
                  <Icon name="download" size={16} aria-hidden={true} />
                  <span className="hidden sm:inline">Download</span>
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-gray-400 hover:text-white flex items-center gap-1"
                  aria-label="Explore more features"
                >
                  <Icon name="settings" size={16} aria-hidden={true} />
                  <span className="hidden lg:inline">Explore More Features</span>
                  <span className="lg:hidden">More</span>
                </Button>
              </div>
            </div>
            <div 
              className="bg-gray-900 rounded-lg p-4 text-gray-300 leading-relaxed min-h-[100px] max-h-[300px] overflow-y-auto"
              role="region"
              aria-label="Transcription result"
              tabIndex={0}
            >
              {transcription}
            </div>
          </div>
        )}
      </div>
    </section>
  );
};

export default DemoSection;