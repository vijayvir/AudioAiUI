import React, { useRef, useState, useEffect, useCallback } from "react";
import "./App.css";

// Helper function to determine the initial UI theme (Dark/Light) based on browser storage
// This ensures the user's preference persists after refreshing the page.
const getInitialTheme = () => {
  if (typeof localStorage !== 'undefined' && localStorage.getItem('theme')) {
    return localStorage.getItem('theme');
  }
  return 'dark'; // Default to dark mode if no preference is saved
};

// --- CONFIGURATION & ENVIRONMENT VARIABLES ---
// API_BASE_URL: Points to your backend (FastAPI/Python). 
// WS_BASE_URL: The WebSocket endpoint for real-time streaming.
const API_BASE_URL = process.env.REACT_APP_API_URL || "http://127.0.0.1:8000";
const WS_BASE_URL = process.env.REACT_APP_WEBSOCKET_URL || "ws://127.0.0.1:8000/ws";
const API_URL = API_BASE_URL.replace(/\/$/, "") + "/api"; // Standardized base for REST endpoints

export default function App() {
  // --- STATE MANAGEMENT ---
  const [theme, setTheme] = useState(getInitialTheme);
  const [tab, setTab] = useState("stt");
  const [lang, setLang] = useState("en-US");
  
  // UI Status & Loading states: Controls spinners and progress bars
  const [isRecording, setIsRecording] = useState(false);
  const [isProcessingFile, setIsProcessingFile] = useState(false);
  const [isProcessingLive, setIsProcessingLive] = useState(false); 
  const [processingProgress, setProcessingProgress] = useState(0);
  const [status, setStatus] = useState("Idle");

  // Transcription Data: Stores the raw results from the server
  const [finalText, setFinalText] = useState("");      // The high-accuracy result (processed)
  const [partialText, setPartialText] = useState("");    // Intermediary "live" text (real-time)
  const [liveTranscript, setLiveTranscript] = useState(""); // Aggregated results for live mode
  
  // File & Session tracking: Essential for the ZIP download functionality
  const [canCopy, setCanCopy] = useState(false);
  const [downloadFormat, setDownloadFormat] = useState("");
  const [audioChunks, setAudioChunks] = useState([]);    // Used for local browser recording
  const [audioBlob, setAudioBlob] = useState(null);      
  const [fileToProcess, setFileToProcess] = useState(null); // The file object from the <input>
  const [liveSessionId, setLiveSessionId] = useState(null); // ID for Live mode downloads
  const [fileId, setFileId] = useState(null);               // ID for File mode downloads
  const [lastMode, setLastMode] = useState(null);           // Tracks which ID to use for download ('live' vs 'file')

  // Sentiment & Summary Analysis: Stores AI-generated insights
  const [overallSentiment, setOverallSentiment] = useState({
    distribution: { positive: "0%", neutral: "0%", negative: "0%" },
    label: "Neutral",
    score: 0
  });
  const [showSummaryModal, setShowSummaryModal] = useState(false);
  const [summaryText, setSummaryText] = useState("");

  // --- REFS ---
  // We use refs for audio/socket objects so they persist without triggering re-renders
  const socketRef = useRef(null);
  const streamRef = useRef(null);
  const audioContextRef = useRef(null);
  const processorRef = useRef(null);
  const sourceRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const analyserRef = useRef(null);
  const animationFrameRef = useRef(null);
  const transcriptPanelRef = useRef(null); // Ref for the auto-scrolling <div>

  // State for the animated waveform visualizer (12 bars)
  const [audioLevels, setAudioLevels] = useState(new Array(12).fill(0));

  // Effect: Applies theme change to the <html> tag and saves to localStorage
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('theme', theme);
  }, [theme]);

  // Effect: Auto-scrolling logic. Fires whenever transcription text updates
  useEffect(() => {
    const panel = transcriptPanelRef.current;
    if (panel) {
      panel.scrollTop = panel.scrollHeight;
    }
  }, [liveTranscript, partialText]);

  // Toggle function for the Dark/Light mode switch
  const toggleTheme = useCallback(() => {
    setTheme(prevTheme => prevTheme === 'dark' ? 'light' : 'dark');
  }, []);

  // Helper to assign CSS classes for sentiment color highlighting
  const getSentimentClass = (label) => {
    const lower = label?.toLowerCase() || "";
    if (lower.includes("pos")) return "positive";
    if (lower.includes("neg")) return "negative";
    return "neutral";
  };

  // ---- LIVE RECORDING LOGIC (WEBSOCKETS) ----
  const startLive = async () => {
    try {
      setStatus("Requesting microphone…");
      // Reset all previous session states before starting a new one
      setFinalText("");
      setPartialText("");
      setLiveTranscript("");
      setCanCopy(false);
      setAudioBlob(null);
      setFileToProcess(null);
      setFileId(null);
      setLiveSessionId(null);
      setLastMode("live");

      // Initialize microphone stream (16kHz mono is standard for speech AI)
      const stream = await navigator.mediaDevices.getUserMedia({ audio: { channelCount: 1, sampleRate: 16000 } });
      streamRef.current = stream;

      setStatus("Connecting to Local Backend…");
      const cleanedWsBase = WS_BASE_URL.replace(/\/$/, "").replace("/ws", "");
      const ws = new WebSocket(cleanedWsBase + "/api/live-transcribe");
      socketRef.current = ws;

      ws.onopen = () => {
        setStatus("Connected, streaming audio…");
        
        // Setup Web Audio API for real-time processing
        const audioCtx = new (window.AudioContext || window.webkitAudioContext)({ sampleRate: 16000 });
        audioContextRef.current = audioCtx;
        const source = audioCtx.createMediaStreamSource(stream);
        sourceRef.current = source;

        // Setup Analyser for waveform visualization
        const analyser = audioCtx.createAnalyser();
        analyser.fftSize = 256;
        analyser.smoothingTimeConstant = 0.8;
        analyserRef.current = analyser;

        // Capture audio in chunks of 4096 samples
        const processor = audioCtx.createScriptProcessor(4096, 1, 1);
        processorRef.current = processor;

        source.connect(analyser);
        analyser.connect(processor);
        processor.connect(audioCtx.destination);

        // This event converts Float32 mic data to Int16 before sending to backend
        processor.onaudioprocess = (e) => {
          const float32 = e.inputBuffer.getChannelData(0);
          let buffer = new ArrayBuffer(float32.length * 2);
          let view = new DataView(buffer);
          for (let i = 0; i < float32.length; i++) {
            let s = Math.max(-1, Math.min(1, float32[i]));
            view.setInt16(i * 2, s < 0 ? s * 0x8000 : s * 0x7fff, true);
          }
          if (ws.readyState === WebSocket.OPEN) ws.send(buffer);
        };

        // Recursive function to update the visualizer UI
        const updateWaveform = () => {
          if (!analyserRef.current) return;
          const dataArray = new Uint8Array(analyserRef.current.frequencyBinCount);
          analyserRef.current.getByteFrequencyData(dataArray);
          const barCount = 12;
          const step = Math.floor(dataArray.length / barCount);
          const levels = [];
          for (let i = 0; i < barCount; i++) {
            const index = i * step;
            const value = dataArray[index] || 0;
            levels.push((value / 255) * 100);
          }
          setAudioLevels(levels);
          animationFrameRef.current = requestAnimationFrame(updateWaveform);
        };
        updateWaveform();

        // Secondary recorder to create a downloadable file of the live session
        const mr = new MediaRecorder(stream, { mimeType: "audio/webm" });
        mediaRecorderRef.current = mr;
        mr.ondataavailable = (evt) => {
          if (evt.data.size > 0) setAudioChunks((prev) => [...prev, evt.data]);
        };
        mr.onstop = () => {
          const blob = new Blob(audioChunks, { type: "audio/webm" });
          setAudioBlob(blob);
          setAudioChunks([]);
        };
        mr.start(1000);
      };

      // Listener for results coming BACK from the server via WebSocket
      ws.onmessage = (msg) => {
        try {
          const data = JSON.parse(msg.data);
          
          // Capture session ID for ZIP download functionality
          if (data.session_id) setLiveSessionId(data.session_id);

          if (data.type === "final" && data.text) {
            setLiveTranscript(prev => (prev.trimEnd() + " " + data.text).trim());
            setPartialText(""); // Clear interim text when a full sentence is finalized
            if (data.sentiment) setOverallSentiment(data.sentiment);
          } else if (data.type === "partial" && data.text) {
            setPartialText(data.text); // Display "guessing" text as user speaks
            if (data.sentiment) setOverallSentiment(data.sentiment);
          } else if (data.type === "session_end" && data.final_text) {
            // Server has finished processing the entire stream
            setFinalText((data.final_text || "").trim());
            setPartialText("");
            setStatus("✅ Final transcription ready");
            setCanCopy(true);
            if (data.overall_sentiment) setOverallSentiment(data.overall_sentiment);
            if (data.summary) setSummaryText(data.summary);
            setIsProcessingLive(false);
          }
        } catch (e) {
          console.error("Error parsing WebSocket message:", e);
        }
      };

      ws.onerror = () => {
        setStatus("Error");
        stopLive(true);
      };

      setIsRecording(true);
      setAudioChunks([]);
    } catch (err) {
      alert("Microphone permission or connection failed.");
      setStatus("Error");
    }
  };

  // Function to shut down microphone, socket, and audio context
  const stopLive = (isError = false) => {
    if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
      socketRef.current.send(JSON.stringify({ text: "stop" }));
      setStatus("Processing final transcript...");
      setIsProcessingLive(true); 
    }

    if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
    setAudioLevels(new Array(12).fill(0));

    try {
      if (processorRef.current) processorRef.current.disconnect();
      if (analyserRef.current) analyserRef.current.disconnect();
      if (sourceRef.current) sourceRef.current.disconnect();
      if (audioContextRef.current) audioContextRef.current.close();
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") mediaRecorderRef.current.stop();
      if (streamRef.current) streamRef.current.getTracks().forEach((t) => t.stop());
    } finally {
      streamRef.current = null;
      audioContextRef.current = null;
      processorRef.current = null;
      sourceRef.current = null;
      analyserRef.current = null;
      mediaRecorderRef.current = null;
      if (isError) setStatus("Error");
      setIsRecording(false);
    }
  };

  // Handles selecting a file from local machine
  const onPickFile = (e) => {
    if (isRecording) stopLive(true);
    const file = e.target.files?.[0];
    setAudioBlob(null);
    setLiveSessionId(null);
    setFileId(null);
    setLastMode("file");

    if (file) {
      setFileToProcess(file);
      setFinalText("");
      setPartialText("");
      setLiveTranscript("");
      setCanCopy(false);
      setStatus(`File Selected: ${file.name}`);
    }
    e.target.value = ""; // Clear input to allow re-selection of the same file
  };

  // ---- FILE UPLOAD & PROCESSING LOGIC ----
  const onProcessFile = async () => {
    if (!fileToProcess) return;
    const file = fileToProcess;

    setFinalText("");
    setPartialText("");
    setLiveTranscript("");
    setIsProcessingFile(true);
    setProcessingProgress(0);

    // Creates a pseudo-progress bar for the UI while the server works
    let progressInterval = null;
    const simulateProgress = () => {
      let progress = 0;
      progressInterval = setInterval(() => {
        progress += Math.random() * 8 + 2;
        if (progress >= 95) {
          progress = 95;
          setProcessingProgress(95);
        } else {
          setProcessingProgress(Math.min(Math.round(progress), 95));
        }
      }, 400);
    };

    try {
      setStatus(`Uploading: ${file.name}...`);
      const fd = new FormData();
      fd.append("file", file);
      simulateProgress();

      // Send the file to the REST endpoint
      const res = await fetch(API_URL + "/file-transcribe", { method: "POST", body: fd });
      
      if (!res.ok) throw new Error(`Server error: ${res.status}`);

      const data = await res.json();
      
      if (progressInterval) clearInterval(progressInterval);
      setProcessingProgress(100);

      // Extract results from server response
      const transcription = data?.transcription;
      const text = transcription?.text || transcription || "";
      const sentiment = data?.overall_sentiment || null;
      const summary = data?.summary || "";

      // Store file_id to enable the ZIP download for this file
      if (data.file_id) {
        setFileId(data.file_id);
        setLastMode("file"); 
      }

      if (sentiment) setOverallSentiment({
        label: sentiment.label || "Neutral",
        score: sentiment.score || 0,
        distribution: sentiment.distribution || { positive: "0%", neutral: "0%", negative: "0%" },
      });

      setAudioBlob(file);
      setFinalText(text);
      setCanCopy(!!text);
      setStatus("Complete");
      if (summary) setSummaryText(summary);

    } catch (err) {
      console.error("Transcription failed:", err);
      if (progressInterval) clearInterval(progressInterval);
      alert("Transcription failed: " + err.message);
      setStatus("Failed");
    } finally {
      // Ensure UI states are reset even if an error occurs
      setIsProcessingFile(false);
      setProcessingProgress(0);
      setFileToProcess(null);
    }
  };

  // Standard clipboard copy function
  const onCopy = async () => {
    if (!canCopy || !finalText.trim()) return;
    await navigator.clipboard.writeText(finalText.trim());
    alert("Copied to clipboard!");
  };

  // ---- DOWNLOAD HANDLER: TRIGGERS ZIP DOWNLOAD FROM BACKEND ----
  const onDownload = async () => {
    if (!finalText.trim()) return alert("No transcription to download.");
    if (!downloadFormat) return alert("Please select a file type.");

    const format = downloadFormat;
    let downloadUrl = null;

    // Logic to select the correct endpoint based on whether we processed a file or a live stream
    if (lastMode === "file" && fileId) {
        downloadUrl = `${API_URL}/download-file-result/${fileId}?format=${format}`;
    } else if (lastMode === "live" && liveSessionId) {
        downloadUrl = `${API_URL}/download-transcription/${liveSessionId}?format=${format}`;
    } else {
        return alert("No active session or file ID available.");
    }

    setStatus(`Downloading ${format.toUpperCase()}...`);

    try {
      const resp = await fetch(downloadUrl);
      if (!resp.ok) throw new Error(`Download failed: ${resp.status}`);
      
      // Convert response to a blob and trigger a browser download
      const blob = await resp.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `transcription_${format}.zip`;
      a.click();
      window.URL.revokeObjectURL(url);
      setStatus("Download complete");
    } catch (err) {
      alert("Download failed: " + err.message);
      setStatus("Error");
    }
  };

  // Toggles the summary modal
  const onSummarize = () => {
    if (!summaryText.trim() && !finalText.trim()) {
      alert("Please transcribe audio first.");
      return;
    }
    if (!summaryText.trim()) setSummaryText("No summary available yet.");
    setShowSummaryModal(true);
  };

  const sentimentClass = getSentimentClass(overallSentiment.label);

  return (
    <div className="app">
      <div className="card">
        {/* Header Section */}
        <div className="flex items-center justify-between mb-6">
          <div className="w-1/4">
            <button onClick={toggleTheme} className="theme-toggle">
              {theme === 'dark' ? '☀️ Light Mode' : '🌙 Dark Mode'}
            </button>
          </div>
          <h1 className="app-title flex-1">
            <span className="tab-emoji">🗣️</span> Speech to Text
          </h1>
          <div className="w-1/4"></div>
        </div>

        {/* AI Summary Modal */}
        {showSummaryModal && (
          <div className="modal-overlay" onClick={() => setShowSummaryModal(false)}>
            <div className="modal" onClick={(e) => e.stopPropagation()}>
              <h3>📝 Summary</h3>
              <p>{summaryText}</p>
              <button onClick={() => setShowSummaryModal(false)}>Close</button>
            </div>
          </div>
        )}

        {/* Live Controls Section */}
        <div className="row">
          <select value={lang} onChange={(e) => setLang(e.target.value)} className="select" disabled={isRecording}>
            <option value="en-US">English</option>
          </select>
          {!isRecording ? (
            <button className="speak" onClick={startLive}><span className="mic">🎤</span> Start Recording</button>
          ) : (
            <>
              <button className="stop" onClick={() => stopLive(false)}>⏹ Stop</button>
              {/* Visual Waveform UI */}
              <div className="audio-waveform">
                {audioLevels.map((level, i) => (
                  <div key={i} className="waveform-bar" style={{ height: `${Math.max(20, level)}%` }}></div>
                ))}
              </div>
            </>
          )}
          <div className="status">Status: {status}</div>
        </div>

        {/* Transcription Display Panel */}
        <div className="panel" ref={transcriptPanelRef}> 
          {(isProcessingFile || isProcessingLive) ? (
            <div className="loader-container">
              <div className="loader"></div>
              <p className="loader-text">
                {isProcessingFile ? `Processing file... ${processingProgress}%` : "Processing live transcription..."}
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

        {/* Sentiment Analysis Bar */}
        <div className="sentiment-box">
          <div className="sentiment-row">
            <span className="sentiment-title">🧠 Sentiment Analysis</span>
            <span className="sentiment-sep">|</span>
            <span className={`sentiment-label ${sentimentClass}`}>Overall: {overallSentiment.label?.toUpperCase()}</span>
            <span className="sentiment-sep">|</span>
            <span className="sentiment-positive">😊 Pos: {overallSentiment.distribution?.positive}</span>
            <span className="sentiment-sep">|</span>
            <span className="sentiment-neutral">😐 Neu: {overallSentiment.distribution?.neutral}</span>
            <span className="sentiment-negative">😠 Neg: {overallSentiment.distribution?.negative}</span>
          </div>
        </div>

        {/* File Upload Section */}
        <div className="or"><div className="line" /><div className="or-text">OR</div><div className="line" /></div>

        <label className="transcribe file-btn">
          Use Your Own File
          <input type="file" accept="audio/*,video/*" onChange={onPickFile} hidden />
        </label>
        <button className="transcribe" onClick={onProcessFile} disabled={!fileToProcess || isRecording}>
          {fileToProcess ? `Process: ${fileToProcess.name}` : "Process File"}
        </button>

        {/* Footer Action Row (Copy, Summarize, Download) */}
        <div className="footer footer-row">
          <button className="btn btn-secondary" onClick={onSummarize}><span className="tab-emoji">📝</span> Summarization</button>
          <span className="footer-sep">|</span>
          <button className="btn btn-secondary" onClick={onCopy} disabled={!finalText}>Copy Text</button>
          <span className="footer-sep">|</span>
          <select className="select select--fancy" value={downloadFormat} onChange={(e) => setDownloadFormat(e.target.value)} disabled={!(liveSessionId || fileId) || !finalText}>
            <option value="">Select File Type</option>
            <option value="txt">Text (.txt)</option>
            <option value="docx">Word (.docx)</option>
            <option value="srt">Subtitles (.srt)</option>
            <option value="pdf">PDF (.pdf)</option>
          </select>
          <span className="footer-sep">|</span>
          <button className="btn btn-primary" onClick={onDownload} disabled={!(liveSessionId || fileId) || !finalText || !downloadFormat}>Download ZIP</button>
        </div>
      </div>
    </div>
  );
}