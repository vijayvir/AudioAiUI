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
  const [canCopy, setCanCopy] = useState(false);
  const [downloadFormat, setDownloadFormat] = useState("txt"); 

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

  // FIX: displayText is correctly structured to show FINAL + PARTIAL
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
        const processor = audioCtx.createScriptProcessor(4096, 1, 1);
        processorRef.current = processor;

        source.connect(processor);
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
             // FIX: When a 'final' segment arrives, append it to finalText and clear partialText
            setFinalText(prev => (prev.trimEnd() + " " + data.text).trim());
            setPartialText("");
            
            if (data.sentiment) setOverallSentiment(data.sentiment); 

          } else if (data.type === "partial" && data.text) {
            // FIX: Only update the partial text state
            setPartialText(data.text);
            if (data.sentiment) setOverallSentiment(data.sentiment);

          } else if (data.type === "session_end" && data.final_text) {
            // FIX: Handle final overall result sent by backend after 'stop'
            const final = (data.final_text || "").trim();
            const summary = data.summary || "";
            setFinalText(final);
            setPartialText("");
            setStatus("✅ Final transcription ready");
            setCanCopy(true);
            if (data.overall_sentiment) setOverallSentiment(data.overall_sentiment);

            if (summary) {
              setSummaryText(summary);
              setShowSummaryModal(true);
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
    
    // Cleanup Web Audio API and Mic stream
    try {
      if (processorRef.current) processorRef.current.disconnect();
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

    try {
      setStatus(`Uploading: ${file.name}...`);
      const fd = new FormData();
      fd.append("file", file);

      const res = await fetch(
        API_URL + "/file-transcribe",
        { method: "POST", body: fd }
      );

      setStatus("Processing...");
      if (!res.ok) throw new Error(await res.text());

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
        setShowSummaryModal(true);
      }

    } catch (err) {
      console.error(err);
      alert("Transcription failed: " + err.message);
      setStatus("Failed");
    } finally {
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
        {/* Tabs */}
        <div className="tabs">
          <button
            className={`tab ${tab === "stt" ? "active" : ""}`}
            onClick={() => setTab("stt")}
          >
            <span className="tab-emoji">🗣️</span> Speech to Text
          </button>
          <button className="tab" onClick={onSummarize}>
            <span className="tab-emoji">📝</span> Summarization
          </button>
          {showSummaryModal && (
            <div className="modal-overlay" onClick={() => setShowSummaryModal(false)}>
              <div className="modal" onClick={(e) => e.stopPropagation()}>
                <h3>📝 Summary</h3>
                <p>{summaryText}</p>
                <button onClick={() => setShowSummaryModal(false)}>Close</button>
              </div>
            </div>
          )}
        </div>

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
            <button className="stop" onClick={() => stopLive(false)}>
              ⏹ Stop
            </button>
          )}

          <div className="status">Status: {status}</div>
        </div>

        {/* Transcript */}
        <div className="panel">
          {displayText ? (
            <div className="text">{displayText}</div>
          ) : (
            <div className="hint">
              Speak or upload audio, and we’ll turn it into text.
            </div>
          )}
        </div>

        {/* 🧠 Sentiment Box */}
        <div className="sentiment-box">
          <h4 className="sentiment-title">🧠 Sentiment Analysis</h4>
          <p className={`sentiment-label ${sentimentClass}`}>
            Overall Sentiment: {overallSentiment.label?.toUpperCase() || 'N/A'}
          </p>
          <div className="sentiment-distribution">
            <span className="sentiment-positive">
              😊 Positive: {overallSentiment.distribution?.positive || "0%"}
            </span>
            <span className="sentiment-neutral">
              😐 Neutral: {overallSentiment.distribution?.neutral || "0%"}
            </span>
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
        <div className="footer">
          <button className="btn btn-secondary" onClick={onCopy} disabled={!finalText}>
            Copy Generated Text
          </button>
          <span className="v-sep" aria-hidden="true"></span>
          
          <select 
            className="select select--fancy"
            value={downloadFormat}
            onChange={(e) => setDownloadFormat(e.target.value)}
            disabled={!(liveSessionId || fileId) || !finalText} 
            style={{ marginRight: '10px' }} 
          >
            <option value="txt">Text (.txt)</option>
            <option value="docx">Word (.docx)</option> 
            <option value="srt">Subtitles (.srt)</option>
            <option value="pdf">PDF (.pdf)</option>
          </select>
          <span className="v-sep" aria-hidden="true"></span>
          
          <button
            className="btn btn-primary"
            onClick={onDownload}
            disabled={!(liveSessionId || fileId) || !finalText} 
          >
            Download ZIP
          </button>
        </div>
      </div>
    </div>
  );
}
