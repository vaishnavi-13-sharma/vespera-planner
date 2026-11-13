import { useId, useState, type ReactNode } from 'react';
import { Trash2 } from 'lucide-react';
import {
  addDays,
  pickBlockFields,
  useVespera,
  visibleCategories,
  weekdayOf,
  type Accent,
  type BlockFields,
  type BlockKind,
  type DateKey,
  type EditScope,
  type Occurrence,
  type RepeatRule,
  type VesperaState,
} from '../../context/VesperaContext';
import { AccentSwatches } from '../ui/AccentSwatches';
import { FIELD_CLASS, PRIMARY_BUTTON_CLASS, QUIET_BUTTON_CLASS } from '../ui/accents';
import { ChoiceDialog, EDIT_SCOPE_CHOICES, type Choice } from '../ui/ChoiceDialog';
import { Sheet } from '../ui/Sheet';
import { useToast } from '../ui/Toast';
import { WeekdayChips } from '../ui/WeekdayChips';
import { parseTimeInput, toTimeInput } from './time';

export type EditorTarget =
  | { mode: 'new'; date: DateKey; title: string; kind?: BlockKind; start?: string; end?: string }
  | { mode: 'edit'; occurrence: Occurrence };

type Freq = 'none' | RepeatRule['freq'];
type Interval = 1 | 2 | 3 | 4;

interface Form {
  title: string;
  date: DateKey;
  untimed: boolean;
  start: string;
  end: string;
  timeLabel: string;
  kind: BlockKind;
  accent?: Accent;
  categoryId: string;
  note: string;
  freq: Freq;
  weekdays: number[];
  interval: Interval;
  ends: 'never' | 'on';
  endDate: DateKey;
}

function initialForm(target: EditorTarget, state: VesperaState): Form {
  if (target.mode === 'new') {
    return {
      title: target.title,
      date: target.date,
      untimed: false,
      start: target.start ?? '',
      end: target.end ?? '',
      timeLabel: 'Flexible',
      kind: target.kind ?? 'focus',
      categoryId: '',
      note: '',
      freq: 'none',
      weekdays: [weekdayOf(target.date)],
      interval: 1,
      ends: 'never',
      endDate: '',
    };
  }
  const occ = target.occurrence;
  const series = occ.source.type === 'series' ? state.series.find((s) => s.id === occ.source.id) : undefined;
  const rule = occ.repeat;
  return {
    title: occ.title,
    date: occ.date,
    untimed: occ.start === null || occ.end === null,
    start: toTimeInput(occ.start),
    end: toTimeInput(occ.end),
    timeLabel: occ.timeLabel ?? 'Flexible',
    kind: occ.kind,
    accent: occ.accent,
    categoryId: occ.categoryId ?? '',
    note: occ.note ?? '',
    freq: rule ? rule.freq : 'none',
    weekdays: rule?.freq === 'weekly' ? rule.weekdays : [weekdayOf(occ.date)],
    interval: rule?.freq === 'weekly' ? rule.interval : 1,
    ends: series?.endDate ? 'on' : 'never',
    endDate: series?.endDate ?? '',
  };
}

function ruleOf(form: Form): RepeatRule | null {
  switch (form.freq) {
    case 'none':
      return null;
    case 'weekly':
      return { freq: 'weekly', interval: form.interval, weekdays: form.weekdays.length ? form.weekdays : [weekdayOf(form.date)] };
    default:
      return { freq: form.freq };
  }
}

/** Everything the form says, as a complete field set. Invalid times (end ≤ start) float with the time label. */
function fieldsOf(form: Form): BlockFields {
  const s = parseTimeInput(form.start);
  const e = parseTimeInput(form.end);
  const timed = !form.untimed && s !== null && e !== null && e > s;
  return pickBlockFields({
    title: form.title.trim(),
    kind: form.kind,
    start: timed ? s : null,
    end: timed ? e : null,
    timeLabel: timed ? undefined : form.timeLabel.trim() || 'Flexible',
    accent: form.accent,
    note: form.note.trim() || undefined,
    categoryId: form.categoryId || undefined,
  });
}

const sameRule = (a: RepeatRule | null, b: RepeatRule | null) => JSON.stringify(a) === JSON.stringify(b);

const DELETE_SCOPE_CHOICES: Choice<EditScope>[] = EDIT_SCOPE_CHOICES.map((c) => (c.value === 'future' ? { ...c, tone: 'danger' } : c));

function Field({ label, htmlFor, children }: { label: string; htmlFor: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={htmlFor} className="text-xs uppercase tracking-widest text-taupe">
        {label}
      </label>
      {children}
    </div>
  );
}

