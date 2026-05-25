import type React from 'react';

export default function AdminLoadingSkeleton({
  lines = 3,
  height = 14,
}: {
  lines?: number;
  height?: number;
}) {
  const rowStyle: React.CSSProperties = {
    height,
    borderRadius: 8,
    background: 'linear-gradient(90deg, #f3f4f6 0%, #e5e7eb 40%, #f3f4f6 100%)',
    backgroundSize: '200% 100%',
    animation: 'admin-skeleton 1.2s ease-in-out infinite',
  };

  return (
    <div style={{ display: 'grid', gap: 10 }}>
      <style>
        {`@keyframes admin-skeleton { 0% { background-position: 200% 0; } 100% { background-position: -200% 0; } }`}
      </style>
      {Array.from({ length: lines }).map((_, i) => (
        <div key={i} style={rowStyle} />
      ))}
    </div>
  );
}
