import React, { useEffect, useRef } from "react";

const TranscriptionPanel = ({ liveTranscript, partialText, finalText, isProcessing, progress, isFileMode }) => {
  const panelRef = useRef(null);

  useEffect(() => {
    if (panelRef.current) panelRef.current.scrollTop = panelRef.current.scrollHeight;
  }, [liveTranscript, partialText, finalText]);

  return (
    <div className="panel" ref={panelRef}>
      {isProcessing ? (
        <div className="loader-container">
          <div className="loader"></div>
          <p className="loader-text">
            {isFileMode ? `Processing file... ${progress}%` : "Processing live transcription..."}
          </p>
        </div>
      ) : liveTranscript || finalText ? (
        <div className="text">
          {liveTranscript && (
            <>
              <div className="transcript-label">Live:</div>
              <div className="transcript-content">{liveTranscript}{partialText ? " " + partialText : ""}</div>
            </>
          )}
          {finalText && (
            <>
              {liveTranscript && <div className="transcript-spacer"></div>}
              <div className="transcript-label enhanced">Enhanced version:</div>
              <div className="transcript-content">{finalText}</div>
            </>
          )}
        </div>
      ) : (
        <div className="hint">Speak or upload audio, and we'll turn it into text.</div>
      )}
    </div>
  );
};

export default TranscriptionPanel;