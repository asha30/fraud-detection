function barColor(score: number) {
  if (score > 70) return '#E24B4A';
  if (score >= 40) return '#EF9F27';
  return '#1D9E75';
}

export default function ScoreBar({ score }: { score: number }) {
  const safeScore = Math.max(0, Math.min(100, score));

  return (
    <div style={{ width: 80 }}>
      <div
        style={{
          height: 5,
          width: '100%',
          borderRadius: 999,
          background: '#e5e7eb',
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            height: '100%',
            width: `${safeScore}%`,
            background: barColor(safeScore),
            borderRadius: 999,
            transition: 'width 150ms ease',
          }}
        />
      </div>
    </div>
  );
}
