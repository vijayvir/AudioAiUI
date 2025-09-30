import React, { useEffect, useRef, useState } from "react";
import "./App.css";
import JSZip from "jszip";

// --- ENVIRONMENT VARIABLES ---
// Ensure your .env file is loaded correctly by your React setup (e.g., CRA or Vite)
const API_BASE_URL = process.env.REACT_APP_API_URL || "http://127.0.0.1:8000";
const WS_BASE_URL = process.env.REACT_APP_WEBSOCKET_URL || "ws://127.0.0.1:8000/ws";

export default function App() {
  const [tab, setTab] = useState("stt");
  const [lang, setLang] = useState("en-US"); 
  const [isRecording, setIsRecording] = useState(false);
  const [status, setStatus] = useState("Idle");
  const [finalText, setFinalText] = useState("");
  const [partialText, setPartialText] = useState("");
  const [canCopy, setCanCopy] = useState(false);
  
  const [audioChunks, setAudioChunks] = useState([]); 
  const [audioBlob, setAudioBlob] = useState(null); 
  
  const [fileToProcess, setFileToProcess] = useState(null); 
  const [copyMessage] = useState(null); 

  // Refs for Web Audio API components (Live Transcription)
  const socketRef = useRef(null);
  const streamRef = useRef(null); 
  const audioContextRef = useRef(null); 
  const processorRef = useRef(null); 
  const sourceRef = useRef(null); 
  const mediaRecorderRef = useRef(null); 

  // Build display string
  const displayText =
    (finalText ? finalText.trimEnd() + " " : "") +
    (partialText ? partialText : "");

  useEffect(() => {}, []);

  // ---- LIVE TRANSCRIBE (USING WEB AUDIO API for 16kHz PCM) ----
  const startLive = async () => {
    try {
      // Clear previous state
      setStatus("Requesting microphone…");
      setFinalText("");
      setPartialText("");
      setCanCopy(false);
      setAudioBlob(null);
      setFileToProcess(null);

      // Request media stream
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: { 
          channelCount: 1, 
          sampleRate: 16000 
        } 
      });
      streamRef.current = stream;

      // WebSocket connection
      setStatus("Connecting to Local Backend…");
      
      // FIX: Construct the URL to match the full FastAPI path: /api/live-transcribe
      const cleanedWsBase = WS_BASE_URL.replace(/\/$/, '').replace('/ws', '');
      const ws = new WebSocket(cleanedWsBase + "/api/live-transcribe");
      socketRef.current = ws;

      ws.onopen = () => {
        setStatus("Connected, streaming raw audio…");
        
        // 1. Setup Web Audio API to capture and process raw data
        const audioCtx = new (window.AudioContext || window.webkitAudioContext)({ sampleRate: 16000 });
        audioContextRef.current = audioCtx;
        
        const source = audioCtx.createMediaStreamSource(stream);
        sourceRef.current = source;
        
        const processor = audioCtx.createScriptProcessor(4096, 1, 1); 
        processorRef.current = processor;

        source.connect(processor);
        processor.connect(audioCtx.destination);

        // 2. Convert Float32 data to Int16 PCM for Vosk
        processor.onaudioprocess = (e) => {
          const float32 = e.inputBuffer.getChannelData(0);
          
          let buffer = new ArrayBuffer(float32.length * 2);
          let view = new DataView(buffer);
          for (let i = 0; i < float32.length; i++) {
            let s = Math.max(-1, Math.min(1, float32[i]));
            view.setInt16(i * 2, s < 0 ? s * 0x8000 : s * 0x7FFF, true); 
          }
          
          if (ws.readyState === WebSocket.OPEN) {
            ws.send(buffer);
          }
        };
        
        // 3. Setup MediaRecorder for saving the audio to a file (webm chunks)
        const mr = new MediaRecorder(stream, { mimeType: "audio/webm" });
        mediaRecorderRef.current = mr;
        
        mr.ondataavailable = (evt) => {
            if (evt.data.size > 0) {
                setAudioChunks((prev) => [...prev, evt.data]);
            }
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
          const text = data?.text || "";

          if (!text) return;

          if (data.type === "final") {
            setFinalText((prev) => (prev + text + " ").replace(/\s+/g, " "));
            setPartialText("");
            setCanCopy(true);
          } else if (data.type === "partial") {
            setPartialText(text);
          }
        } catch (e) {
          console.error("Error parsing WebSocket message:", e);
        }
      };

      ws.onerror = (e) => {
        console.error("WebSocket error", e);
        setStatus("Error");
        stopLive();
      };
      
      ws.onclose = () => {
        setStatus("Closed");
        stopLive(); 
      };

      setIsRecording(true);
      setAudioChunks([]);
    } catch (err) {
      console.error("Mic/Connection error:", err);
      alert("Microphone permission or connection failed. See console for details.");
      setStatus("Error");
    }
  };

  const stopLive = () => {
    try {
      // 1. Disconnect Web Audio API components
      if (processorRef.current) processorRef.current.disconnect();
      if (sourceRef.current) sourceRef.current.disconnect();
      if (audioContextRef.current) audioContextRef.current.close();
      
      // 2. Stop MediaRecorder 
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
        mediaRecorderRef.current.stop();
      }
      
      // 3. Stop mic stream
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
      }
      
      // 4. Close WebSocket
      if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
        socketRef.current.close();
      }
    } finally {
      streamRef.current = null;
      audioContextRef.current = null;
      processorRef.current = null;
      sourceRef.current = null;
      mediaRecorderRef.current = null;
      socketRef.current = null;

      setIsRecording(false);
      setStatus(prev => prev.startsWith("Connected") || prev.startsWith("Streaming") ? "Stopped" : prev);
      setPartialText("");
    }
  };

  // ---- FILE SELECTION (STEP 1) ----
  const onPickFile = (e) => {
    const file = e.target.files?.[0];
    
    stopLive(); 
    setAudioBlob(null);

    if (file) {
      setFileToProcess(file);
      setFinalText("");
      setPartialText("");
      setCanCopy(false);
      setStatus(`File Selected: ${file.name}`);
    } else {
      setFileToProcess(null);
      setStatus("Idle");
    }
    
    e.target.value = "";
  };

  // ---- FILE UPLOAD & TRANSCRIBE (STEP 2) ----
  const onProcessFile = async () => {
    if (!fileToProcess) return;

    const file = fileToProcess;

    try {
      // 1. Set status for upload
      setStatus(`Uploading file: ${file.name}...`);
      
      const fd = new FormData();
      fd.append("file", file); // FIX: Key matches backend parameter 'file'

      // --- ENVIRONMENT VARIABLE USED HERE ---
      const uploadRes = await fetch(API_BASE_URL.replace(/\/$/, '') + "/api/file-transcribe", {
        method: "POST",
        body: fd
      });

      // 2. Status update during transcription
      setStatus("Translation in progress...");

      if (!uploadRes.ok) {
         const errorText = await uploadRes.text();
         throw new Error(`Upload Failed (HTTP ${uploadRes.status}): ${errorText}`);
      }
      
      const data = await uploadRes.json();
      const text = data?.transcription || ""; // FIX: Key matches backend response 'transcription'

      // 3. Final status update
      setAudioBlob(file);
      setFinalText(text);
      setStatus("Translation Complete");
      setCanCopy(!!text);
    } catch (err) {
      console.error(err);
      setStatus("Translation Failed");
      alert(err.message || "File transcription failed.");
    } finally {
      setFileToProcess(null);
    }
  };

  // ---- UI helpers ----
  const onCopy = async () => {
    if (!canCopy) return;
    try {
      await navigator.clipboard.writeText(displayText.trim());
      alert("Copied to clipboard!");
    } catch (error) {
        console.error("Copy failed:", error);
        alert("Failed to copy text.");
    }
  };

