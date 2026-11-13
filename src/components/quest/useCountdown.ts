import { useEffect, useState } from 'react';

function secondsUntil(endsAt: number): number {
  return Math.max(0, Math.ceil((endsAt - Date.now()) / 1000));
}

/** Whole seconds left until endsAt (epoch ms), ticking on screen. */
export function useCountdown(endsAt: number): number {
  const [secondsLeft, setSecondsLeft] = useState(() => secondsUntil(endsAt));
  useEffect(() => {
    setSecondsLeft(secondsUntil(endsAt));
    const id = setInterval(() => setSecondsLeft(secondsUntil(endsAt)), 250);
    return () => clearInterval(id);
  }, [endsAt]);
  return secondsLeft;
}

export function formatCountdown(seconds: number): string {
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
}
