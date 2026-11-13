import { useEffect, useRef } from 'react';
import { useVespera } from '../../context/VesperaContext';
import { QuickScribeModal } from './QuickScribeModal';
import { closeCapture, openCapture, useCaptureOpen } from './captureStore';

/** Quick Scribe: the centered storybook modal and its ⌘K / Ctrl+K shortcut (the header pill opens it too). */
export function CaptureLauncher() {
  const open = useCaptureOpen();
  const { state } = useVespera();
  // The Focus Chamber covers the whole screen, so a modal opened now would sit unseen beneath it.
  const focusing = useRef(!!state.focusSession);
  useEffect(() => {
    focusing.current = !!state.focusSession;
  }, [state.focusSession]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        if (!focusing.current) openCapture();
      }
    };
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('keydown', onKey);
      closeCapture();
    };
  }, []);

  return <QuickScribeModal open={open} onClose={closeCapture} />;
}
