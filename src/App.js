import React, { useRef, useState, useEffect, useCallback } from "react";
import Waveform from "./components/Waveform";
import TranscriptionPanel from "./components/TranscriptionPanel";
import FileProcessor from "./components/FileProcessor";
import "./App.css";

const API_BASE_URL = process.env.REACT_APP_API_URL || "http://127.0.0.1:8000";
const WS_BASE_URL = process.env.REACT_APP_WEBSOCKET_URL || "ws://127.0.0.1:8000/ws";
const API_URL = API_BASE_URL.replace(/\/$/, "") + "/api";

export default function App() {
  const [theme, setTheme] = useState(() => localStorage.getItem('theme') || 'dark');
  const [isRecording, setIsRecording] = useState(false);
  const [status, setStatus] = useState("Idle");
  const [isProcessingFile, setIsProcessingFile] = useState(false);
  const [isProcessingLive, setIsProcessingLive] = useState(false);
  const [processingProgress, setProcessingProgress] = useState(0);

  const [finalText, setFinalText] = useState("");
  const [partialText, setPartialText] = useState("");
  const [liveTranscript, setLiveTranscript] = useState("");
  const [overallSentiment, setOverallSentiment] = useState({ distribution: { positive: "0%", neutral: "0%", negative: "0%" }, label: "Neutral" });
  const [summaryText, setSummaryText] = useState("");
  const [showSummaryModal, setShowSummaryModal] = useState(false);

  const [fileId, setFileId] = useState(null);
  const [liveSessionId, setLiveSessionId] = useState(null);
  const [lastMode, setLastMode] = useState(null);
  const [downloadFormat, setDownloadFormat] = useState("");

  const socketRef = useRef(null);
  const streamRef = useRef(null);
  const audioContextRef = useRef(null);
  const analyserRef = useRef(null);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('theme', theme);
  }, [theme]);

  // --- DOWNLOAD LOGIC FIXED ---
  const onDownload = async () => {
    if (!finalText.trim()) return alert("No transcription to download.");
    if (!downloadFormat) return alert("Please select a file type.");

    let downloadUrl = null;
    if (lastMode === "file" && fileId) {
      downloadUrl = `${API_URL}/download-file-result/${fileId}?format=${downloadFormat}`;
    } else if (lastMode === "live" && liveSessionId) {
      downloadUrl = `${API_URL}/download-transcription/${liveSessionId}?format=${downloadFormat}`;
    } else {
      return alert("No active session or file ID available.");
    }

    try {
      const resp = await fetch(downloadUrl);
      if (!resp.ok) throw new Error("Download failed");
      const blob = await resp.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `transcription_${downloadFormat}.zip`;
      a.click();
    } catch (err) { alert(err.message); }
  };

  const startLive = async () => {
    try {
      setStatus("Requesting microphone…");
      setFinalText(""); setPartialText(""); setLiveTranscript(""); setLastMode("live");
      const stream = await navigator.mediaDevices.getUserMedia({ audio: { channelCount: 1, sampleRate: 16000 } });
      streamRef.current = stream;
      const ws = new WebSocket(WS_BASE_URL.replace("/ws", "") + "/api/live-transcribe");
      socketRef.current = ws;

      ws.onopen = () => {
        setStatus("Streaming...");
        const audioCtx = new (window.AudioContext || window.webkitAudioContext)({ sampleRate: 16000 });
        audioContextRef.current = audioCtx;
        const source = audioCtx.createMediaStreamSource(stream);
        const analyser = audioCtx.createAnalyser();
        analyser.fftSize = 256;
        analyserRef.current = analyser;
        const processor = audioCtx.createScriptProcessor(4096, 1, 1);
        source.connect(analyser); analyser.connect(processor); processor.connect(audioCtx.destination);
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
      };

      ws.onmessage = (msg) => {
        const data = JSON.parse(msg.data);
        if (data.session_id) setLiveSessionId(data.session_id);
        if (data.type === "final") { setLiveTranscript(prev => (prev + " " + data.text).trim()); setPartialText(""); }
        else if (data.type === "partial") { setPartialText(data.text); }
        else if (data.type === "session_end") {
          setFinalText(data.final_text || "");
          setSummaryText(data.summary || "");
          setOverallSentiment(data.overall_sentiment || overallSentiment);
          setIsProcessingLive(false);
          setStatus("✅ Ready");
        }
      };
      setIsRecording(true);
    } catch (err) { setStatus("Error"); }
  };

  const stopLive = () => {
    if (socketRef.current?.readyState === WebSocket.OPEN) {
      socketRef.current.send(JSON.stringify({ text: "stop" }));
      setIsProcessingLive(true); setStatus("Processing...");
    }
    streamRef.current?.getTracks().forEach(t => t.stop());
    audioContextRef.current?.close();
    setIsRecording(false);
  };

  const onProcessFile = async (file) => {
    setLastMode("file"); setIsProcessingFile(true); setProcessingProgress(0);
    const interval = setInterval(() => setProcessingProgress(p => p >= 95 ? 95 : p + 5), 400);
    try {
      const fd = new FormData(); fd.append("file", file);
      const res = await fetch(API_URL + "/file-transcribe", { method: "POST", body: fd });
      const data = await res.json();
      setFinalText(data.transcription?.text || data.transcription || "");
      setOverallSentiment(data.overall_sentiment || overallSentiment);
      setSummaryText(data.summary || "");
      setFileId(data.file_id);
      setProcessingProgress(100); setStatus("Complete");
    } catch (e) { setStatus("Failed"); }
    finally { clearInterval(interval); setIsProcessingFile(false); }
  };

  return (
    <div className="app">
      <div className="card">
        <div className="flex items-center justify-between mb-6">
          <div className="w-1/4">
            <button onClick={() => setTheme(t => t === 'dark' ? 'light' : 'dark')} className="theme-toggle">
              {theme === 'dark' ? '☀️ Light Mode' : '🌙 Dark Mode'}
            </button>
          </div>
          <h1 className="app-title flex-1">🗣️ Speech to Text</h1>
          <div className="w-1/4"></div>
        </div>

        {showSummaryModal && (
          <div className="modal-overlay" onClick={() => setShowSummaryModal(false)}>
            <div className="modal" onClick={e => e.stopPropagation()}>
              <h3>📝 Summary</h3>
              <p>{summaryText || "No summary available yet."}</p>
              <button onClick={() => setShowSummaryModal(false)}>Close</button>
            </div>
          </div>
        )}

        <div className="row">
          {!isRecording ? (
            <button className="speak" onClick={startLive}><span className="mic">🎤</span> Start Recording</button>
          ) : (
            <>
              <button className="stop" onClick={stopLive}>⏹ Stop</button>
              <Waveform analyser={analyserRef.current} />
            </>
          )}
          <div className="status">Status: {status}</div>
        </div>

        <TranscriptionPanel 
          liveTranscript={liveTranscript} partialText={partialText} finalText={finalText}
          isProcessing={isProcessingFile || isProcessingLive} isFileMode={isProcessingFile} progress={processingProgress}
        />

        <div className="sentiment-box">
          <div className="sentiment-row">
            <span className="sentiment-title">🧠 Sentiment Analysis</span>
            <span className="sentiment-sep">|</span>
            <span className={`sentiment-label ${overallSentiment.label.toLowerCase()}`}>Overall: {overallSentiment.label.toUpperCase()}</span>
            <span className="sentiment-sep">|</span>
            <span className="sentiment-positive">😊 Pos: {overallSentiment.distribution.positive}</span>
            <span className="sentiment-sep">|</span>
            <span className="sentiment-neutral">😐 Neu: {overallSentiment.distribution.neutral}</span>
            <span className="sentiment-sep">|</span>
            <span className="sentiment-negative">😠 Neg: {overallSentiment.distribution.negative}</span>
          </div>
        </div>

        <FileProcessor onProcess={onProcessFile} disabled={isRecording} isProcessing={isProcessingFile} />

        <div className="footer footer-row">
          <button className="btn btn-secondary" onClick={() => setShowSummaryModal(true)}>📝 Summarization</button>
          <span className="footer-sep">|</span>
          <button className="btn btn-secondary" onClick={() => {navigator.clipboard.writeText(finalText); alert("Copied!");}} disabled={!finalText}>Copy Text</button>
          <span className="footer-sep">|</span>
          <select className="select select--fancy" value={downloadFormat} onChange={e => setDownloadFormat(e.target.value)}>
            <option value="">Select File Type</option>
            <option value="txt">Text (.txt)</option>
            <option value="docx">Word (.docx)</option>
            <option value="srt">Subtitles (.srt)</option>
            <option value="pdf">PDF (.pdf)</option>
          </select>
          <span className="footer-sep">|</span>
          <button className="btn btn-primary" onClick={onDownload} disabled={!downloadFormat || (!fileId && !liveSessionId)}>Download ZIP</button>
        </div>
      </div>
    </div>
  );
}