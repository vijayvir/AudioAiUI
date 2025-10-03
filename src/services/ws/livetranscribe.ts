import { WS_BASE_URL, API_TOKEN } from '../../config/env';
import type { LiveTranscribeMessage } from '../../types/api';

type MessageHandler = (msg: LiveTranscribeMessage) => void;
type ErrorHandler = (err: Error) => void;

export class LiveTranscribeClient {
  private ws?: WebSocket;
  private onMessage?: MessageHandler;
  private onError?: ErrorHandler;
  private language: string = 'English';
  private sessionId?: string;

  constructor(opts?: { onMessage?: MessageHandler; onError?: ErrorHandler; language?: string }) {
    this.onMessage = opts?.onMessage;
    this.onError = opts?.onError;
    if (opts?.language) this.language = opts.language;
  }

  connect(language?: string) {
    if (language) this.language = language;
    const url = `${WS_BASE_URL}/live-transcribe?lang=${encodeURIComponent(this.language)}${API_TOKEN ? `&token=${encodeURIComponent(API_TOKEN)}` : ''}`;
    this.ws = new WebSocket(url);

    this.ws.onopen = () => {
      // Inform server of language/session if needed
      this.sendJSON({ type: 'info', language: this.language });
    };

    this.ws.onmessage = (ev) => {
      try {
        const data = JSON.parse(ev.data) as LiveTranscribeMessage;
        if (data.sessionId) this.sessionId = data.sessionId;
        this.onMessage?.(data);
      } catch {
        // fallback: treat as text message
        this.onMessage?.({ type: 'partial', text: String(ev.data), language: this.language, sessionId: this.sessionId });
      }
    };

    this.ws.onerror = () => {
      const err = new Error('WebSocket error');
      this.onError?.(err);
    };

    this.ws.onclose = () => {
      this.ws = undefined;
    };
  }

  disconnect() {
    if (this.ws && this.ws.readyState <= 1) this.ws.close();
    this.ws = undefined;
  }

  sendAudioChunk(chunk: ArrayBuffer | Blob) {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;
    if (chunk instanceof Blob) {
      chunk.arrayBuffer().then((ab) => this.ws?.send(ab));
      return;
    }
    this.ws.send(chunk);
  }

  sendJSON(payload: LiveTranscribeMessage) {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;
    this.ws.send(JSON.stringify(payload));
  }

  getSessionId() {
    return this.sessionId;
  }
}