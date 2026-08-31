import { useMemo, useState, type FormEvent } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { AlertCircle, ArrowLeft, CheckCircle2, Clock3, MapPin, ReceiptText } from 'lucide-react';
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

export default function SmartFinishCallPage() {
  const { id } = useParams<{ id: string }>();
  const callId = Number(id);
  const client = useQueryClient();
  const [, setLocation] = useLocation();
  const workday = useGetCallWorkday(callId, { query: { enabled: Number.isFinite(callId) && callId > 0 } });
  const finish = useFinishCall();
  const [done, setDone] = useState(false);

  const data = workday.data;
  const call = data?.call;
  const expenseTotal = useMemo(() => data?.expenses.reduce((sum, item) => sum + item.amount, 0) ?? 0, [data]);
  const notes = data?.notes ?? [];

  if (workday.isLoading) return <div className="page-wrap"><div className="card card-pad"><h2>Loading closeout…</h2></div></div>;
  if (workday.isError || !data || !call) return <div className="page-wrap"><div className="error-box"><AlertCircle size={20} /><strong>Could not load this call for closeout.</strong><button className="btn btn-quiet" onClick={() => workday.refetch()}>Try again</button></div></div>;
  if (done) return <div className="page-wrap"><div className="success-box"><CheckCircle2 size={24} /><div><strong>Call finished.</strong><p>Receipt created and workday locked into your record.</p></div></div></div>;

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const actualStartValue = String(form.get('actualStart') || '');
    const actualEndValue = String(form.get('actualEnd') || '');
    const additionalExpenseAmount = Number(form.get('additionalExpenseAmount') || 0);
    const payload: FinishCallInput = {
      actualStart: new Date(actualStartValue).toISOString(),
      actualEnd: new Date(actualEndValue).toISOString(),
      breakMinutes: Number(form.get('breakMinutes') || 0),
      role: String(form.get('role') || call.role),
      arrivalAt: call.arrivalAt,
      additionalExpenseAmount,
      additionalExpenseCategory: String(form.get('additionalExpenseCategory') || 'Other'),
      additionalExpenseDescription: String(form.get('additionalExpenseDescription') || '') || null,
      mileage: Number(form.get('mileage') || call.mileage || 0),
      parkingExpense: Number(form.get('parkingExpense') || 0),
      tollExpense: Number(form.get('tollExpense') || 0),
      note: String(form.get('finalNote') || '') || null,
      receiptAttachmentName: String(form.get('receiptAttachmentName') || '') || null,
      workPhotoName: String(form.get('workPhotoName') || '') || null,
    };

    finish.mutate({ id: callId, data: payload }, {
      onSuccess: (result) => {
        client.invalidateQueries({ queryKey: getListCallsQueryKey() });
        client.invalidateQueries({ queryKey: getGetDashboardQueryKey() });
        client.invalidateQueries({ queryKey: getGetVaultQueryKey() });
        client.invalidateQueries({ queryKey: getGetPassportQueryKey() });
        client.setQueryData(getGetCallQueryKey(callId), result);
        sessionStorage.removeItem(`stagewire-finish-${callId}`);
        setDone(true);
        window.setTimeout(() => setLocation(`/receipt/${result.id}`), 700);
      },
    });
  };

  return (
    <div className="page-wrap">
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
          <div><span className="eyebrow">Closing out</span><h2 style={{ marginTop: 6 }}>{call.showName}</h2><p className="call-meta"><MapPin size={15} style={{ verticalAlign: '-2px' }} /> {call.venue} · {call.role}</p></div>
          <span className={`badge badge-${call.status}`}>{call.status}</span>
        </div>
        <div className="stats-grid" style={{ marginTop: 18 }}>
          <div className="card stat-card"><span className="stat-label">Paid start</span><strong className="stat-value" style={{ fontSize: '1.3rem' }}>{call.actualStart ? new Date(call.actualStart).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }) : 'Not started'}</strong></div>
          <div className="card stat-card"><span className="stat-label">Logged expenses</span><strong className="stat-value" style={{ fontSize: '1.3rem' }}>{money(expenseTotal)}</strong></div>
          <div className="card stat-card"><span className="stat-label">Saved notes</span><strong className="stat-value" style={{ fontSize: '1.3rem' }}>{notes.length}</strong></div>
          <div className="card stat-card"><span className="stat-label">Checklist</span><strong className="stat-value" style={{ fontSize: '1.3rem' }}>{data.checklist.items.filter((item) => item.checked).length}/{data.checklist.items.length}</strong></div>
        </div>
      </div>

      <form className="card card-pad form-card" onSubmit={submit}>
        <div className="eyebrow">Confirm the closeout</div>
        <div className="form-grid" style={{ marginTop: 18 }}>
          <div className="field"><label htmlFor="actualStart">Paid start</label><input id="actualStart" name="actualStart" type="datetime-local" required defaultValue={toLocalInput(call.actualStart)} /><span className="help-text">Already carried from Active Call.</span></div>
          <div className="field"><label htmlFor="actualEnd">Actual end</label><input id="actualEnd" name="actualEnd" type="datetime-local" required defaultValue={localDateTime()} /></div>
          <div className="field"><label htmlFor="breakMinutes">Break minutes</label><input id="breakMinutes" name="breakMinutes" type="number" min="0" step="1" defaultValue={call.breakMinutes || 0} /></div>
          <div className="field"><label htmlFor="role">Final role check</label><input id="role" name="role" defaultValue={call.role} required /></div>
          <div className="field"><label htmlFor="mileage">Mileage</label><input id="mileage" name="mileage" type="number" min="0" step="0.1" defaultValue={call.mileage || 0} /></div>
          <div className="field"><label htmlFor="parkingExpense">Last-minute parking</label><input id="parkingExpense" name="parkingExpense" type="number" min="0" step="0.01" defaultValue="0" /></div>
          <div className="field"><label htmlFor="tollExpense">Last-minute toll</label><input id="tollExpense" name="tollExpense" type="number" min="0" step="0.01" defaultValue="0" /></div>
          <div className="field"><label htmlFor="additionalExpenseAmount">Other last expense</label><input id="additionalExpenseAmount" name="additionalExpenseAmount" type="number" min="0" step="0.01" defaultValue="0" /></div>
          <div className="field"><label htmlFor="additionalExpenseCategory">Expense category</label><select id="additionalExpenseCategory" name="additionalExpenseCategory" defaultValue="Other"><option>Other</option><option>Meal</option><option>Transportation</option><option>Supplies</option><option>Lodging</option></select></div>
          <div className="field"><label htmlFor="additionalExpenseDescription">Expense detail</label><input id="additionalExpenseDescription" name="additionalExpenseDescription" placeholder="Only if you added an expense" /></div>
          <div className="field full"><label htmlFor="finalNote">Final note</label><textarea id="finalNote" name="finalNote" placeholder="Optional closeout note. Your earlier workday notes are already saved." /></div>
          <div className="field"><label htmlFor="receiptAttachmentName">Receipt attachment</label><input id="receiptAttachmentName" name="receiptAttachmentName" placeholder="Optional filename for now" /></div>
          <div className="field"><label htmlFor="workPhotoName">Work photo</label><input id="workPhotoName" name="workPhotoName" placeholder="Optional filename for now" /></div>
        </div>

        {notes.length > 0 && <div className="card" style={{ marginTop: 22, padding: 18 }}><div className="eyebrow">Already saved today</div><div className="vault-items" style={{ marginTop: 12 }}>{notes.slice(-5).reverse().map((note) => <div className="vault-item" key={note.id}><span>{note.text}</span><span>saved</span></div>)}</div></div>}

        {finish.error && <div className="error-box" role="alert" style={{ marginTop: 20 }}><AlertCircle size={20} /> {(finish.error as Error).message || 'This call could not be finished.'}</div>}

        <div className="form-actions" style={{ marginTop: 24 }}>
          <button className="btn btn-primary" type="submit" disabled={finish.isPending || !call.actualStart} style={{ minHeight: 58, fontSize: '1.08rem' }}>
            {finish.isPending ? 'Locking receipt…' : <><ReceiptText size={21} /> Finish & lock receipt</>}
          </button>
          <Link href={`/workday/${call.id}`} className="btn btn-quiet">Back to active call</Link>
        </div>

        {!call.actualStart && <div className="error-box" role="alert" style={{ marginTop: 18 }}><Clock3 size={20} /> Start paid work before finishing this call.</div>}
      </form>
    </div>
  );
}
