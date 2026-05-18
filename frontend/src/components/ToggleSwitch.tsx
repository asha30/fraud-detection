import { useEffect, useState } from 'react';

export default function ToggleSwitch({
  checked,
  onToggle,
}: {
  checked: boolean;
  onToggle: (next: boolean) => Promise<void> | void;
}) {
  const [busy, setBusy] = useState(false);
  const [local, setLocal] = useState(checked);

  useEffect(() => {
    if (!busy) setLocal(checked);
  }, [checked, busy]);

  return (
    <button
      type="button"
      aria-pressed={local}
      disabled={busy}
      onClick={async () => {
        if (busy) return;
        const next = !local;
        setLocal(next);
        try {
          setBusy(true);
          await onToggle(next);
        } finally {
          setBusy(false);
        }
      }}
      style={{
        width: 36,
        height: 20,
        borderRadius: 10,
        border: 'none',
        background: local ? '#1D9E75' : '#d1d5db',
        position: 'relative',
        cursor: busy ? 'not-allowed' : 'pointer',
        opacity: busy ? 0.7 : 1,
      }}
      title={busy ? 'Updating…' : local ? 'Active' : 'Inactive'}
    >
      <span
        style={{
          width: 14,
          height: 14,
          borderRadius: 999,
          background: '#ffffff',
          position: 'absolute',
          top: 3,
          left: local ? 19 : 3,
          transition: 'left 150ms ease',
        }}
      />
    </button>
  );
}
