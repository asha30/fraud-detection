import { create } from 'zustand';
import type { LiveTransaction } from '../hooks/useLiveStream';

type LiveStreamState = {
  transactions: LiveTransaction[];
  stats: { total: number; fraud: number; legit: number; correct: number };
  push: (tx: LiveTransaction) => void;
  clear: () => void;
};

export const useLiveStreamStore = create<LiveStreamState>((set) => ({
  transactions: [],
  stats: { total: 0, fraud: 0, legit: 0, correct: 0 },
  push: (tx) =>
    set((s) => {
      const isFraud = tx.prediction === 'FRAUD';
      const isCorrect = tx.prediction === tx.label;
      return {
        transactions: [tx, ...s.transactions].slice(0, 200),
        stats: {
          total: s.stats.total + 1,
          fraud: s.stats.fraud + (isFraud ? 1 : 0),
          legit: s.stats.legit + (!isFraud ? 1 : 0),
          correct: s.stats.correct + (isCorrect ? 1 : 0),
        },
      };
    }),
  clear: () => set({ transactions: [], stats: { total: 0, fraud: 0, legit: 0, correct: 0 } }),
}));
