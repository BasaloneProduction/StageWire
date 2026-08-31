import { useMemo, useState, type FormEvent } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Check, Clock3, MapPin, NotebookPen, Plus, ReceiptText, WalletCards } from 'lucide-react';
import { Link, useParams } from 'wouter';
import {
  getGetCallWorkdayQueryKey,
  useAddCallExpense,
  useAddCallNote,
  useAddChecklistItem,
  useArriveAtCall,
  useGetCallWorkday,
  useStartCallWork,
  useUpdateChecklistItem,
} from '@workspace/api-client-react';

function localDateTime() {
  const now = new Date();
  const local = new Date(now.getTime() - now.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 16);
}

function timeOnly(value?: string | null) {
  if (!value) return 'Not recorded';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : new Intl.DateTimeFormat('en-US', { hour: 'numeric', minute: '2-digit' }).format(date);
}

export default function ActiveCallPage() {
  const { id } = useParams<{ id: string }>();
  const callId = Number(id);
  const client = useQueryClient();
  const workday = useGetCallWorkday(callId);
  const arrive = useArriveAtCall();
  const start = useStartCallWork();
  const updateItem = useUpdateChecklistItem();
  const addItem = useAddChecklistItem();
  const addNote = useAddCallNote();
  const addExpense = useAddCallExpense();
  const [now, setNow] = useState(localDateTime());

  const refresh = () => client.invalidateQueries({ queryKey: getGetCallWorkdayQueryKey(callId) });
  const data = workday.data;
  const call = data?.call;
  const checked = useMemo(() => data?.checklist.items.filter((item) => item.checked).length ?? 0, [data]);
  const total = data?.checklist.items.length ?? 0;
  const expenseTotal = useMemo(() => data?.expenses.reduce((sum, item) => sum + item.amount, 0) ?? 0, [data]);

  if (!Number.isFinite(callId) || callId <= 0) return <div className="page-wrap"><div className="error-box"><strong>Invalid call.</strong></div></div>;
  if (workday.isLoading) return <div className="page-wrap"><div className="card card-pad"><h2>Loading active call…</h2></div></div>;
  if (workday.isError || !data || !call) return <div className="page-wrap"><div className="error-box"><strong>Could not open this workday.</strong><button className="btn btn-quiet" onClick={() => workday.refetch()}>Try again</button></div></div>;

  const recordArrival = () => arrive.mutate({ id: callId, data: { arrivalAt: new Date(now).toISOString() } }, { onSuccess: refresh });
  const recordStart = () => start.mutate({ id: callId, data: { actualStart: new Date(now).toISOString() } }, { onSuccess: refresh });

  const submitNote = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const text = String(form.get('note') || '').trim();
    if (!text) return;
    addNote.mutate({ id: callId, data: { text, category: 'workday' } }, { onSuccess: () => { event.currentTarget.reset(); refresh(); } });
  };

  const submitExpense = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const amount = Number(form.get('amount') || 0);
    if (amount <= 0) return;
    addExpense.mutate({ id: callId, data: { amount, category: String(form.get('category') || 'Other'), description: String(form.get('description') || '') || null } }, { onSuccess: () => { event.currentTarget.reset(); refresh(); } });
  };

  const submitChecklist = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const label = String(form.get('label') || '').trim();
    if (!label) return;
    addItem.mutate({ id: callId, data: { label } }, { onSuccess: () => { event.currentTarget.reset(); refresh(); } });
  };

  const finishHref = `/finish?call=${call.id}`;

  return (
    <div className="page-wrap active-call-page">
      <div className="page-heading"><div><div className="eyebrow">Live workday / {call.status}</div><h1 style={{ marginTop: 10 }}>{call.showName}</h1><p className="subtitle"><MapPin size={18} style={{ verticalAlign: '-3px' }} /> {call.venue} · {call.role}</p></div><Link href={finishHref} className="btn btn-primary" data-testid="button-active-finish"><ReceiptText size={20} /> Finish call</Link></div>
      <section className="card card-pad" style={{ marginBottom: 22 }}><div className="eyebrow">Workday clock</div><div className="stats-grid" style={{ marginTop: 16 }}><div className="card stat-card"><span className="stat-label">Arrival</span><strong className="stat-value" style={{ fontSize: '1.45rem' }}>{timeOnly(call.arrivalAt)}</strong></div><div className="card stat-card"><span className="stat-label">Paid start</span><strong className="stat-value" style={{ fontSize: '1.45rem' }}>{timeOnly(call.actualStart)}</strong></div><div className="card stat-card"><span className="stat-label">Checklist</span><strong className="stat-value" style={{ fontSize: '1.45rem' }}>{checked}/{total}</strong></div><div className="card stat-card"><span className="stat-label">Expenses</span><strong className="stat-value" style={{ fontSize: '1.45rem' }}>${expenseTotal.toFixed(2)}</strong></div></div><div className="form-actions" style={{ marginTop: 18 }}><input type="datetime-local" value={now} onChange={(e) => setNow(e.target.value)} aria-label="Workday timestamp" />{!call.arrivalAt && <button className="btn btn-primary" onClick={recordArrival} disabled={arrive.isPending}><MapPin size={20} /> I’m here</button>}{call.arrivalAt && !call.actualStart && <button className="btn btn-primary" onClick={recordStart} disabled={start.isPending}><Clock3 size={20} /> Start paid work</button>}{call.actualStart && <span className="badge badge-active"><Check size={16} /> Work clock started</span>}</div></section>
      <div className="passport-grid">
        <section className="card card-pad"><div className="eyebrow">Call checklist</div><h2 style={{ marginTop: 8 }}>What needs doing</h2><div className="experience-list" style={{ marginTop: 18 }}>{data.checklist.items.map((item) => <label className="experience-row" key={item.id} style={{ cursor: 'pointer' }}><span><b>{item.label}</b><small>{item.isSuggested ? 'Suggested for this role' : item.isCustom ? 'Your item' : 'Call item'}</small></span><input type="checkbox" checked={item.checked} onChange={(e) => updateItem.mutate({ id: callId, itemId: item.id, data: { checked: e.target.checked } }, { onSuccess: refresh })} style={{ width: 28, height: 28 }} /></label>)}</div><form onSubmit={submitChecklist} className="form-actions" style={{ marginTop: 18 }}><input name="label" placeholder="Add a checklist item" /><button className="btn btn-secondary" type="submit"><Plus size={18} /> Add</button></form></section>
        <section className="card card-pad"><div className="eyebrow">Quick note</div><h2 style={{ marginTop: 8 }}>Remember it now</h2><form onSubmit={submitNote} style={{ marginTop: 18 }}><div className="field"><textarea name="note" placeholder="Crew change, problem, instruction, anything worth remembering…" /></div><div className="form-actions"><button className="btn btn-secondary" type="submit"><NotebookPen size={18} /> Save note</button></div></form><div className="vault-items">{data.notes.slice(-4).reverse().map((note) => <div className="vault-item" key={note.id}><span>{note.text}</span><span>{timeOnly(note.createdAt)}</span></div>)}</div></section>
        <section className="card card-pad"><div className="eyebrow">Expense</div><h2 style={{ marginTop: 8 }}>Log it once</h2><form onSubmit={submitExpense} style={{ marginTop: 18 }}><div className="form-grid"><div className="field"><label>Amount</label><input name="amount" type="number" min="0.01" step="0.01" placeholder="0.00" /></div><div className="field"><label>Category</label><select name="category" defaultValue="Parking"><option>Parking</option><option>Tolls</option><option>Mileage</option><option>Meals</option><option>Supplies</option><option>Other</option></select></div><div className="field full"><label>Description</label><input name="description" placeholder="Optional detail" /></div></div><div className="form-actions"><button className="btn btn-secondary" type="submit"><WalletCards size={18} /> Add expense</button></div></form></section>
        <section className="card card-pad"><div className="eyebrow">Call info</div><h2 style={{ marginTop: 8 }}>Need-to-know</h2><div className="receipt-grid" style={{ marginTop: 18 }}><div><div className="receipt-label">Crew entrance</div><div className="receipt-value">{call.crewEntrance || 'Not listed'}</div></div><div><div className="receipt-label">Parking</div><div className="receipt-value">{call.parkingInstructions || 'Not listed'}</div></div><div><div className="receipt-label">PPE</div><div className="receipt-value">{call.ppeRequirements || 'Not listed'}</div></div><div><div className="receipt-label">Tools</div><div className="receipt-value">{call.toolRequirements || 'Not listed'}</div></div><div><div className="receipt-label">Crew contact</div><div className="receipt-value">{call.crewContactName || 'Not listed'} {call.crewContactPhone || ''}</div></div><div><div className="receipt-label">Dock</div><div className="receipt-value">{call.loadingDockInfo || 'Not listed'}</div></div></div></section>
      </div>
      <div className="card card-pad" style={{ marginTop: 22, textAlign: 'center' }}><h2>When the work is done, close it out once.</h2><p className="subtitle" style={{ margin: '10px auto 18px' }}>Paid start, notes, and expenses already logged here will follow you into closeout. Only add what changed.</p><Link href={finishHref} className="btn btn-primary" data-testid="button-active-finish-bottom" style={{ minHeight: 58, fontSize: '1.08rem' }}><ReceiptText size={22} /> Finish call</Link></div>
    </div>
  );
}
