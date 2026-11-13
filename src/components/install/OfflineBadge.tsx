import { useEffect, useState } from 'react';
import { CloudOff } from 'lucide-react';
import './install.css';

function isOnline(): boolean {
  return typeof navigator === 'undefined' || navigator.onLine !== false;
}

/** A quiet taupe pill while the device is offline. Everything still saves locally. */
export function OfflineBadge() {
  const [online, setOnline] = useState(isOnline);

  useEffect(() => {
    const update = () => setOnline(isOnline());
    update();
    window.addEventListener('online', update);
    window.addEventListener('offline', update);
    return () => {
      window.removeEventListener('online', update);
      window.removeEventListener('offline', update);
    };
  }, []);

  if (online) return null;
  return (
    <span
      title="You’re offline. Everything you do is kept on this device and syncs when you’re back."
      className="inline-flex max-w-[9.5rem] items-center gap-1.5 rounded-2xl border border-taupe/35 bg-taupe/10 px-2.5 py-1 text-left text-[11px] leading-tight text-taupe shadow-[inset_0_0_10px_color-mix(in_srgb,var(--color-taupe)_8%,transparent)] sm:max-w-none sm:rounded-full sm:text-xs"
    >
      <CloudOff aria-hidden size={14} className="install-ember shrink-0" />
      <span>Offline · saved on this device</span>
    </span>
  );
}
