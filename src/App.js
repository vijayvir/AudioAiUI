import React, { useRef, useState } from "react";
import "./App.css";

// --- ENVIRONMENT VARIABLES ---
const API_BASE_URL = process.env.REACT_APP_API_URL || "http://127.0.0.1:8000";
const WS_BASE_URL = process.env.REACT_APP_WEBSOCKET_URL || "ws://127.0.0.1:8000/ws";
const API_URL = API_BASE_URL.replace(/\/$/, "") + "/api"; // Helper for download URLs

export default function App() {
  const [tab, setTab] = useState("stt");
  const [lang, setLang] = useState("en-US");
  const [isRecording, setIsRecording] = useState(false);
  const [status, setStatus] = useState("Idle");
  const [finalText, setFinalText] = useState("");
  const [partialText, setPartialText] = useState("");
  const [liveTranscript, setLiveTranscript] = useState(""); // Accumulated live transcript chunks
  const [canCopy, setCanCopy] = useState(false);
  const [downloadFormat, setDownloadFormat] = useState("");
  const [isProcessingFile, setIsProcessingFile] = useState(false);
  const [processingProgress, setProcessingProgress] = useState(0); 

  const [audioChunks, setAudioChunks] = useState([]);
  const [audioBlob, setAudioBlob] = useState(null);
  const [fileToProcess, setFileToProcess] = useState(null);

  // State for Backend Download Integration
  const [liveSessionId, setLiveSessionId] = useState(null); 
  const [fileId, setFileId] = useState(null); 
  const [lastMode, setLastMode] = useState(null); 

  // 🧠 Sentiment state
  const [overallSentiment, setOverallSentiment] = useState({
    distribution: { positive: "0%", neutral: "0%", negative: "0%" },
    label: "Neutral", 
    score: 0
  });

  // --- Summarization (WIP) ---
  const [showSummaryModal, setShowSummaryModal] = useState(false);
  const [summaryText, setSummaryText] = useState("");

  // Refs for Web Audio API
  const socketRef = useRef(null);
  const streamRef = useRef(null);
  const audioContextRef = useRef(null);
  const processorRef = useRef(null);
  const sourceRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const analyserRef = useRef(null);
  const animationFrameRef = useRef(null);

  // Waveform audio levels state (12 bars)
  const [audioLevels, setAudioLevels] = useState(new Array(12).fill(0));

  // FIX: displayText is correctly structured to show LIVE + PARTIAL or FINAL
  // For live recording: show liveTranscript + partialText
  // For file upload: show finalText
  const displayText =
    (finalText ? finalText.trimEnd() : "") +
    (partialText ? " " + partialText : "");

  // Helper for CSS class mapping
  const getSentimentClass = (label) => {
    const lower = label?.toLowerCase() || "";
    if (lower.includes("pos")) return "positive";
    if (lower.includes("neg")) return "negative";
    return "neutral";
  };
  
  // ---- LIVE RECORDING ----
  const startLive = async () => {
    try {
      // FIX: Resetting text and IDs before starting
      setStatus("Requesting microphone…");
      setFinalText("");
      setPartialText("");
      setLiveTranscript("");
      setCanCopy(false);
      setAudioBlob(null);
      setFileToProcess(null);
      setFileId(null);
      setLiveSessionId(null);
      setLastMode("live"); // Set mode right away

      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { channelCount: 1, sampleRate: 16000 },
      });
      streamRef.current = stream;

      setStatus("Connecting to Local Backend…");
      const cleanedWsBase = WS_BASE_URL.replace(/\/$/, "").replace("/ws", "");
      const ws = new WebSocket(cleanedWsBase + "/api/live-transcribe");
      socketRef.current = ws;

      ws.onopen = () => {
        setStatus("Connected, streaming audio…");
        
        const audioCtx = new (window.AudioContext || window.webkitAudioContext)({
          sampleRate: 16000,
        });
        audioContextRef.current = audioCtx;
        const source = audioCtx.createMediaStreamSource(stream);
        sourceRef.current = source;
        
        // Create AnalyserNode for waveform visualization
        const analyser = audioCtx.createAnalyser();
        analyser.fftSize = 256;
        analyser.smoothingTimeConstant = 0.8;
        analyserRef.current = analyser;
        
        const processor = audioCtx.createScriptProcessor(4096, 1, 1);
        processorRef.current = processor;

        source.connect(analyser);
        analyser.connect(processor);
        processor.connect(audioCtx.destination);

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

        // Start waveform animation
        const updateWaveform = () => {
          if (!analyserRef.current) return;
          
          const dataArray = new Uint8Array(analyserRef.current.frequencyBinCount);
          analyserRef.current.getByteFrequencyData(dataArray);
          
          // Map frequency data to 12 bars
          const barCount = 12;
          const step = Math.floor(dataArray.length / barCount);
          const levels = [];
          
          for (let i = 0; i < barCount; i++) {
            const index = i * step;
            const value = dataArray[index] || 0;
            // Normalize to 0-100% for bar height
            levels.push((value / 255) * 100);
          }
          
          setAudioLevels(levels);
          animationFrameRef.current = requestAnimationFrame(updateWaveform);
        };
        
        updateWaveform();

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

      ws.onmessage = (msg) => {
        try {
          const data = JSON.parse(msg.data);

          // CAPTURE SESSION ID
          if (data.session_id) {
            setLiveSessionId(data.session_id);
          }
          
          if (data.type === "final" && data.text) {
             // FIX: When a 'final' segment arrives, append it to liveTranscript and clear partialText
            setLiveTranscript(prev => (prev.trimEnd() + " " + data.text).trim());
            setPartialText("");
            
            if (data.sentiment) setOverallSentiment(data.sentiment); 

          } else if (data.type === "partial" && data.text) {
            // FIX: Only update the partial text state
            setPartialText(data.text);
            if (data.sentiment) setOverallSentiment(data.sentiment);

          } else if (data.type === "session_end" && data.final_text) {
            // FIX: Handle final overall result sent by backend after 'stop'
            // Store the enhanced/formatted version in finalText, but keep liveTranscript
            const final = (data.final_text || "").trim();
            const summary = data.summary || "";
            setFinalText(final);
            setPartialText("");
            setStatus("✅ Final transcription ready");
            setCanCopy(true);
            if (data.overall_sentiment) setOverallSentiment(data.overall_sentiment);

            if (summary) {
              setSummaryText(summary);
              // setShowSummaryModal(true);
            }
          }
        } catch (e) {
          console.error("Error parsing WebSocket message:", e);
        }
      };

      ws.onerror = (e) => {
        console.error("WebSocket error", e);
        setStatus("Error");
        stopLive(true); // Stop cleanup immediately on error
      };
      
      // FIX: ws.onclose should not immediately run all stopLive cleanup
      // The backend should send 'session_end' first, then close connection.
      ws.onclose = () => {
        // If we haven't already finished, wait for final results or assume closed
        if (isRecording) {
            setStatus("Waiting for final transcription...");
        } else {
            setStatus("Closed");
        }
      };

      setIsRecording(true);
      setAudioChunks([]);
    } catch (err) {
      console.error("Mic/Connection error:", err);
      alert("Microphone permission or connection failed.");
      setStatus("Error");
    }
  };

  const stopLive = (isError = false) => {
    // FIX: Send a message to the backend to process the final transcription
    if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
        socketRef.current.send(JSON.stringify({ text: "stop" }));
        setStatus("Processing final transcript...");
        // Do NOT close the socket here; let the backend send the final message first.
    }
    
    // Stop waveform animation
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }
    
    // Reset audio levels
    setAudioLevels(new Array(12).fill(0));
    
    // Cleanup Web Audio API and Mic stream
    try {
      if (processorRef.current) processorRef.current.disconnect();
      if (analyserRef.current) analyserRef.current.disconnect();
      if (sourceRef.current) sourceRef.current.disconnect();
      if (audioContextRef.current) audioContextRef.current.close();
      
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
        mediaRecorderRef.current.stop();
      }
      
      if (streamRef.current)
        streamRef.current.getTracks().forEach((t) => t.stop());
        
    } finally {
      // Reset refs
      streamRef.current = null;
      audioContextRef.current = null;
      processorRef.current = null;
      sourceRef.current = null;
      analyserRef.current = null;
      mediaRecorderRef.current = null;
      
      // Reset status if it was an error, otherwise keep "Processing" status 
      // until the final WS message comes in.
      if (isError) setStatus("Error");
      
      setIsRecording(false);
      // Do NOT clear text here; we need to wait for the final message.
    }
  };

  // ---- FILE UPLOAD & PROCESS ----
  const onPickFile = (e) => {
    // Ensure live cleanup happens before starting file process
    if (isRecording) stopLive(true); 

    const file = e.target.files?.[0];
    setAudioBlob(null);
    setLiveSessionId(null); 
    setFileId(null);         
    setLastMode("file"); // Default to file mode for upload flow

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
    e.target.value = "";
  };

  const onProcessFile = async () => {
    if (!fileToProcess) return;
    const file = fileToProcess;
    
    // Reset output text
    setFinalText("");
    setPartialText("");
    setLiveTranscript("");
    setIsProcessingFile(true);
    setProcessingProgress(0);

    // Simulate progress function
    let progressInterval = null;
    const simulateProgress = () => {
      let progress = 0;
      progressInterval = setInterval(() => {
        progress += Math.random() * 12 + 3; // Random increment between 3-15%
        if (progress >= 95) {
          progress = 95; // Stop at 95%, wait for actual completion
          setProcessingProgress(95);
        } else {
          setProcessingProgress(Math.min(Math.round(progress), 95));
        }
      }, 300); // Update every 300ms
    };

    try {
      setStatus(`Uploading: ${file.name}...`);
      const fd = new FormData();
      fd.append("file", file);

      // Start progress simulation
      simulateProgress();

      const res = await fetch(
        API_URL + "/file-transcribe",
        { method: "POST", body: fd }
      );

      setStatus("Processing...");
      if (!res.ok) throw new Error(await res.text());

      // Complete progress to 100%
      if (progressInterval) clearInterval(progressInterval);
      setProcessingProgress(100);
      
      // Small delay to show 100% before hiding loader
      await new Promise(resolve => setTimeout(resolve, 300));

      const data = await res.json();
      const transcription = data?.transcription;
      const text = transcription?.text || transcription || "";
      const sentiment = data?.overall_sentiment || null;
      const summary = data?.summary || "";

      // CAPTURE FILE ID AND MODE
      if (data.file_id) {
          setFileId(data.file_id);
          setLastMode("file");
      }
      
      if (sentiment) {
        setOverallSentiment({
          label: sentiment.label || "Neutral",
          score: sentiment.score || 0,
          distribution: sentiment.distribution || {
            positive: "0%", neutral: "0%", negative: "0%",
          },
        });
      }

      setAudioBlob(file);
      setFinalText(text);
      setCanCopy(!!text);
      setStatus("Complete");

      if (summary) {
        setSummaryText(summary);
        // setShowSummaryModal(true);
      }

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

  // ---- COPY ----
  const onCopy = async () => {
    if (!canCopy || !finalText.trim()) return;
    await navigator.clipboard.writeText(finalText.trim());
    alert("Copied to clipboard!");
  };

  // ---- DOWNLOAD ----
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

    // Construct download URL based on the last transcription mode and ID
    if (lastMode === "file" && fileId) {
      downloadUrl = `${API_URL}/download-file-result/${fileId}?format=${format}`;
    } else if (lastMode === "live" && liveSessionId) {
      downloadUrl = `${API_URL}/download-transcription/${liveSessionId}?format=${format}`;
    } else {
      alert("No active session or file ID available to download.");
      return;
    }

    setStatus(`Requesting ${format.toUpperCase()} download...`);
    
    try {
      const resp = await fetch(downloadUrl);
      if (!resp.ok) {
        throw new Error(`Download failed. Server returned status: ${resp.status}`);
      }

      const blob = await resp.blob(); 
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `transcription_session_${format}.zip`; 
      a.click();
      window.URL.revokeObjectURL(url);
      setStatus("Download complete");
      
    } catch (err) {
      console.error("Download failed:", err);
      alert("Download failed: " + err.message);
      setStatus("Error during download");
    }
  };

  // ---- SUMMARIZATION ----
  const onSummarize = async () => {
    if (!summaryText.trim() && !finalText.trim()) {
      alert("Please transcribe audio first.");
      return;
    }

    // If we already have summary from backend, show it directly
    if (summaryText.trim()) {
      setShowSummaryModal(true);
      return;
    }

    // Otherwise show fallback message
    setSummaryText("⚠️ No summary available yet. Try transcribing a file or live session first.");
    setShowSummaryModal(true);
  };

  const sentimentClass = getSentimentClass(overallSentiment.label);

  return (
    <div className="app">
      <div className="card">
        {/* Title */}
        <h1 className="app-title">
          <span className="tab-emoji">🗣️</span> Speech to Text
        </h1>
        
        {/* Summary Modal */}
        {showSummaryModal && (
          <div className="modal-overlay" onClick={() => setShowSummaryModal(false)}>
            <div className="modal" onClick={(e) => e.stopPropagation()}>
              <h3>📝 Summary</h3>
              <p>{summaryText}</p>
              <button onClick={() => setShowSummaryModal(false)}>Close</button>
            </div>
          </div>
        )}

        {/* Controls */}
        <div className="row">
          <select
            value={lang}
            onChange={(e) => setLang(e.target.value)}
            className="select"
            disabled={isRecording}
          >
            <option value="en-US">English</option>
          </select>

          {!isRecording ? (
            <button className="speak" onClick={startLive}>
              <span className="mic">🎤</span> Start Recording
            </button>
          ) : (
            <>
              <button className="stop" onClick={() => stopLive(false)}>
                ⏹ Stop
              </button>
              <div className="audio-waveform">
                {audioLevels.map((level, i) => (
                  <div 
                    key={i} 
                    className="waveform-bar" 
                    style={{ 
                      height: `${Math.max(20, level)}%`,
                      transition: 'height 0.1s ease-out'
                    }}
                  ></div>
                ))}
              </div>
            </>
          )}

          <div className="status">Status: {status}</div>
        </div>

        {/* Transcript */}
        <div className="panel">
          {isProcessingFile ? (
            <div className="loader-container">
              <div className="loader"></div>
              <p className="loader-text">Processing your file... {processingProgress}%</p>
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
            <div className="hint">
              Speak or upload audio, and we'll turn it into text.
            </div>
          )}
        </div>

        {/* 🧠 Sentiment Box */}
        <div className="sentiment-box">
          <div className="sentiment-row">
            <span className="sentiment-title">🧠 Sentiment Analysis</span>
            <span className="sentiment-sep">|</span>
            <span className={`sentiment-label ${sentimentClass}`}>
              Overall Sentiment: {overallSentiment.label?.toUpperCase() || 'N/A'}
            </span>
            <span className="sentiment-sep">|</span>
            <span className="sentiment-positive">
              😊 Positive: {overallSentiment.distribution?.positive || "0%"}
            </span>
            <span className="sentiment-sep">|</span>
            <span className="sentiment-neutral">
              😐 Neutral: {overallSentiment.distribution?.neutral || "0%"}
            </span>
            <span className="sentiment-sep">|</span>
            <span className="sentiment-negative">
              😠 Negative: {overallSentiment.distribution?.negative || "0%"}
            </span>
          </div>
        </div>

        {/* OR divider */}
        <div className="or">
          <div className="line" />
          <div className="or-text">OR</div>
          <div className="line" />
        </div>

        {/* File Input */}
        <label className="transcribe file-btn">
          Use Your Own File
          <input
            type="file"
            accept="audio/*,video/*"
            onChange={onPickFile}
            hidden
          />
        </label>

        {/* Process File */}
        <button
          className="transcribe"
          onClick={onProcessFile}
          disabled={!fileToProcess || isRecording}
        >
          {fileToProcess
            ? `Process File: ${fileToProcess.name}`
            : "Process File"}
        </button>

        {/* Footer */}
        <div className="footer footer-row">
          <button className="btn btn-secondary" onClick={onSummarize}>
            <span className="tab-emoji">📝</span> Summarization
          </button>
          <span className="footer-sep">|</span>
          <button className="btn btn-secondary" onClick={onCopy} disabled={!finalText}>
            Copy Generated Text
          </button>
          <span className="footer-sep">|</span>
          
          <select 
            className="select select--fancy"
            value={downloadFormat}
            onChange={(e) => setDownloadFormat(e.target.value)}
            disabled={!(liveSessionId || fileId) || !finalText} 
          >
            <option value="">Select File Type</option>
            <option value="txt">Text (.txt)</option>
            <option value="docx">Word (.docx)</option> 
            <option value="srt">Subtitles (.srt)</option>
            <option value="pdf">PDF (.pdf)</option>
          </select>
          <span className="footer-sep">|</span>
          
          <button
            className="btn btn-primary"
            onClick={onDownload}
            disabled={!(liveSessionId || fileId) || !finalText || !downloadFormat} 
          >
            Download ZIP
          </button>
        </div>
      </div>
    </div>
  );
}