// Download both as ZIP
const onDownloadAll = async () => {
  if (!audioBlob || !displayText.trim()) {
    alert("Need both transcript and audio!");
    return;
  }

  const zip = new JSZip();
  zip.file("transcript.txt", displayText.trim());

  const audioBuffer = await audioBlob.arrayBuffer();
  
  const audioFileName = audioBlob.name && audioBlob.name.length > 0
    ? audioBlob.name 
    : "recording.webm";

  zip.file(audioFileName, audioBuffer);

  const content = await zip.generateAsync({ type: "blob" });
  const url = URL.createObjectURL(content);
  const a = document.createElement("a");
  a.href = url;
  a.download = "speech_session.zip";
  a.click();
  URL.revokeObjectURL(url);
};

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
        </div>

        {/* Controls row */}
        <div className="row">
          <select
            value={lang}
            onChange={(e) => setLang(e.target.value)}
            className="select"
            disabled={isRecording}
          >
            <option value="en-US">English</option>
          </select>

          {/* Live Recording Controls */}
          {!isRecording ? (
            <button className="speak" onClick={startLive}>
              <span className="mic">🎤</span> Start Recording
            </button>
          ) : (
            <button className="stop" onClick={stopLive}>
              ⏹ Stop
            </button>
          )}

          <div className="status">Status: {status}</div>
        </div>
        
        {/* Copy Confirmation Message */}
        {copyMessage && (
            <div className="copy-confirmation">{copyMessage}</div>
        )}

        {/* Transcript panel */}
        <div className="panel">
          {displayText ? (
            <div className="text">{displayText}</div>
          ) : (
            <div className="hint">
              Speak your mind, we’ll turn it into text. Live transcripts appear here.
            </div>
          )}
        </div>

        {/* OR divider */}
        <div className="or">
          <div className="line" />
          <div className="or-text">OR</div>
          <div className="line" />
        </div>

        {/* File Selection */}
        <label className="file-btn">
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
          {fileToProcess ? `Process File: ${fileToProcess.name}` : "Process File"}
        </button>

        {/* Footer actions */}
       <div className="footer">
          <button className="link" onClick={onCopy} disabled={!canCopy}>
          Copy
          </button>
          <button className="link" onClick={onDownloadAll} disabled={!audioBlob || !canCopy}>
          Download
          </button>
        </div>
      </div>
    </div>
  );
}
