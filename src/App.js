import React, { useRef, useState, useEffect, useCallback } from "react";
import "./App.css";

// Helper function to determine the initial UI theme (Dark/Light) based on browser storage
const getInitialTheme = () => {
  if (typeof localStorage !== 'undefined' && localStorage.getItem('theme')) {
    return localStorage.getItem('theme');
  }
  return 'dark'; // Default to dark mode if no preference is saved
};

// --- CONFIGURATION & ENVIRONMENT VARIABLES ---
// Defines where the frontend connects to the FastAPI/Python backend
const API_BASE_URL = process.env.REACT_APP_API_URL || "http://127.0.0.1:8000";
const WS_BASE_URL = process.env.REACT_APP_WEBSOCKET_URL || "ws://127.0.0.1:8000/ws";
const API_URL = API_BASE_URL.replace(/\/$/, "") + "/api"; // Standardized base for REST endpoints

export default function App() {
  // --- STATE MANAGEMENT ---
  const [theme, setTheme] = useState(getInitialTheme);
  const [tab, setTab] = useState("stt");
  const [lang, setLang] = useState("en-US");
  
  // UI Status & Loading states
  const [isRecording, setIsRecording] = useState(false);
  const [isProcessingFile, setIsProcessingFile] = useState(false);
  const [isProcessingLive, setIsProcessingLive] = useState(false); 
  const [processingProgress, setProcessingProgress] = useState(0);
  const [status, setStatus] = useState("Idle");

  // Transcription Data
  const [finalText, setFinalText] = useState("");      // Completed, accurate transcription
  const [partialText, setPartialText] = useState("");    // Real-time "guessing" text from server
  const [liveTranscript, setLiveTranscript] = useState(""); // Cumulative live results
  
  // File & Session tracking
  const [canCopy, setCanCopy] = useState(false);
  const [downloadFormat, setDownloadFormat] = useState("");
  const [audioChunks, setAudioChunks] = useState([]);    // Raw audio data for local blob creation
  const [audioBlob, setAudioBlob] = useState(null);      // Finalized audio file
  const [fileToProcess, setFileToProcess] = useState(null); // Selected file for upload
  const [liveSessionId, setLiveSessionId] = useState(null); // Server-side session reference
  const [fileId, setFileId] = useState(null);               // Server-side file reference
  const [lastMode, setLastMode] = useState(null);           // 'live' or 'file'

  // Sentiment & Summary Analysis
  const [overallSentiment, setOverallSentiment] = useState({
    distribution: { positive: "0%", neutral: "0%", negative: "0%" },
    label: "Neutral",
    score: 0
  });
  const [showSummaryModal, setShowSummaryModal] = useState(false);
  const [summaryText, setSummaryText] = useState("");

  // --- REFS ---
  // Used for persistent objects that shouldn't trigger re-renders (Audio/Sockets)
  const socketRef = useRef(null);
  const streamRef = useRef(null);
  const audioContextRef = useRef(null);
  const processorRef = useRef(null);
  const sourceRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const analyserRef = useRef(null);
  const animationFrameRef = useRef(null);
  const transcriptPanelRef = useRef(null); // Ref for auto-scrolling logic

  const [audioLevels, setAudioLevels] = useState(new Array(12).fill(0)); // Visualizer bars data

  // Effect: Update the data-theme attribute on the HTML root whenever theme state changes
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('theme', theme);
  }, [theme]);

  // Effect: Auto-scrolling logic
  // Automatically scrolls the transcription panel to the bottom when new text arrives
  useEffect(() => {
    const panel = transcriptPanelRef.current;
    if (panel) {
      panel.scrollTop = panel.scrollHeight;
    }
  }, [liveTranscript, partialText]);

  // Toggle between Light and Dark modes
  const toggleTheme = useCallback(() => {
    setTheme(prevTheme => prevTheme === 'dark' ? 'light' : 'dark');
  }, []);

  // Combined string for the display area
  const displayText = (finalText ? finalText.trimEnd() : "") + (partialText ? " " + partialText : "");

  // Helper for CSS class application based on sentiment label
  const getSentimentClass = (label) => {
    const lower = label?.toLowerCase() || "";
    if (lower.includes("pos")) return "positive";
    if (lower.includes("neg")) return "negative";
    return "neutral";
  };

  // ---- LIVE RECORDING LOGIC ----
  const startLive = async () => {
    try {
      setStatus("Requesting microphone…");
      // Reset previous session data
      setFinalText("");
      setPartialText("");
      setLiveTranscript("");
      setCanCopy(false);
      setAudioBlob(null);
      setFileToProcess(null);
      setFileId(null);
      setLiveSessionId(null);
      setLastMode("live");

      // Request hardware access
      const stream = await navigator.mediaDevices.getUserMedia({ audio: { channelCount: 1, sampleRate: 16000 } });
      streamRef.current = stream;

      setStatus("Connecting to Local Backend…");
      // Connect to the WebSocket for streaming audio bits
      const cleanedWsBase = WS_BASE_URL.replace(/\/$/, "").replace("/ws", "");
      const ws = new WebSocket(cleanedWsBase + "/api/live-transcribe");
      socketRef.current = ws;

      ws.onopen = () => {
        setStatus("Connected, streaming audio…");

        // Web Audio API setup to capture and process audio samples
        const audioCtx = new (window.AudioContext || window.webkitAudioContext)({ sampleRate: 16000 });
        audioContextRef.current = audioCtx;
        const source = audioCtx.createMediaStreamSource(stream);
        sourceRef.current = source;

        // Analyser node for the visual waveform animation
        const analyser = audioCtx.createAnalyser();
        analyser.fftSize = 256;
        analyser.smoothingTimeConstant = 0.8;
        analyserRef.current = analyser;

        // ScriptProcessor captures audio in chunks (4096 samples)
        const processor = audioCtx.createScriptProcessor(4096, 1, 1);
        processorRef.current = processor;

        // Audio node routing: Mic -> Analyser -> Processor -> Destination
        source.connect(analyser);
        analyser.connect(processor);
        processor.connect(audioCtx.destination);

        // This event fires whenever 4096 samples are ready to be sent
        processor.onaudioprocess = (e) => {
          const float32 = e.inputBuffer.getChannelData(0);
          let buffer = new ArrayBuffer(float32.length * 2);
          let view = new DataView(buffer);
          // Convert Float32 audio samples to Int16 for efficient streaming
          for (let i = 0; i < float32.length; i++) {
            let s = Math.max(-1, Math.min(1, float32[i]));
            view.setInt16(i * 2, s < 0 ? s * 0x8000 : s * 0x7fff, true);
          }
          if (ws.readyState === WebSocket.OPEN) ws.send(buffer);
        };

        // Animation function for the waveform visualizer
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

        // Standard MediaRecorder for creating a downloadable blob later
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
        mr.start(1000); // Collect chunks every second
      };

      // Handle incoming messages from the backend (Transcriptions, Sentiment)
      ws.onmessage = (msg) => {
        try {
          const data = JSON.parse(msg.data);

          if (data.session_id) setLiveSessionId(data.session_id);

          if (data.type === "final" && data.text) {
            // "Final" means the server is certain about this sentence
            setLiveTranscript(prev => (prev.trimEnd() + " " + data.text).trim());
            setPartialText("");
            if (data.sentiment) setOverallSentiment(data.sentiment);
          } else if (data.type === "partial" && data.text) {
            // "Partial" is interim text while the user is still speaking
            setPartialText(data.text);
            if (data.sentiment) setOverallSentiment(data.sentiment);
          } else if (data.type === "session_end" && data.final_text) {
            // Cleanup and summarize after session ends
            const final = (data.final_text || "").trim();
            const summary = data.summary || "";
            setFinalText(final);
            setPartialText("");
            setStatus("✅ Final transcription ready");
            setCanCopy(true);
            if (data.overall_sentiment) setOverallSentiment(data.overall_sentiment);
            if (summary) setSummaryText(summary);
            setIsProcessingLive(false);
          }
        } catch (e) {
          console.error("Error parsing WebSocket message:", e);
        }
      };

      ws.onerror = (e) => {
        console.error("WebSocket error", e);
        setStatus("Error");
        stopLive(true);
      };

      ws.onclose = () => {
        if (isRecording) setStatus("Waiting for final transcription...");
        else setStatus("Closed");
      };

      setIsRecording(true);
      setAudioChunks([]);
    } catch (err) {
      console.error("Mic/Connection error:", err);
      alert("Microphone permission or connection failed.");
      setStatus("Error");
    }
  };

  // Stops audio tracks, closes WebSocket, and cleans up AudioContext
  const stopLive = (isError = false) => {
    if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
      socketRef.current.send(JSON.stringify({ text: "stop" }));
      setStatus("Processing final transcript...");
      setIsProcessingLive(true); 
    }

    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }
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

  // ---- FILE UPLOAD & PROCESS LOGIC ----
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
    } else {
      setFileToProcess(null);
      setStatus("Idle");
      setLastMode(null);
    }
    e.target.value = ""; // Reset input so same file can be selected again
  };

  const onProcessFile = async () => {
    if (!fileToProcess) return;
    const file = fileToProcess;

    setFinalText("");
    setPartialText("");
    setLiveTranscript("");
    setIsProcessingFile(true);
    setProcessingProgress(0);

    // Simulates an upload bar since fetch doesn't provide natively granular upload progress
    let progressInterval = null;
    const simulateProgress = () => {
      let progress = 0;
      progressInterval = setInterval(() => {
        progress += Math.random() * 12 + 3;
        if (progress >= 95) {
          progress = 95;
          setProcessingProgress(95);
        } else {
          setProcessingProgress(Math.min(Math.round(progress), 95));
        }
      }, 300);
    };

    try {
      setStatus(`Uploading: ${file.name}...`);
      const fd = new FormData();
      fd.append("file", file);
      simulateProgress();

      // REST API call to process the uploaded file
      const res = await fetch(API_URL + "/file-transcribe", { method: "POST", body: fd });

      setStatus("Processing...");
      if (!res.ok) throw new Error(await res.text());

      if (progressInterval) clearInterval(progressInterval);
      setProcessingProgress(100);
      await new Promise(resolve => setTimeout(resolve, 300)); // Brief pause for visual smoothness

      const data = await res.json();
      const transcription = data?.transcription;
      const text = transcription?.text || transcription || "";
      const sentiment = data?.overall_sentiment || null;
      const summary = data?.summary || "";

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
      console.error(err);
      if (progressInterval) clearInterval(progressInterval);
      alert("Transcription failed: " + err.message);
      setStatus("Failed");
    } finally {
      setIsProcessingFile(false);
      setProcessingProgress(0);
      setFileToProcess(null);
    }
  };

  // ---- COPY TO CLIPBOARD ----
  const onCopy = async () => {
    if (!canCopy || !finalText.trim()) return;
    await navigator.clipboard.writeText(finalText.trim());
    alert("Copied to clipboard!");
  };

  // ---- DOWNLOAD HANDLER ----
  const onDownload = async () => {
    if (!finalText.trim()) {
      alert("No final transcription to download.");
      return;
    }
    if (!downloadFormat) {
      alert("Please select a file type.");
      return;
    }

    const format = downloadFormat;
    let downloadUrl = null;

    // Directs the browser to the correct endpoint depending on if the work was Live or File-based
    if (lastMode === "file" && fileId) downloadUrl = `${API_URL}/download-file-result/${fileId}?format=${format}`;
    else if (lastMode === "live" && liveSessionId) downloadUrl = `${API_URL}/download-transcription/${liveSessionId}?format=${format}`;
    else {
      alert("No active session or file ID available to download.");
      return;
    }

    setStatus(`Requesting ${format.toUpperCase()} download...`);

    try {
      const resp = await fetch(downloadUrl);
      if (!resp.ok) throw new Error(`Download failed. Server returned status: ${resp.status}`);

      const blob = await resp.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `transcription_session_${format}.zip`;
      a.click();
      window.URL.revokeObjectURL(url); // Clean up memory
      setStatus("Download complete");

    } catch (err) {
      console.error("Download failed:", err);
      alert("Download failed: " + err.message);
      setStatus("Error during download");
    }
  };

  // ---- SUMMARIZATION TRIGGER ----
  const onSummarize = async () => {
    if (!summaryText.trim() && !finalText.trim()) {
      alert("Please transcribe audio first.");
      return;
    }

    if (summaryText.trim()) {
      setShowSummaryModal(true);
      return;
    }

    setSummaryText("⚠️ No summary available yet. Try transcribing a file or live session first.");
    setShowSummaryModal(true);
  };

  // UI class determination for sentiment coloring
  const sentimentClass = getSentimentClass(overallSentiment.label);

  return (
    <div className="app">
      <div className="card">
        {/* Header: Theme Toggle and App Title */}
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

        {/* Modal: Summary Display */}
        {showSummaryModal && (
          <div className="modal-overlay" onClick={() => setShowSummaryModal(false)}>
            <div className="modal" onClick={(e) => e.stopPropagation()}>
              <h3>📝 Summary</h3>
              <p>{summaryText}</p>
              <button onClick={() => setShowSummaryModal(false)}>Close</button>
            </div>
          </div>
        )}

        {/* Controls: Language selection and Start/Stop buttons */}
        <div className="row">
          <select value={lang} onChange={(e) => setLang(e.target.value)} className="select" disabled={isRecording}>
            <option value="en-US">English</option>
          </select>

          {!isRecording ? (
            <button className="speak" onClick={startLive}>
              <span className="mic">🎤</span> Start Recording
            </button>
          ) : (
            <>
              <button className="stop" onClick={() => stopLive(false)}>⏹ Stop</button>
              {/* Waveform Visualization Bars */}
              <div className="audio-waveform">
                {audioLevels.map((level, i) => (
                  <div key={i} className="waveform-bar" style={{ height: `${Math.max(20, level)}%`, transition: 'height 0.1s ease-out' }}></div>
                ))}
              </div>
            </>
          )}
          <div className="status">Status: {status}</div>
        </div>

        {/* Transcription Panel: Displays live and final text */}
        <div className="panel" ref={transcriptPanelRef}> 
          {(isProcessingFile || isProcessingLive) ? (
            <div className="loader-container">
              <div className="loader"></div>
              <p className="loader-text">
                {isProcessingFile ? `Processing your file... ${processingProgress}%` : "Processing live transcription..."}
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
              {!liveTranscript && !isProcessingLive && <div className="hint">Live transcription will appear here.</div>}
            </div>
          ) : (
            <div className="hint">Speak or upload audio, and we'll turn it into text.</div>
          )}
        </div>

        {/* Sentiment Analysis Display */}
        <div className="sentiment-box">
          <div className="sentiment-row">
            <span className="sentiment-title">🧠 Sentiment Analysis</span>
            <span className="sentiment-sep">|</span>
            <span className={`sentiment-label ${sentimentClass}`}>Overall Sentiment: {overallSentiment.label?.toUpperCase() || 'N/A'}</span>
            <span className="sentiment-sep">|</span>
            <span className="sentiment-positive">😊 Positive: {overallSentiment.distribution?.positive || "0%"}</span>
            <span className="sentiment-sep">|</span>
            <span className="sentiment-neutral">😐 Neutral: {overallSentiment.distribution?.neutral || "0%"}</span>
            <span className="sentiment-sep">|</span>
            <span className="sentiment-negative">😠 Negative: {overallSentiment.distribution?.negative || "0%"}</span>
          </div>
        </div>

        {/* Divider for File Upload section */}
        <div className="or">
          <div className="line" />
          <div className="or-text">OR</div>
          <div className="line" />
        </div>

        {/* File Selection Logic */}
        <label className="transcribe file-btn">
          Use Your Own File
          <input type="file" accept="audio/*,video/*" onChange={onPickFile} hidden />
        </label>

        <button className="transcribe" onClick={onProcessFile} disabled={!fileToProcess || isRecording}>
          {fileToProcess ? `Process File: ${fileToProcess.name}` : "Process File"}
        </button>

        {/* Footer: Copy, Download, and Summary actions */}
        <div className="footer footer-row">
          <button className="btn btn-secondary" onClick={onSummarize}><span className="tab-emoji">📝</span> Summarization</button>
          <span className="footer-sep">|</span>
          <button className="btn btn-secondary" onClick={onCopy} disabled={!finalText}>Copy Generated Text</button>
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