/** The "Edit block" / "New block" sheet, with the repeat builder and the this-one / all-future question. */
export function BlockEditor({ target, onClose }: { target: EditorTarget; onClose: () => void }) {
  const { state, addBlock, editOccurrence, deleteOccurrence } = useVespera();
  const showToast = useToast();
  const id = useId();
  const [form, setForm] = useState<Form>(() => initialForm(target, state));
  const [asking, setAsking] = useState<'save' | 'delete' | null>(null);
  const set = <K extends keyof Form>(key: K, value: Form[K]) => setForm((f) => ({ ...f, [key]: value }));

  const occurrence = target.mode === 'edit' ? target.occurrence : null;
  const isSeries = occurrence?.source.type === 'series';
  const series = isSeries ? state.series.find((s) => s.id === occurrence!.source.id) : undefined;
  const categories = visibleCategories(state.categories);
  const linkedArchived = state.categories.find((c) => c.id === form.categoryId && c.archived);

  const repeat = ruleOf(form);
  const endDate = repeat && form.ends === 'on' && form.endDate ? (form.endDate < form.date ? form.date : form.endDate) : null;
  // A changed rule or end date can only apply from this date on, so "Just this one" isn't offered.
  const repeatChanged = isSeries && (!sameRule(repeat, occurrence!.repeat) || endDate !== (series?.endDate ?? null));
  const canSave = form.title.trim() !== '';

  function save(scope: EditScope = 'this') {
    const fields = fieldsOf(form);
    if (!occurrence) addBlock(form.date, fields, repeat, endDate ?? undefined);
    else editOccurrence(occurrence.source, fields, scope, { date: form.date, repeat, endDate });
    onClose();
  }

  function remove(scope: EditScope = 'this') {
    if (!occurrence) return;
    deleteOccurrence(occurrence.source, scope);
    if (occurrence.source.type === 'oneoff') {
      const { date } = occurrence;
      const fields = pickBlockFields(occurrence);
      showToast({ message: `Removed “${occurrence.title}”`, actionLabel: 'Undo', onAction: () => addBlock(date, fields) });
    }
    onClose();
  }

  function changeFreq(freq: Freq) {
    setForm((f) => ({
      ...f,
      freq,
      // Picking "Weekly" fresh starts from the block's own weekday.
      weekdays: freq === 'weekly' && f.freq !== 'weekly' && occurrence?.repeat?.freq !== 'weekly' ? [weekdayOf(f.date)] : f.weekdays,
    }));
  }

  function changeEnds(ends: 'never' | 'on') {
    setForm((f) => ({ ...f, ends, endDate: ends === 'on' && !f.endDate ? addDays(f.date, 28) : f.endDate }));
  }

  const footer = (
    <>
      {occurrence && (
        <button
          type="button"
          onClick={() => (isSeries ? setAsking('delete') : remove())}
          className="mr-auto inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm text-rose transition hover:bg-rose/10"
        >
          <Trash2 aria-hidden size={15} />
          Delete
        </button>
      )}
      <button type="button" onClick={onClose} className={QUIET_BUTTON_CLASS}>
        Cancel
      </button>
      <button
        type="button"
        disabled={!canSave}
        onClick={() => (isSeries ? setAsking('save') : save())}
        className={`${PRIMARY_BUTTON_CLASS} disabled:cursor-not-allowed disabled:opacity-50`}
      >
        Save
      </button>
    </>
  );

  return (
    <>
      <Sheet
        open
        // While the scope question is up, Escape belongs to it.
        onClose={() => {
          if (!asking) onClose();
        }}
        title={occurrence ? 'Edit block' : 'New block'}
        footer={footer}
      >
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (canSave) (isSeries ? setAsking('save') : save());
          }}
          className="flex flex-col gap-4"
        >
          <Field label="Title" htmlFor={`${id}-title`}>
            <input id={`${id}-title`} value={form.title} onChange={(e) => set('title', e.target.value)} className={`${FIELD_CLASS} font-serif text-lg`} />
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Date" htmlFor={`${id}-date`}>
              <input id={`${id}-date`} type="date" value={form.date} onChange={(e) => e.target.value && set('date', e.target.value)} className={FIELD_CLASS} />
            </Field>
            <Field label="Type" htmlFor={`${id}-kind`}>
              <select id={`${id}-kind`} value={form.kind} onChange={(e) => set('kind', e.target.value as BlockKind)} className={FIELD_CLASS}>
                <option value="focus">Focus</option>
                <option value="flexible">Flexible</option>
                <option value="anchor">Anchor</option>
              </select>
            </Field>
          </div>

          <fieldset className="flex flex-col gap-3 rounded-xl border border-gold/15 p-3">
            <legend className="px-1 font-serif text-sm italic text-gold">When</legend>
            <label className="inline-flex items-center gap-2 text-sm text-vanilla">
              <input type="checkbox" checked={form.untimed} onChange={(e) => set('untimed', e.target.checked)} className="h-4 w-4 accent-[var(--color-gold)]" />
              No set time
            </label>
            {form.untimed ? (
              <Field label="Time label" htmlFor={`${id}-label`}>
                <input id={`${id}-label`} value={form.timeLabel} onChange={(e) => set('timeLabel', e.target.value)} placeholder="Flexible" className={FIELD_CLASS} />
              </Field>
            ) : (
              <div className="grid grid-cols-2 gap-3">
                <Field label="Start" htmlFor={`${id}-start`}>
                  <input id={`${id}-start`} type="time" value={form.start} onChange={(e) => set('start', e.target.value)} className={FIELD_CLASS} />
                </Field>
                <Field label="End" htmlFor={`${id}-end`}>
                  <input id={`${id}-end`} type="time" value={form.end} onChange={(e) => set('end', e.target.value)} className={FIELD_CLASS} />
                </Field>
              </div>
            )}
          </fieldset>

          <fieldset className="flex flex-col gap-3 rounded-xl border border-gold/15 p-3">
            <legend className="px-1 font-serif text-sm italic text-gold">Repeats</legend>
            <Field label="Repeat" htmlFor={`${id}-repeat`}>
              <select id={`${id}-repeat`} value={form.freq} onChange={(e) => changeFreq(e.target.value as Freq)} className={FIELD_CLASS}>
                <option value="none">Never</option>
                <option value="daily">Daily</option>
                <option value="weekdays">Weekdays</option>
                <option value="weekly">Weekly</option>
                <option value="monthly">Monthly</option>
              </select>
            </Field>
            {form.freq === 'weekly' && (
              <>
                <WeekdayChips value={form.weekdays} onChange={(days) => set('weekdays', days)} />
                <Field label="Every" htmlFor={`${id}-interval`}>
                  <select
                    id={`${id}-interval`}
                    value={form.interval}
                    onChange={(e) => set('interval', Number(e.target.value) as Interval)}
                    className={FIELD_CLASS}
                  >
                    {[1, 2, 3, 4].map((n) => (
                      <option key={n} value={n}>
                        {n} {n === 1 ? 'week' : 'weeks'}
                      </option>
                    ))}
                  </select>
                </Field>
              </>
            )}
            {form.freq !== 'none' && (
              <div className="grid grid-cols-2 gap-3">
                <Field label="Ends" htmlFor={`${id}-ends`}>
                  <select id={`${id}-ends`} value={form.ends} onChange={(e) => changeEnds(e.target.value as 'never' | 'on')} className={FIELD_CLASS}>
                    <option value="never">Never</option>
                    <option value="on">On a date</option>
                  </select>
                </Field>
                {form.ends === 'on' && (
                  <Field label="End date" htmlFor={`${id}-end-date`}>
                    <input
                      id={`${id}-end-date`}
                      type="date"
                      min={form.date}
                      value={form.endDate}
                      onChange={(e) => set('endDate', e.target.value)}
                      className={FIELD_CLASS}
                    />
                  </Field>
                )}
              </div>
            )}
          </fieldset>

          <div className="flex flex-col gap-1.5">
            <span className="text-xs uppercase tracking-widest text-taupe">Accent</span>
            <div className="flex flex-wrap items-center gap-3">
              {/* With no accent set, no swatch is checked. */}
              <AccentSwatches label="Accent" value={form.accent as Accent} onChange={(a) => set('accent', a)} />
              <button
                type="button"
                aria-pressed={!form.accent}
                onClick={() => set('accent', undefined)}
                className={`${QUIET_BUTTON_CLASS} px-2.5 py-1 text-xs ${!form.accent ? 'border-gold text-vanilla' : ''}`}
              >
                No accent
              </button>
            </div>
          </div>

          <Field label="Linked quest category" htmlFor={`${id}-category`}>
            <select id={`${id}-category`} value={form.categoryId} onChange={(e) => set('categoryId', e.target.value)} className={FIELD_CLASS}>
              <option value="">None</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.emoji} {c.name}
                </option>
              ))}
              {linkedArchived && (
                <option value={linkedArchived.id}>
                  {linkedArchived.emoji} {linkedArchived.name} (archived)
                </option>
              )}
            </select>
          </Field>

          <Field label="Note" htmlFor={`${id}-note`}>
            <textarea
              id={`${id}-note`}
              rows={3}
              value={form.note}
              onChange={(e) => set('note', e.target.value)}
              placeholder="Add a note…"
              className={`${FIELD_CLASS} resize-y font-serif`}
            />
          </Field>
        </form>
      </Sheet>

      <ChoiceDialog
        open={asking !== null}
        title={asking === 'delete' ? 'Delete repeating block' : 'Save repeating block'}
        message={
          asking === 'save' && repeatChanged
            ? 'A new repeat pattern starts from this date. Earlier ones stay as they were.'
            : `“${form.title.trim() || occurrence?.title}” repeats. Which ones should change?`
        }
        choices={asking === 'delete' ? DELETE_SCOPE_CHOICES : repeatChanged ? EDIT_SCOPE_CHOICES.filter((c) => c.value === 'future') : EDIT_SCOPE_CHOICES}
        onChoose={(scope) => (asking === 'delete' ? remove(scope) : save(scope))}
        onCancel={() => setAsking(null)}
      />
    </>
  );
}
