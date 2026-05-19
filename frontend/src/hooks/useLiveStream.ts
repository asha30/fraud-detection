import { useCallback, useEffect, useState } from 'react';
import { useLiveStreamStore } from '../stores/useLiveStreamStore';

export type LiveTransaction = {
  index: number;
  round: number;
  label: 'FRAUD' | 'LEGIT';
  raw: {
    step: number;
    type: string;
    amount: number;
    oldbalanceOrg: number;
    newbalanceOrig: number;
    oldbalanceDest: number;
    newbalanceDest: number;
  };
  prediction: 'FRAUD' | 'LEGIT';
  probability: number;
  is_fraud: boolean;
  receivedAt: number;
};

export type StreamStatus = 'connecting' | 'connected' | 'disconnected' | 'error';

const WS_URL = (import.meta.env.VITE_WS_URL as string | undefined) ?? 'ws://127.0.0.1:8000/ws/live';

// Singleton WebSocket — shared across the whole app so navigating away doesn't kill it
let _ws: WebSocket | null = null;
let _status: StreamStatus = 'disconnected';
let _paused = false;  // when true, blocks auto-reconnect
let _pushFn: ((tx: LiveTransaction) => void) | null = null;
const _statusListeners = new Set<(s: StreamStatus) => void>();

function notifyStatus(s: StreamStatus) {
  _status = s;
  _statusListeners.forEach((fn) => fn(s));
}

export function initGlobalStream(push: (tx: LiveTransaction) => void) {
  if (_paused) return;
  if (_ws && _ws.readyState < 2) return; // already open or connecting

  _pushFn = push;
  notifyStatus('connecting');
  const ws = new WebSocket(WS_URL);
  _ws = ws;

  ws.onopen = () => notifyStatus('connected');

  ws.onmessage = (ev) => {
    try {
      const msg = JSON.parse(ev.data as string);
      if (msg.type === 'round_end') return;
      push({ ...msg, receivedAt: Date.now() });
    } catch {
      // ignore
    }
  };

  ws.onerror = () => notifyStatus('error');

  ws.onclose = () => {
    notifyStatus('disconnected');
    // Only auto-reconnect if not manually paused
    if (!_paused) {
      setTimeout(() => { if (!_paused && _pushFn) initGlobalStream(_pushFn); }, 3000);
    }
  };
}

export function pauseGlobalStream() {
  _paused = true;
  _ws?.close();
  _ws = null;
}

export function resumeGlobalStream() {
  _paused = false;
  if (_pushFn) initGlobalStream(_pushFn);
}

export default function useLiveStream() {
  const { transactions, stats, push, clear } = useLiveStreamStore();
  const [status, setStatus] = useState<StreamStatus>(_status);

  useEffect(() => {
    _statusListeners.add(setStatus);
    return () => { _statusListeners.delete(setStatus); };
  }, []);

  const connect = useCallback(() => resumeGlobalStream(), []);
  const disconnect = useCallback(() => {
    pauseGlobalStream();
    notifyStatus('disconnected');
  }, []);

  const clearAll = useCallback(() => {
    clear();
    fetch(`${import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:8002'}/alerts/insights`, { method: 'DELETE' }).catch(() => {});
  }, [clear]);

  return { transactions, status, stats, connect, disconnect, clear: clearAll };
}
