import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { AlertCircle, ArrowLeft, CheckCircle2, Clock3, MapPin, ReceiptText, ShieldCheck } from 'lucide-react';
import { Link, useLocation, useParams } from 'wouter';
import {
  getGetCallQueryKey,
  getGetDashboardQueryKey,
  getGetPassportQueryKey,
  getGetVaultQueryKey,
  getListCallsQueryKey,
  useFinishCall,
  useGetCallWorkday,
  type FinishCallInput,
} from '@workspace/api-client-react';

type CloseoutDraft = Record<string, string>;

function localDateTime() {
  const now = new Date();
  const local = new Date(now.getTime() - now.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 16);
}

function toLocalInput(value?: string | null) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value.slice(0, 16);
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 16);
}

function money(value: number) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(value);
}

function hoursBetween(start: string, end: string, breakMinutes: number) {
  const startMs = new Date(start).getTime();
  const endMs = new Date(end).getTime();
  if (!Number.isFinite(startMs) || !Number.isFinite(endMs) || endMs <= startMs) return null;
  return Math.max(0, (endMs - startMs) / 3_600_000 - Math.max(0, breakMinutes) / 60);
}

function readDraft(callId: number): CloseoutDraft {
  if (!Number.isFinite(callId) || callId <= 0) return {};
  try {
    const value = JSON.parse(sessionStorage.getItem(`stagewire-finish-${callId}`) || '{}');
    return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
  } catch {
    return {};
  }
}

function formDraft(form: HTMLFormElement): CloseoutDraft {
  const draft: CloseoutDraft = {};
  new FormData(form).forEach((value, key) => { draft[key] = String(value); });
  return draft;
}

