import type { ClientMessage, RelayMessage } from '../../../shared/src/messages.js';

type MessageHandler = (msg: RelayMessage) => void;

class RelayConnection {
  private ws: WebSocket | null = null;
  private handlers = new Set<MessageHandler>();
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private _connected = false;

  private getUrl(): string {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    return `${protocol}//${window.location.host}/ws`;
  }

  isConnected(): boolean {
    return this._connected && this.ws?.readyState === WebSocket.OPEN;
  }

  connect() {
    if (this.ws?.readyState === WebSocket.OPEN || this.ws?.readyState === WebSocket.CONNECTING) return;

    try {
      this.ws = new WebSocket(this.getUrl());

      this.ws.onopen = () => {
        console.log('[relay] Connected');
        this._connected = true;
        if (this.reconnectTimer) {
          clearTimeout(this.reconnectTimer);
          this.reconnectTimer = null;
        }
      };

      this.ws.onmessage = (event) => {
        try {
          const msg: RelayMessage = JSON.parse(event.data);
          for (const handler of this.handlers) {
            handler(msg);
          }
        } catch (err) {
          console.error('[relay] Bad message:', err);
        }
      };

      this.ws.onclose = () => {
        console.log('[relay] Disconnected');
        this._connected = false;
      };

      this.ws.onerror = (err) => {
        console.error('[relay] Error:', err);
        this._connected = false;
      };
    } catch (err) {
      console.error('[relay] Failed to connect:', err);
      this._connected = false;
    }
  }

  send(msg: ClientMessage) {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(msg));
    } else {
      console.warn('[relay] Not connected, message dropped:', msg.type);
    }
  }

  onMessage(handler: MessageHandler): () => void {
    this.handlers.add(handler);
    return () => this.handlers.delete(handler);
  }

  disconnect() {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    this._connected = false;
    this.ws?.close();
    this.ws = null;
  }
}

export const relay = new RelayConnection();
