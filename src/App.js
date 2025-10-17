import React, { useEffect, useRef, useState } from "react";
import { Document, Packer, Paragraph, TextRun } from "docx";
import jsPDF from "jspdf";
import Sentiment from "sentiment";
import vader from "vader-sentiment";
import "./App.css";

// Note: JSZip is no longer strictly necessary since the server is handling the zipping, 
// but we keep the import in case of future use.
// import JSZip from "jszip"; 

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
  const [timestampedLines, setTimestampedLines] = useState([]);
  
  // NEW STATE: To hold the download URL provided by the server after live session ends
  const [downloadUrl, setDownloadUrl] = useState(null);
  const [sessionId, setSessionId] = useState(null); 
  
  const [audioChunks, setAudioChunks] = useState([]); 
  const [audioBlob, setAudioBlob] = useState(null); // Used to indicate if recording occurred
  
  const [fileToProcess, setFileToProcess] = useState(null); 
  const [copyMessage, setCopyMessage] = useState(null); // Renamed copyMessage to use setState

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

  // Utility to handle generic download of a blob
  const triggerDownload = (blob, filename) => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

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
      setDownloadUrl(null); // Clear previous download URL
      setSessionId(null); // Clear previous session ID

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
      
      // Construct the URL to match the full FastAPI path: /api/live-transcribe
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
            // This is primarily for the audioBlob state indicator, 
            // the server-side recording is handled by the WebSocket messages.
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

          // Handle session start and end messages from the server
          if (data.type === "session_start" && data.session_id) {
              setSessionId(data.session_id);
              return;
          }
          
          if (data.type === "session_end" && data.download_url) {
              setDownloadUrl(data.download_url); // Store the URL for download
              setStatus("Session Ended. Transcript and audio saved on server.");
              return;
          }

          if (!text) return;

          if (data.type === "final") {
            const now = new Date();
            const timestamp = now.toLocaleString();
            const textWithTimestamp = `[${timestamp}] ${text}`;
            // setFinalText((prev) => (prev + textWithTimestamp + " ").replace(/\s+/g, " "));
            setFinalText((prev) => prev + "\n" + textWithTimestamp);
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
      // The server will handle sending the session_end and download URL on close
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
      setPartialText("");
    }
  };
  
  // ---- LIVE SESSION DOWNLOAD (NEW FUNCTION) ----
  const onDownloadSession = async () => {
    if (!sessionId) {
      alert("No active session to download.");
      return;
    }

    setStatus("Downloading session files...");

    try {
      const response = await fetch(
        API_BASE_URL.replace(/\/$/, '') + `/api/download-transcription/${sessionId}`
      );

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Download Failed (HTTP ${response.status}): ${errorText}`);
      }

      const blob = await response.blob();
      triggerDownload(blob, `session_${sessionId}.zip`);
      setStatus("Download Complete.");
    } catch (err) {
      console.error("Download error:", err);
      setStatus("Download Failed");
      alert(err.message || "Failed to download session files from server.");
    }
  };


  // ---- FILE SELECTION (STEP 1) ----
  const onPickFile = (e) => {
    const file = e.target.files?.[0];
    
    stopLive(); 
    setAudioBlob(null);
    setDownloadUrl(null); // Ensure live download state is clear

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

  // ---- FILE UPLOAD & TRANSCRIBE (STEP 2 - Updated for direct ZIP download) ----
  const onProcessFile = async () => {
    if (!fileToProcess) return;

    const file = fileToProcess;

    try {
      // 1. Set status for upload
      setStatus(`Uploading file: ${file.name}...`);
      
      const fd = new FormData();
      fd.append("file", file);

      // --- ENVIRONMENT VARIABLE USED HERE ---
      const uploadRes = await fetch(API_BASE_URL.replace(/\/$/, '') + "/api/file-transcribe", {
        method: "POST",
        body: fd
      });

      // 2. Status update during transcription
      setStatus("Transcription in progress...");

      if (!uploadRes.ok) {
      const errorText = await uploadRes.text();
      throw new Error(`Upload Failed (HTTP ${uploadRes.status}): ${errorText}`);
      }

      // ✅ Parse JSON instead of blob
      const data = await uploadRes.json();

      // Show transcription in text box
      setFinalText(data.transcription || "");
      setPartialText("");
      setStatus("File processed successfully.");
      setCanCopy(true);

    } catch (err) {
      console.error(err);
      setStatus("Transcription Failed");
      alert(err.message || "File transcription failed.");
    } finally {
      setFileToProcess(null);
    }
  };

//  const analyzeTone = (text) => {
//   if (!text) return "No text";

//   const intensity = vader.SentimentIntensityAnalyzer.polarity_scores(text);
//   // intensity example: {neg: 0.0, neu: 0.5, pos: 0.5, compound: 0.6}

//   if (intensity.compound >= 0.05) return "Positive 😊";
//   if (intensity.compound <= -0.05) return "Negative 😞";
//   return "Neutral 😐";
// };

// function TranscriptTone({ finalText }) {
//   const tone = analyzeTone(finalText);

//   return (
//     <div style={{ marginTop: "10px", fontWeight: "bold" }}>
//       Tone Analysis: {tone}
//     </div>
//   );
// }

const analyzeTone = (text) => {
  if (!text) return "No text yet";
  const intensity = vader.SentimentIntensityAnalyzer.polarity_scores(text);
  if (intensity.compound >= 0.05) return "Positive 😊";
  if (intensity.compound <= -0.05) return "Negative 😞";
  return "Neutral 😐";
};

const toneColors = {
  Positive: { bg: "#d4edda", color: "#155724" },
  Negative: { bg: "#f8d7da", color: "#721c24" },
  Neutral: { bg: "#fff3cd", color: "#856404" },
  Default: { bg: "#e2e3e5", color: "#383d41" },
};

const tone = analyzeTone(finalText);
const getToneStyle = () => {
  if (tone.includes("Positive")) return toneColors.Positive;
  if (tone.includes("Negative")) return toneColors.Negative;
  if (tone.includes("Neutral")) return toneColors.Neutral;
  return toneColors.Default;
};
const toneStyle = getToneStyle();


  // ---- UI helpers ----
  const onCopy = async () => {
    if (!canCopy) return;
    try {
      await navigator.clipboard.writeText(displayText.trim());
      alert("Transcript copied to clipboard!");
    } catch (error) {
        console.error("Copy failed:", error);
        alert("Failed to copy text.");
    }
  };

  const Path = {
    stem: (name) => name.split('.').slice(0, -1).join('.'),
  }

 const exportAsTxt = (text) => {
  const blob = new Blob([text], { type: "text/plain" });
  downloadBlob(blob, "transcript.txt");
};

const exportAsDocx = async (text) => {
  const { Document, Packer, Paragraph, TextRun } = await import("docx");
  const doc = new Document({
    sections: [{
      children: text.split("\n").map(line =>
        new Paragraph({ children: [new TextRun(line)] })
      )
    }]
  });
  const blob = await Packer.toBlob(doc);
  downloadBlob(blob, "transcript.docx");
};

const exportAsPdf = async (text) => {
  const { default: jsPDF } = await import("jspdf");
  const doc = new jsPDF();
  let y = 10;
  text.split("\n").forEach(line => {
    doc.text(line, 10, y);
    y += 8;
    if (y > 280) {
      doc.addPage();
      y = 10;
    }
  });
  doc.save("transcript.pdf");
};

const exportAsSrt = (text) => {
  const lines = text.split("\n").filter(Boolean);
  const srt = lines.map((line, i) => {
    const start = new Date(i * 4000).toISOString().substr(11, 8) + ",000";
    const end = new Date((i + 1) * 4000).toISOString().substr(11, 8) + ",000";
    return `${i + 1}\n${start} --> ${end}\n${line}\n`;
  }).join("\n");

  const blob = new Blob([srt], { type: "text/plain" });
  downloadBlob(blob, "transcript.srt");
};

const downloadBlob = (blob, filename) => {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
};


  // --- Render logic ---

  return (
    <div className="app">
      <div className="card">
        {/* Tabs */}
        <div className="tabs">
          <button
            className={`tab ${tab === "stt" ? "active" : ""}`}
            onClick={() => setTab("stt")}
          >
            <span className="tab-emoji">🗣️</span> Live Recorder
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
            // <option value="es-ES">Spanish</option>
            // <option value="fr-FR">French</option>
            // <option value="hi-IN">Hindi</option>
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

         <div style={{
              background: "#ffffff",
              border: "1px solid #ddd",
              borderRadius: "6px",
              padding: "12px",
              maxHeight: "180px",  
              overflowY: "auto",
              fontFamily: "'Segoe UI', sans-serif",
              fontSize: "13px",    
              lineHeight: "1.4",
              boxShadow: "0 1px 4px rgba(0, 0, 0, 0.05)",
              width: "100%",        
              maxWidth: "500px",   
            }}>
              {finalText.split("\n").map((line, index) => {
                const match = line.match(/^\[(.*?)\]\s(.*)$/);
                const time = match?.[1] ?? "";
                const content = match?.[2] ?? line;

                return (
                  <div key={index} style={{
                    marginBottom: "8px",
                    padding: "6px 8px",
                    background: "#f5f5f5",
                    borderRadius: "4px"
                  }}>
                    <span style={{
                      color: "#888",
                      fontSize: "11px",
                      display: "block",
                      marginBottom: "2px"
                    }}>
                      {time}
                    </span>
                    <span style={{
                      color: "#222"
                    }}>
                      {content}
                    </span>
                  </div>
                );
              })}
            </div>


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
              {sessionId && <div className="text-xs mt-2 text-gray-400">Session ID: {sessionId}</div>}
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
        <label className="file-btn" disabled={isRecording}>
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
          <div
            style={{
              marginTop: 16,
              padding: "6px 12px",
              borderRadius: 16,
              backgroundColor: toneStyle.bg,
              color: toneStyle.color,
              fontWeight: "600",
              fontSize: 14,
              textAlign: "center",
              userSelect: "none",
              boxShadow: `0 0 4px ${toneStyle.color}55`,
              transition: "all 0.3s ease",
              width: "fit-content",
              animation: "pulse 2s infinite",
              // ✅ Aligned to the left
              marginLeft: 0,
              marginRight: "auto",
            }}
          >
            Tone: {tone}
          </div>

          <style>
            {`
              @keyframes pulse {
                0%, 100% {
                  box-shadow: 0 0 4px ${toneStyle.color}55;
                }
                50% {
                  box-shadow: 0 0 8px ${toneStyle.color}88;
                }
              }
            `}
          </style>


          <button className="link" onClick={onCopy} disabled={!canCopy}>
          Copy Transcript
          </button>
          
          {/* Download button uses the server-provided URL for live sessions */}
          <button 
            className="link" 
            onClick={onDownloadSession} 
            disabled={!sessionId}
          >
            Download
          </button>

          <select
            onChange={async (e) => {
              const format = e.target.value;
              if (!format) return;

              if (format === "txt") exportAsTxt(finalText);
              else if (format === "docx") await exportAsDocx(finalText);
              else if (format === "pdf") await exportAsPdf(finalText);
              else if (format === "srt") exportAsSrt(finalText);

              e.target.selectedIndex = 0; // reset dropdown
            }}
          >
            <option value="">Export transcript as...</option>
            <option value="txt">.txt</option>
            <option value="docx">.docx</option>
            <option value="pdf">.pdf</option>
            <option value="srt">.srt (subtitle)</option>
          </select>
        </div>
      </div>
    </div>
  );
}