export default function SmartFinishCallPage() {
  const { id } = useParams<{ id: string }>();
  const callId = Number(id);
  const client = useQueryClient();
  const [, setLocation] = useLocation();
  const workday = useGetCallWorkday(callId);
  const finish = useFinishCall();
  const [draft] = useState<CloseoutDraft>(() => readDraft(callId));
  const [validationError, setValidationError] = useState<string | null>(null);
  const [previewStart, setPreviewStart] = useState(() => draft.actualStart || '');
  const [previewEnd, setPreviewEnd] = useState(() => draft.actualEnd || localDateTime());
  const [endEdited, setEndEdited] = useState(() => Boolean(draft.actualEnd));
  const [previewBreak, setPreviewBreak] = useState(() => Number(draft.breakMinutes || 0));
  const [previewInitialized, setPreviewInitialized] = useState(false);
  const [isOnline, setIsOnline] = useState(() => navigator.onLine);

  const data = workday.data;
  const call = data?.call;
  const initialStart = draft.actualStart || toLocalInput(call?.actualStart);
  const itemizedExpenseTotal = useMemo(() => data?.expenses.reduce((sum, item) => sum + item.amount, 0) ?? 0, [data]);
  const expenseTotal = Math.max(itemizedExpenseTotal, call?.expenseAmount ?? 0);
  const notes = data?.notes ?? [];
  const recentNotes = useMemo(() => [...(data?.notes ?? [])].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()).slice(0, 5), [data]);
  const checklistDone = data?.checklist.items.filter((item) => item.checked).length ?? 0;
  const checklistTotal = data?.checklist.items.length ?? 0;
  const shiftHours = hoursBetween(previewStart, previewEnd, previewBreak);

  useEffect(() => {
    if (!call || previewInitialized) return;
    if (!previewStart) setPreviewStart(toLocalInput(call.actualStart));
    if (!draft.breakMinutes) setPreviewBreak(call.breakMinutes || 0);
    setPreviewInitialized(true);
  }, [call, draft.breakMinutes, previewInitialized, previewStart]);

  useEffect(() => {
    const updateConnection = () => setIsOnline(navigator.onLine);
    window.addEventListener('online', updateConnection);
    window.addEventListener('offline', updateConnection);
    return () => {
      window.removeEventListener('online', updateConnection);
      window.removeEventListener('offline', updateConnection);
    };
  }, []);

  if (!Number.isFinite(callId) || callId <= 0) {
    return <div className="page-wrap"><div className="error-box"><strong>Invalid call.</strong></div></div>;
  }

  if (workday.isLoading) {
    return <div className="page-wrap"><div className="card card-pad"><h2>Loading closeout…</h2></div></div>;
  }

  if (workday.isError || !data || !call) {
    return <div className="page-wrap"><div className="error-box"><AlertCircle size={20} /><strong>Could not load this call for closeout.</strong><button className="btn btn-quiet" onClick={() => workday.refetch()}>Try again</button></div></div>;
  }

  const saveDraft = (event: FormEvent<HTMLFormElement>) => {
    try {
      const next = formDraft(event.currentTarget);
      if (!endEdited && next.actualEnd === previewEnd) delete next.actualEnd;
      sessionStorage.setItem(`stagewire-finish-${callId}`, JSON.stringify(next));
    } catch {}
  };

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setValidationError(null);

    const form = new FormData(event.currentTarget);
    const actualStartRaw = String(form.get('actualStart') || '');
    const actualEndRaw = endEdited ? String(form.get('actualEnd') || '') : localDateTime();
    const breakMinutes = Number(form.get('breakMinutes') || 0);
    const computedHours = hoursBetween(actualStartRaw, actualEndRaw, breakMinutes);

    if (!actualStartRaw || !actualEndRaw) {
      setValidationError('Paid start and actual end are required.');
      return;
    }
    if (computedHours === null) {
      setValidationError('Actual end must be after paid start. Check the time and try again.');
      return;
    }
    if (!Number.isFinite(breakMinutes) || breakMinutes < 0) {
      setValidationError('Break minutes must be zero or a positive number.');
      return;
    }
    const elapsedMinutes = (new Date(actualEndRaw).getTime() - new Date(actualStartRaw).getTime()) / 60_000;
    if (breakMinutes >= elapsedMinutes) {
      setValidationError('Break time must be shorter than the total call time.');
      return;
    }
    if (computedHours > 24) {
      setValidationError('This shift is over 24 hours. Check the dates before locking the receipt.');
      return;
    }

    const payload: FinishCallInput = {
      actualStart: new Date(actualStartRaw).toISOString(),
      actualEnd: new Date(actualEndRaw).toISOString(),
      breakMinutes,
      role: String(form.get('role') || call.role),
      arrivalAt: call.arrivalAt,
      additionalExpenseAmount: Number(form.get('additionalExpenseAmount') || 0),
      additionalExpenseCategory: String(form.get('additionalExpenseCategory') || 'Other'),
      additionalExpenseDescription: String(form.get('additionalExpenseDescription') || '') || null,
      mileage: Number(form.get('mileage') || call.mileage || 0),
      parkingExpense: Number(form.get('parkingExpense') || 0),
      tollExpense: Number(form.get('tollExpense') || 0),
      note: String(form.get('finalNote') || '') || null,
      receiptAttachmentName: String(form.get('receiptAttachmentName') || '') || null,
      workPhotoName: String(form.get('workPhotoName') || '') || null,
    };

    finish.mutate(
      { id: callId, data: payload },
      {
        onSuccess: (result) => {
          client.invalidateQueries({ queryKey: getListCallsQueryKey() });
          client.invalidateQueries({ queryKey: getGetDashboardQueryKey() });
          client.invalidateQueries({ queryKey: getGetVaultQueryKey() });
          client.invalidateQueries({ queryKey: getGetPassportQueryKey() });
          client.setQueryData(getGetCallQueryKey(callId), result);
          sessionStorage.removeItem(`stagewire-finish-${callId}`);
          setLocation(`/receipt/${result.id}`);
        },
      },
    );
  };

  return (
    <div className="page-wrap finish-call-page">
      <div className="page-heading">
        <div>
          <Link href={`/workday/${call.id}`} className="link-text"><ArrowLeft size={17} /> Active call</Link>
          <div className="eyebrow" style={{ marginTop: 24 }}>Smart closeout</div>
          <h1 style={{ marginTop: 10 }}>Finish the call.</h1>
          <p className="subtitle">StageWire already has the workday. Confirm the end, add only what changed, and lock the receipt.</p>
        </div>
      </div>

      <div className="card card-pad" style={{ marginBottom: 22 }}>
        <div className="finish-context">
          <div>
            <span className="eyebrow">Closing out</span>
            <h2 style={{ marginTop: 6 }}>{call.showName}</h2>
            <p className="call-meta"><MapPin size={15} style={{ verticalAlign: '-2px' }} /> {call.venue} · {call.role}</p>
          </div>
          <span className={`badge badge-${call.status}`}>{call.status}</span>
        </div>
        <div className="stats-grid" style={{ marginTop: 18 }}>
          <div className="card stat-card"><span className="stat-label">Paid start</span><strong className="stat-value" style={{ fontSize: '1.3rem' }}>{call.actualStart ? new Date(call.actualStart).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }) : 'Not started'}</strong></div>
          <div className="card stat-card"><span className="stat-label">Logged expenses</span><strong className="stat-value" style={{ fontSize: '1.3rem' }}>{money(expenseTotal)}</strong></div>
          <div className="card stat-card"><span className="stat-label">Saved notes</span><strong className="stat-value" style={{ fontSize: '1.3rem' }}>{notes.length}</strong></div>
          <div className="card stat-card"><span className="stat-label">Checklist</span><strong className="stat-value" style={{ fontSize: '1.3rem' }}>{checklistDone}/{checklistTotal}</strong></div>
        </div>
      </div>

      {!isOnline && (
        <div className="warning-box" role="alert" style={{ marginBottom: 22 }}>
          <AlertCircle size={22} />
          <div>
            <strong>This device appears offline.</strong>
            <p>Keep this tab open. StageWire is keeping your unfinished closeout here; finish the call after your signal returns.</p>
          </div>
        </div>
      )}

      <form className="card card-pad form-card" onSubmit={submit} onInput={saveDraft}>
        <div className="eyebrow">Confirm the closeout</div>
        <div className="privacy-rule" style={{ marginTop: 14 }}><ShieldCheck size={18} /><span>Your unfinished closeout is kept in this browser tab session so a refresh does not wipe what you just typed. The draft is cleared when the receipt locks.</span></div>
        <div className="form-grid" style={{ marginTop: 18 }}>
          <div className="field">
            <label htmlFor="actualStart">Paid start</label>
            <input id="actualStart" name="actualStart" type="datetime-local" required defaultValue={initialStart} onChange={(e) => setPreviewStart(e.target.value)} />
            <span className="help-text">Already carried from Active Call.</span>
          </div>
          <div className="field">
            <label htmlFor="actualEnd">Actual end</label>
            <input id="actualEnd" name="actualEnd" type="datetime-local" required defaultValue={draft.actualEnd || previewEnd} onChange={(e) => { setPreviewEnd(e.target.value); setEndEdited(true); }} />
            <span className="help-text">{endEdited ? 'Using your saved or edited end time.' : 'If you leave this alone, Finish uses the current time when you tap the button.'}</span>
          </div>
          <div className="field">
            <label htmlFor="breakMinutes">Break minutes</label>
            <input id="breakMinutes" name="breakMinutes" type="number" min="0" step="1" defaultValue={draft.breakMinutes || call.breakMinutes || 0} onChange={(e) => setPreviewBreak(Number(e.target.value || 0))} />
          </div>
          <div className="field">
            <label htmlFor="role">Final role check</label>
            <input id="role" name="role" defaultValue={draft.role || call.role} required />
          </div>
          <div className="field">
            <label htmlFor="mileage">Mileage</label>
            <input id="mileage" name="mileage" type="number" min="0" step="0.1" defaultValue={draft.mileage || call.mileage || 0} />
          </div>
          <div className="field">
            <label htmlFor="parkingExpense">Last-minute parking</label>
            <input id="parkingExpense" name="parkingExpense" type="number" min="0" step="0.01" defaultValue={draft.parkingExpense || '0'} />
          </div>
          <div className="field">
            <label htmlFor="tollExpense">Last-minute toll</label>
            <input id="tollExpense" name="tollExpense" type="number" min="0" step="0.01" defaultValue={draft.tollExpense || '0'} />
          </div>
          <div className="field">
            <label htmlFor="additionalExpenseAmount">Other last expense</label>
            <input id="additionalExpenseAmount" name="additionalExpenseAmount" type="number" min="0" step="0.01" defaultValue={draft.additionalExpenseAmount || '0'} />
          </div>
          <div className="field">
            <label htmlFor="additionalExpenseCategory">Expense category</label>
            <select id="additionalExpenseCategory" name="additionalExpenseCategory" defaultValue={draft.additionalExpenseCategory || 'Other'}><option>Other</option><option>Meal</option><option>Transportation</option><option>Supplies</option><option>Lodging</option></select>
          </div>
          <div className="field">
            <label htmlFor="additionalExpenseDescription">Expense detail</label>
            <input id="additionalExpenseDescription" name="additionalExpenseDescription" defaultValue={draft.additionalExpenseDescription || ''} placeholder="Only if you added an expense" />
          </div>
          <div className="field full">
            <label htmlFor="finalNote">Final note</label>
            <textarea id="finalNote" name="finalNote" defaultValue={draft.finalNote || ''} placeholder="Optional closeout note. Your earlier workday notes are already saved." />
          </div>
          <div className="field">
            <label htmlFor="receiptAttachmentName">Receipt attachment</label>
            <input id="receiptAttachmentName" name="receiptAttachmentName" defaultValue={draft.receiptAttachmentName || ''} placeholder="Optional filename for now" />
          </div>
          <div className="field">
            <label htmlFor="workPhotoName">Work photo</label>
            <input id="workPhotoName" name="workPhotoName" defaultValue={draft.workPhotoName || ''} placeholder="Optional filename for now" />
          </div>
        </div>

        <div className="closeout-check card" aria-live="polite">
          <div><span className="receipt-label">Calculated shift</span><strong>{shiftHours === null ? 'Check start/end' : `${shiftHours.toFixed(2)} hours`}</strong></div>
          <div><span className="receipt-label">Checklist</span><strong>{checklistDone}/{checklistTotal} complete</strong></div>
          <div><span className="receipt-label">Already logged</span><strong>{money(expenseTotal)} expenses</strong></div>
        </div>

        {checklistTotal > 0 && checklistDone < checklistTotal && (
          <div className="warning-box" role="status"><AlertCircle size={20} /><div><strong>Checklist isn’t complete.</strong><p>You can still finish the call. StageWire will preserve exactly what was checked and what wasn’t.</p></div></div>
        )}

        {recentNotes.length > 0 && (
          <div className="card" style={{ marginTop: 22, padding: 18 }}>
            <div className="eyebrow">Already saved today</div>
            <div className="vault-items" style={{ marginTop: 12 }}>{recentNotes.map((note) => <div className="vault-item" key={note.id}><span>{note.text}</span><span>saved</span></div>)}</div>
          </div>
        )}

        {validationError && <div className="error-box" role="alert" style={{ marginTop: 20 }}><AlertCircle size={20} /> {validationError}</div>}
        {finish.error && (
          <div className="error-box" role="alert" style={{ marginTop: 20 }}>
            <AlertCircle size={20} />
            <div>
              <strong>Receipt was not locked.</strong>
              <p>{(finish.error as Error).message || 'This call could not be finished.'} Your unfinished closeout remains in this tab. Retry when your signal returns.</p>
            </div>
          </div>
        )}

        <div className="closeout-lock-note"><ShieldCheck size={19} /><span>Finishing creates the permanent Call Receipt. You can still view the record afterward, but the workday is treated as completed.</span></div>

        <div className="form-actions finish-actions" style={{ marginTop: 24 }}>
          <button className="btn btn-primary" type="submit" disabled={finish.isPending || !call.actualStart}>
            {finish.isPending ? 'Locking receipt…' : <><ReceiptText size={21} /> Finish & lock receipt</>}
          </button>
          <Link href={`/workday/${call.id}`} className="btn btn-quiet">Back to active call</Link>
        </div>

        {!call.actualStart && <div className="error-box" role="alert" style={{ marginTop: 18 }}><Clock3 size={20} /> Start paid work before finishing this call.</div>}
      </form>
    </div>
  );
}