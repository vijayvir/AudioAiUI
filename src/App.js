import React, { useEffect, useRef, useState } from "react";
import { createClient } from "@deepgram/sdk";
import "./App.css";

export default function App() {
  const [tab, setTab] = useState("stt"); // stt | tts | agent | intel (UI only)
  const [lang, setLang] = useState("en-US");
  const [isRecording, setIsRecording] = useState(false);
  const [status, setStatus] = useState("Idle");
  const [finalText, setFinalText] = useState("");     // committed text
  const [partialText, setPartialText] = useState(""); // live partial line
  const [canCopy, setCanCopy] = useState(false);

  // Deepgram & recording refs
  const deepgramRef = useRef(null);
  const socketRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const mediaStreamRef = useRef(null);

  // Build display string: final + (partial on same line)
  const displayText =
    (finalText ? finalText.trimEnd() + " " : "") +
    (partialText ? partialText : "");

  // Init Deepgram client once
  useEffect(() => {
    const key = process.env.REACT_APP_DEEPGRAM_API_KEY;
    if (!key) {
      console.warn("Missing REACT_APP_DEEPGRAM_API_KEY in .env");
    }
    deepgramRef.current = createClient(key || "MISSING_KEY");
  }, []);

  // ---- LIVE TRANSCRIBE ----
  const startLive = async () => {
    try {
      setStatus("Requesting microphone…");
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaStreamRef.current = stream;

      // WebSocket live connection
      setStatus("Connecting to Deepgram…");
      const socket = await deepgramRef.current.transcription.live({
        // common options
        model: "general",
        language: lang,
        punctuate: true,
        interim_results: true,
        smart_format: true
      });

      socketRef.current = socket;

      socket.addListener("open", () => {
        setStatus("Streaming");
      });

      socket.addListener("close", () => {
        setStatus("Closed");
      });

      socket.addListener("error", (e) => {
        console.error("Deepgram error", e);
        setStatus("Error");
      });

      // IMPORTANT: update transcript without repeating words
      socket.addListener("transcriptReceived", (msg) => {
        // Deepgram result shape
        // msg.is_final (boolean)
        // msg.channel.alternatives[0].transcript (string)
        const alt =
          msg?.channel?.alternatives && msg.channel.alternatives[0];
        const text = alt?.transcript || "";

        if (!text) {
          // sometimes keepalives / empty partials arrive
          return;
        }

        if (msg.is_final) {
          // Commit the partial to final, start a new partial line
          setFinalText((prev) => (prev + text + " ").replace(/\s+/g, " "));
          setPartialText("");
          setCanCopy(true);
        } else {
          // Replace partial each time – no duplication
          setPartialText(text);
        }
      });

      // Use MediaRecorder to chunk audio → send to socket
      const mr = new MediaRecorder(stream, { mimeType: "audio/webm" });
      mediaRecorderRef.current = mr;

      mr.addEventListener("dataavailable", (evt) => {
        if (evt.data.size > 0 && socket.getReadyState() === 1) {
          socket.send(evt.data);
        }
      });

      // small chunk for low latency
      mr.start(250);

      // UI state
      setIsRecording(true);
      setStatus("Recording");
      setFinalText("");
      setPartialText("");
      setCanCopy(false);
    } catch (err) {
      console.error("Mic/Deepgram error:", err);
      alert("Microphone permission or Deepgram connection failed.");
      setStatus("Error");
    }
  };

  const stopLive = () => {
    try {
      // stop recorder
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
        mediaRecorderRef.current.stop();
      }
      // stop mic
      if (mediaStreamRef.current) {
        mediaStreamRef.current.getTracks().forEach((t) => t.stop());
      }
      // close socket
      if (socketRef.current) {
        try { socketRef.current.finish(); } catch {}
        try { socketRef.current.close(); } catch {}
      }
    } finally {
      mediaRecorderRef.current = null;
      mediaStreamRef.current = null;
      socketRef.current = null;
      setIsRecording(false);
      setStatus("Stopped");
      setPartialText("");
    }
  };

  // ---- FILE UPLOAD TRANSCRIBE ----
  const onPickFile = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setStatus("Uploading file…");
      setFinalText("");
      setPartialText("");

      const key = process.env.REACT_APP_DEEPGRAM_API_KEY;
      const res = await fetch("https://api.deepgram.com/v1/listen?model=general&smart_format=true", {
        method: "POST",
        headers: {
          Authorization: `Token ${key}`,
          "Content-Type": file.type || "audio/*"
        },
        body: file
      });

      if (!res.ok) throw new Error(`Deepgram HTTP ${res.status}`);
      const data = await res.json();

      // Combine best transcript
      const text =
        data?.results?.channels?.[0]?.alternatives?.[0]?.transcript || "";
      setFinalText(text);
      setStatus("Ready");
      setCanCopy(!!text);
    } catch (err) {
      console.error(err);
      setStatus("Error");
      alert("File transcription failed.");
    } finally {
      // allow picking same file again
      e.target.value = "";
    }
  };

  // ---- UI helpers ----
  const onCopy = async () => {
    try {
      await navigator.clipboard.writeText(displayText.trim());
    } catch {}
  };

  const onDownload = () => {
    const blob = new Blob([displayText.trim()], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "transcript.txt";
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
          <button className={`tab ${tab === "tts" ? "muted" : ""}`} onClick={() => setTab("tts")}>
            <span className="tab-emoji">🔊</span> Text to Speech
          </button>
          <button className={`tab ${tab === "agent" ? "muted" : ""}`} onClick={() => setTab("agent")}>
            <span className="tab-emoji">🤖</span> Voice Agent
          </button>
          <button className={`tab ${tab === "intel" ? "muted" : ""}`} onClick={() => setTab("intel")}>
            <span className="tab-emoji">🧠</span> Audio Intelligence
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
            <option value="es">Spanish</option>
            <option value="fr">French</option>
            <option value="hi">Hindi</option>
          </select>

          {!isRecording ? (
            <button className="speak" onClick={startLive}>
              <span className="mic">🎤</span> Speak
            </button>
          ) : (
            <button className="stop" onClick={stopLive}>
              ⏹ Stop
            </button>
          )}

          <div className="status">Status: {status}</div>
        </div>

        {/* Transcript panel */}
        <div className="panel">
          {displayText ? (
            <div className="text">{displayText}</div>
          ) : (
            <div className="hint">
              Speak your mind, we’ll turn it into text. No typos, no autocorrect drama. Live transcripts appear here.
            </div>
          )}
        </div>

        {/* OR divider */}
        <div className="or">
          <div className="line" />
          <div className="or-text">OR</div>
          <div className="line" />
        </div>

        {/* Use your own file */}
        <label className="file-btn">
          Use Your Own File ⟳
          <input type="file" accept="audio/*,video/*" onChange={onPickFile} hidden />
        </label>

        {/* Transcribe Live (alt start) */}
        <button className="transcribe" onClick={isRecording ? stopLive : startLive}>
          {isRecording ? "Stop Live Transcription" : "Transcribe Live"}
        </button>

        {/* Footer actions */}
        <div className="footer">
          <button className="link" onClick={onCopy} disabled={!canCopy}>
            Copy
          </button>
          <button className="link" onClick={onDownload} disabled={!canCopy}>
            Download
          </button>
          <button className="link" onClick={() => window.open("https://developers.deepgram.com", "_blank")}>
            Explore More Features
          </button>
        </div>
      </div>
    </div>
  );
}
