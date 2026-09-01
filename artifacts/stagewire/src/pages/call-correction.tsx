import { useState, type FormEvent } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { AlertCircle, ArrowLeft, CheckCircle2, LockKeyhole, Save, ShieldCheck, Trash2, WalletCards } from 'lucide-react';
import { Link, useLocation, useParams } from 'wouter';
import {
  getGetCallQueryKey,
  getGetCallWorkdayQueryKey,
  getGetDashboardQueryKey,
  getGetPassportQueryKey,
  getGetVaultQueryKey,
  getListCallsQueryKey,
  useGetCallWorkday,
} from '@workspace/api-client-react';

function toLocalInput(value?: string | null) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value.slice(0, 16);
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 16);
}

function optional(form: FormData, name: string) {
  const value = String(form.get(name) || '').trim();
  return value || null;
}

function money(value: number) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(value || 0);
}

export default function CallCorrectionPage() {
  const { id } = useParams<{ id: string }>();
  const callId = Number(id);
  const workday = useGetCallWorkday(callId);
  const client = useQueryClient();
  const [, setLocation] = useLocation();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expenseSaving, setExpenseSaving] = useState<number | null>(null);
  const [expenseError, setExpenseError] = useState<string | null>(null);
  const [expenseMessage, setExpenseMessage] = useState<string | null>(null);
  const call = workday.data?.call;
  const expenses = workday.data?.expenses ?? [];

  if (!Number.isFinite(callId) || callId <= 0) return <div className="page-wrap"><div className="error-box"><strong>Invalid call.</strong></div></div>;
  if (workday.isLoading) return <div className="page-wrap"><div className="card card-pad"><h2>Opening correction…</h2></div></div>;
  if (workday.isError || !call) return <div className="page-wrap"><div className="error-box"><strong>This call could not be opened for correction.</strong><button className="btn btn-quiet" onClick={() => workday.refetch()}>Try again</button></div></div>;
  if (call.status !== 'finished') return <div className="page-wrap"><div className="error-box"><AlertCircle size={20}/><div><strong>This call is not finished yet.</strong><p>Corrections are for locked Call Receipts. Use the active call while the job is still open.</p><Link href={`/workday/${callId}`} className="btn btn-primary" style={{ marginTop: 14 }}>Open active call</Link></div></div></div>;

  const refreshRecords = async () => {
    await Promise.all([
      client.invalidateQueries({ queryKey: getGetCallQueryKey(callId) }),
      client.invalidateQueries({ queryKey: getGetCallWorkdayQueryKey(callId) }),
      client.invalidateQueries({ queryKey: getListCallsQueryKey() }),
      client.invalidateQueries({ queryKey: getGetDashboardQueryKey() }),
      client.invalidateQueries({ queryKey: getGetVaultQueryKey() }),
      client.invalidateQueries({ queryKey: getGetPassportQueryKey() }),
    ]);
  };

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    const form = new FormData(event.currentTarget);
    const startRaw = String(form.get('actualStart') || '');
    const endRaw = String(form.get('actualEnd') || '');
    const breakMinutes = Number(form.get('breakMinutes') || 0);

    if (!startRaw || !endRaw) {
      setError('Paid start and actual end are required on a finished call.');
      return;
    }
    const startMs = new Date(startRaw).getTime();
    const endMs = new Date(endRaw).getTime();
    if (!Number.isFinite(startMs) || !Number.isFinite(endMs) || endMs <= startMs) {
      setError('Actual end must be after paid start.');
      return;
    }
    const elapsedMinutes = (endMs - startMs) / 60_000;
    if (!Number.isFinite(breakMinutes) || breakMinutes < 0 || breakMinutes >= elapsedMinutes) {
      setError('Break time must be zero or more and shorter than the total call time.');
      return;
    }
    if (elapsedMinutes / 60 > 24) {
      setError('This corrected shift is over 24 hours. Check the dates and times.');
      return;
    }

    const payload = {
      showName: String(form.get('showName') || '').trim(),
      venue: String(form.get('venue') || '').trim(),
      venueAddress: optional(form, 'venueAddress'),
      workDate: String(form.get('workDate') || ''),
      scheduledStart: optional(form, 'scheduledStart'),
      estimatedEnd: optional(form, 'estimatedEnd'),
      role: String(form.get('role') || '').trim(),
      department: optional(form, 'department'),
      employer: optional(form, 'employer'),
      crewContactName: optional(form, 'crewContactName'),
      crewContactPhone: optional(form, 'crewContactPhone'),
      parkingInstructions: optional(form, 'parkingInstructions'),
      crewEntrance: optional(form, 'crewEntrance'),
      loadingDockInfo: optional(form, 'loadingDockInfo'),
      dressRequirements: optional(form, 'dressRequirements'),
      ppeRequirements: optional(form, 'ppeRequirements'),
      toolRequirements: optional(form, 'toolRequirements'),
      generalNotes: optional(form, 'generalNotes'),
      payType: String(form.get('payType') || 'hourly'),
      minimumHours: Number(form.get('minimumHours') || 0),
      hourlyRate: Number(form.get('hourlyRate') || 0),
      arrivalAt: optional(form, 'arrivalAt') ? new Date(String(form.get('arrivalAt'))).toISOString() : null,
      actualStart: new Date(startRaw).toISOString(),
      actualEnd: new Date(endRaw).toISOString(),
      breakMinutes,
      mileage: Number(form.get('mileage') || 0),
      note: optional(form, 'note'),
    };

    if (!payload.showName || !payload.venue || !payload.workDate || !payload.role) {
      setError('Show, venue, work date, and role cannot be blank.');
      return;
    }

    try {
      setSaving(true);
      const response = await fetch(`/api/calls/${callId}/correct`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error || 'This correction could not be saved.');
      if (!result.corrected) {
        setError('Nothing changed. The locked Call Receipt was left exactly as it was.');
        return;
      }
      await refreshRecords();
      setLocation(`/receipt/${callId}?corrected=1`);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'This correction could not be saved.');
    } finally {
      setSaving(false);
    }
  };

  const correctExpense = async (event: FormEvent<HTMLFormElement>, expenseId: number) => {
    event.preventDefault();
    setExpenseError(null);
    setExpenseMessage(null);
    const form = new FormData(event.currentTarget);
    const amount = Number(form.get('amount') || 0);
    const category = String(form.get('category') || '').trim();
    if (!Number.isFinite(amount) || amount <= 0) {
      setExpenseError('Expense amount must be greater than zero.');
      return;
    }
    if (!category) {
      setExpenseError('Expense category cannot be blank.');
      return;
    }

    try {
      setExpenseSaving(expenseId);
      const response = await fetch(`/api/calls/${callId}/expenses/${expenseId}/correct`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          amount,
          category,
          description: optional(form, 'description'),
          receiptAttachmentName: optional(form, 'receiptAttachmentName'),
        }),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error || 'That expense correction could not be saved.');
      if (!result.corrected) {
        setExpenseError('Nothing changed on that expense.');
        return;
      }
      await refreshRecords();
      setExpenseMessage(`Expense #${expenseId} corrected. Money and the Call Receipt were refreshed.`);
    } catch (caught) {
      setExpenseError(caught instanceof Error ? caught.message : 'That expense correction could not be saved.');
    } finally {
      setExpenseSaving(null);
    }
  };

  const removeExpense = async (expenseId: number) => {
    setExpenseError(null);
    setExpenseMessage(null);
    if (!window.confirm('Remove this mistaken expense from the Call Receipt? StageWire will add a private correction note.')) return;
    try {
      setExpenseSaving(expenseId);
      const response = await fetch(`/api/calls/${callId}/expenses/${expenseId}/correct`, { method: 'DELETE' });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error || 'That expense could not be removed.');
      await refreshRecords();
      setExpenseMessage(`Expense #${expenseId} removed. Money and the Call Receipt were refreshed.`);
    } catch (caught) {
      setExpenseError(caught instanceof Error ? caught.message : 'That expense could not be removed.');
    } finally {
      setExpenseSaving(null);
    }
  };

  const itemizedTotal = expenses.reduce((sum, expense) => sum + expense.amount, 0);
  const unitemizedAmount = Math.max(0, (call.expenseAmount || 0) - itemizedTotal);

  return <div className="page-wrap"><div className="page-heading"><div><Link href={`/receipt/${callId}`} className="link-text"><ArrowLeft size={17}/> Back to receipt</Link><div className="eyebrow" style={{ marginTop: 22 }}>Worker-controlled correction / #{callId}</div><h1 style={{ marginTop: 10 }}>Correct the record.</h1><p className="subtitle">Fix the work record without hiding that a correction happened.</p></div><span className="badge badge-finished"><LockKeyhole size={15}/> Private</span></div>

  <div className="card card-pad" style={{ marginBottom: 22 }}><div className="eyebrow">Audit trail</div><h2 style={{ marginTop: 7 }}><ShieldCheck size={21}/> Corrections are recorded.</h2><p className="subtitle">Saving changes updates the call record and adds a private correction note naming the fields that changed. It does not erase the fact that the receipt was corrected.</p></div>

  <form className="card card-pad form-card" onSubmit={submit}>
    <div className="eyebrow">Work receipt facts</div>
    <div className="form-grid" style={{ marginTop: 18 }}>
      <Field label="Show or event" name="showName" defaultValue={call.showName} required />
      <Field label="Venue" name="venue" defaultValue={call.venue} required />
      <Field label="Venue address" name="venueAddress" defaultValue={call.venueAddress || ''} />
      <Field label="Work date" name="workDate" type="date" defaultValue={call.workDate} required />
      <Field label="Scheduled start" name="scheduledStart" type="time" defaultValue={call.scheduledStart || ''} />
      <Field label="Estimated end" name="estimatedEnd" type="time" defaultValue={call.estimatedEnd || ''} />
      <Field label="Role" name="role" defaultValue={call.role} required />
      <Field label="Department" name="department" defaultValue={call.department || ''} />
      <Field label="Employer / labor provider" name="employer" defaultValue={call.employer || ''} />
      <div className="field"><label htmlFor="payType">Pay type</label><select id="payType" name="payType" defaultValue={call.payType}><option value="hourly">Hourly</option><option value="day">Day rate</option><option value="flat">Flat</option></select></div>
      <Field label="Rate / flat amount" name="hourlyRate" type="number" min="0" step="0.01" defaultValue={String(call.hourlyRate || 0)} />
      <Field label="Minimum hours" name="minimumHours" type="number" min="0" step="0.5" defaultValue={String(call.minimumHours || 0)} />
      <Field label="Arrival" name="arrivalAt" type="datetime-local" defaultValue={toLocalInput(call.arrivalAt)} />
      <Field label="Paid start" name="actualStart" type="datetime-local" defaultValue={toLocalInput(call.actualStart)} required />
      <Field label="Actual end" name="actualEnd" type="datetime-local" defaultValue={toLocalInput(call.actualEnd)} required />
      <Field label="Break minutes" name="breakMinutes" type="number" min="0" step="1" defaultValue={String(call.breakMinutes || 0)} />
      <Field label="Mileage" name="mileage" type="number" min="0" step="0.1" defaultValue={String(call.mileage || 0)} />
      <Field label="Crew contact" name="crewContactName" defaultValue={call.crewContactName || ''} />
      <Field label="Crew contact phone" name="crewContactPhone" type="tel" defaultValue={call.crewContactPhone || ''} />
      <TextAreaField label="Crew entrance" name="crewEntrance" defaultValue={call.crewEntrance || ''} />
      <TextAreaField label="Parking instructions" name="parkingInstructions" defaultValue={call.parkingInstructions || ''} />
      <TextAreaField label="Dock / load-in info" name="loadingDockInfo" defaultValue={call.loadingDockInfo || ''} />
      <TextAreaField label="Dress requirements" name="dressRequirements" defaultValue={call.dressRequirements || ''} />
      <TextAreaField label="PPE requirements" name="ppeRequirements" defaultValue={call.ppeRequirements || ''} />
      <TextAreaField label="Tool requirements" name="toolRequirements" defaultValue={call.toolRequirements || ''} />
      <TextAreaField label="Dispatch notes" name="generalNotes" defaultValue={call.generalNotes || ''} />
      <TextAreaField label="Final closeout note" name="note" defaultValue={call.note || ''} />
    </div>

    {error && <div className="error-box" role="alert" style={{ marginTop: 18 }}><AlertCircle size={20}/> {error}</div>}
    <div className="form-actions" style={{ marginTop: 22 }}><button className="btn btn-primary" type="submit" disabled={saving}>{saving ? 'Saving correction…' : <><Save size={19}/> Save receipt facts</>}</button><Link href={`/receipt/${callId}`} className="btn btn-quiet">Cancel</Link></div>
    <div className="privacy-rule"><CheckCircle2 size={18}/> A saved correction refreshes the connected worker records before returning you to the updated Call Receipt.</div>
  </form>

  <section className="card card-pad" style={{ marginTop: 22 }}>
    <div className="eyebrow">Money corrections</div>
    <h2 style={{ marginTop: 7 }}><WalletCards size={21}/> Itemized expenses</h2>
    <p className="subtitle">Fix a typo or remove a mistaken expense. Every change adds a private correction note and updates the locked expense totals by the exact difference.</p>
    {expenseMessage && <div className="success-box" style={{ marginTop: 16 }}><CheckCircle2 size={20}/>{expenseMessage}</div>}
    {expenseError && <div className="error-box" role="alert" style={{ marginTop: 16 }}><AlertCircle size={20}/>{expenseError}</div>}
    {expenses.length === 0 ? <div className="card empty" style={{ marginTop: 18 }}><WalletCards size={24}/><h3>No itemized expenses on this receipt.</h3><p>There is nothing to correct here.</p></div> : <div className="vault-items" style={{ marginTop: 18 }}>{expenses.map((expense) => <form className="card card-pad" key={expense.id} onSubmit={(event) => correctExpense(event, expense.id)}><div className="finish-context"><div><div className="eyebrow">Expense #{expense.id}</div><h3 style={{ marginTop: 6 }}>{expense.category} · {money(expense.amount)}</h3></div><span className="badge badge-finished">itemized</span></div><div className="form-grid" style={{ marginTop: 14 }}><Field label="Amount" name="amount" type="number" min="0.01" step="0.01" defaultValue={String(expense.amount)} /><Field label="Category" name="category" defaultValue={expense.category} /><Field label="Description" name="description" defaultValue={expense.description || ''} /><Field label="Receipt filename" name="receiptAttachmentName" defaultValue={expense.receiptAttachmentName || ''} /></div><div className="form-actions" style={{ marginTop: 14 }}><button className="btn btn-secondary" type="submit" disabled={expenseSaving === expense.id}><Save size={17}/>{expenseSaving === expense.id ? 'Saving…' : 'Save expense'}</button><button className="btn btn-quiet" type="button" disabled={expenseSaving === expense.id} onClick={() => removeExpense(expense.id)}><Trash2 size={17}/> Remove mistaken expense</button></div></form>)}</div>}
    {unitemizedAmount > 0 && <div className="warning-box" role="status" style={{ marginTop: 18 }}><AlertCircle size={20}/><div><strong>{money(unitemizedAmount)} is not itemized.</strong><p>This older or imported locked amount is preserved and cannot be safely assigned to a specific expense row here.</p></div></div>}
  </section>
  </div>;
}

function Field({ label, name, defaultValue, type = 'text', required = false, min, step }: { label: string; name: string; defaultValue: string; type?: string; required?: boolean; min?: string; step?: string }) {
  return <div className="field"><label htmlFor={`${name}-${defaultValue}`}>{label}{required && ' *'}</label><input id={`${name}-${defaultValue}`} name={name} type={type} defaultValue={defaultValue} required={required} min={min} step={step}/></div>;
}

function TextAreaField({ label, name, defaultValue }: { label: string; name: string; defaultValue: string }) {
  return <div className="field"><label htmlFor={name}>{label}</label><textarea id={name} name={name} rows={2} defaultValue={defaultValue}/></div>;
}
