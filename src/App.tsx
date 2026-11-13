import { useMemo, useState } from 'react';
import { Settings2 } from 'lucide-react';
import { FirstSyncPrompt } from './components/account/FirstSyncPrompt';
import { SyncBadge } from './components/account/SyncBadge';
import { CaptureLauncher } from './components/capture/CaptureLauncher';
import { QuickScribeButton } from './components/capture/QuickScribeButton';
import { AppErrorBoundary } from './components/ErrorBoundary';
import { CandleRow } from './components/delight/CandleRow';
import { SeasonalDecor } from './components/delight/SeasonalDecor';
import { WeeklySummary } from './components/delight/WeeklySummary';
import { FocusChamber } from './components/focus/FocusChamber';
import { LightingCandles, SignInGate } from './components/gate/SignInGate';
import { InstallHint } from './components/install/InstallHint';
import { OfflineBadge } from './components/install/OfflineBadge';
import { NoticeBanner } from './components/NoticeBanner';
import { QuestBoard } from './components/QuestBoard';
import { RealmEffect } from './components/RealmEffect';
import { HeaderSky, SkyGlyph } from './components/sanctuary/HeaderSky';
import { MobileShell } from './components/shell/MobileShell';
import { TimelinePanel } from './components/TimelinePanel';
import { DeskShelf } from './components/trinket/DeskShelf';
import { TutorialRibbon } from './components/TutorialRibbon';
import { SparkleProvider } from './components/ui/Sparkles';
import { ToastProvider } from './components/ui/Toast';
import { VanityDrawer } from './components/VanityDrawer';
import { VelvetPinboard } from './components/VelvetPinboard';
import { LOCAL_ONLY_ALLOWED } from './sync/localOnly';
import { getDefaultBackend } from './sync/supabaseBackend';
import { SyncProvider } from './sync/SyncProvider';
import type { SyncBackend } from './sync/types';

/**
 * Nobody sees inside Vespera without signing in: with sync configured, a signed-out visitor gets only the
 * sign-in gate. Without it, the board opens local-only where that's allowed (tests), and otherwise the
 * gate says sign-in isn't set up. `backend` and `localOnlyAllowed` are seams for tests.
 */
export default function App({ backend, localOnlyAllowed = LOCAL_ONLY_ALLOWED }: { backend?: SyncBackend | null; localOnlyAllowed?: boolean }) {
  const be = useMemo(() => (backend === undefined ? getDefaultBackend() : backend), [backend]);
  return (
    <AppErrorBoundary>
      <ToastProvider>
        {be || localOnlyAllowed ? (
          <SyncProvider backend={be} signedOut={<SignInGate />} loading={<LightingCandles />}>
            <Board />
          </SyncProvider>
        ) : (
          <SignInGate />
        )}
      </ToastProvider>
    </AppErrorBoundary>
  );
}

/** Vespera itself, for whoever is signed in (or local-only in tests). */
function Board() {
  const [vanityOpen, setVanityOpen] = useState(false);
  return (
    <SparkleProvider>
      <RealmEffect />
      <SeasonalDecor />
      <div className="mx-auto flex min-h-screen max-w-[1600px] flex-col gap-5 px-3 py-5 sm:gap-6 sm:px-4 sm:py-6 lg:px-8">
        <header className="relative isolate flex flex-col items-center gap-1 text-center">
          <HeaderSky />
          {/* Phones: the trinket and the controls share a row above the title. From 640px they flank it. */}
          <div className="flex w-full items-center justify-between gap-2 sm:contents">
            <div className="flex min-w-0 items-center gap-2 sm:absolute sm:left-12 sm:top-2">
              <DeskShelf />
              <SyncBadge />
              <OfflineBadge />
            </div>
            <div data-header-cluster className="flex shrink-0 items-center gap-2 sm:absolute sm:right-0 sm:top-2">
              <SkyGlyph />
              <QuickScribeButton />
              <button
                type="button"
                aria-label="Open Settings"
                onClick={() => setVanityOpen(true)}
                className="ornate-border grid h-11 w-11 place-items-center rounded-full text-taupe transition hover:text-gold"
              >
                <Settings2 aria-hidden size={18} />
              </button>
            </div>
          </div>
          <h1 className="font-serif text-4xl font-semibold italic tracking-wide text-gold sm:text-5xl">Vespera</h1>
          <p className="subheading text-lg">a storybook planner</p>
          <CandleRow />
        </header>
        <NoticeBanner />
        <WeeklySummary />
        <TutorialRibbon />
        <InstallHint />
        <MobileShell timeline={<TimelinePanel />} quests={<QuestBoard />} pinboard={<VelvetPinboard />} />
      </div>
      <VanityDrawer open={vanityOpen} onClose={() => setVanityOpen(false)} />
      <FocusChamber />
      <CaptureLauncher />
      <FirstSyncPrompt />
    </SparkleProvider>
  );
}
