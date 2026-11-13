import { useSync } from '../../sync/SyncProvider';
import { ChoiceDialog, type Choice } from '../ui/ChoiceDialog';
import { useToast } from '../ui/Toast';

type FirstSyncChoice = 'upload' | 'fresh';

const CHOICES: Choice<FirstSyncChoice>[] = [
  { value: 'upload', label: 'Bring this board', description: 'It moves into your account and syncs to your other devices.', tone: 'primary' },
  { value: 'fresh', label: 'Start fresh', description: 'Your account starts with the Welcome guide; this board stays here, signed out.' },
];

/** First sign-in on a device that already has a board: bring it in, or start the account fresh? */
export function FirstSyncPrompt() {
  const { enabled, user, pendingFirstSync, resolveFirstSync, signOut } = useSync();
  const showToast = useToast();
  if (!enabled) return null;

  return (
    <ChoiceDialog
      open={pendingFirstSync}
      title="Bring this board into your account?"
      message={`This device already has a Vespera board. Bring it into ${user?.email ?? 'your account'} so it syncs everywhere, or start your account fresh.`}
      choices={CHOICES}
      onChoose={(choice) => {
        void resolveFirstSync(choice).then(() =>
          showToast({ message: choice === 'upload' ? 'Your board is now in your account' : 'Your account is starting fresh' }),
        );
      }}
      onCancel={() => void signOut()}
    />
  );
}
