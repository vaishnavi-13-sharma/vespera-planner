import { AccountSection } from './account/AccountSection';
import { DelightSettings } from './delight/DelightSettings';
import { OracleSection } from './oracle-settings/OracleSection';
import { RealmSection } from './sanctuary/RealmSection';
import { FastenerSection } from './signet/FastenerSection';
import { SignetSection } from './signet/SignetSection';
import { TrinketSection } from './trinket/TrinketSection';
import { Sheet } from './ui/Sheet';
import { BackupSettings } from './vanity/BackupSettings';
import { DaySettings } from './vanity/DaySettings';
import { GentleStartSettings } from './vanity/GentleStartSettings';
import { VanityAccordion } from './vanity/VanityAccordion';
import './vanity/vanity.css';

/**
 * Settings drawer: account, your sanctuary (realm, signet, pinboard, trinket), Quick Scribe, your day, Gentle Start,
 * delights, and backup & reset. Each is a folded compartment showing what's chosen; one opens at a time.
 */
export function VanityDrawer({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <Sheet open={open} onClose={onClose} title="Settings">
      <p className="subheading -mt-1">Change how Vespera looks and works.</p>
      <VanityAccordion>
        <AccountSection />
        <RealmSection />
        <SignetSection />
        <FastenerSection />
        <TrinketSection />
        <OracleSection />
        <DaySettings />
        <GentleStartSettings />
        <DelightSettings />
        <BackupSettings />
      </VanityAccordion>
    </Sheet>
  );
}
