import { useState, type FormEvent } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { AlertCircle, ArrowLeft, CheckCircle2, Save } from 'lucide-react';
import { Link, useLocation, useParams } from 'wouter';
import {
  getGetCallWorkdayQueryKey,
  getGetDashboardQueryKey,
  getListCallsQueryKey,
  useGetCallWorkday,
} from '@workspace/api-client-react';

const CALL_ROLES = ['Stagehand', 'Up Rigger', 'Down Rigger', 'Pusher', 'Audio', 'Lighting', 'Video', 'Carpentry', 'Forklift/Aerial Lift Operator', 'Show Crew/Deck', 'Other'];

function optional(form: FormData, name: string) {
  const value = String(form.get(name) || '').trim();
  return value || null;
}

export default function EditCallPage() {
  const { id } = useParams<{ id: string }>();
  const callId = Number(id);
  const workday = useGetCallWorkday(callId);
  const client = useQueryClient();
  const [, setLocation] = useLocation();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const call = workday.data?.call;

  if (!Number.isFinite(callId) || callId <= 0) return <div className="page-wrap"><div className="error-box"><strong>Invalid call.</strong></div></div>;
  if (workday.isLoading) return <div className="page-wrap"><div className="card card-pad"><h2>Opening call details…</h2></div></div>;
  if (workday.isError || !call) return <div className="page-wrap"><div className="error-box"><strong>This call could not be opened.</strong><button className="btn btn-quiet" onClick={() => workday.refetch()}>Try again</button></div></div>;
  if (call.status === 'finished') return <div className="page-wrap"><div className="error-box"><AlertCircle size={20}/><div><strong>This call is already a locked Receipt.</strong><p>Use the audited correction flow instead of editing the finished record like an open call.</p><Link href={`/correct/${callId}`} className="btn btn-primary" style={{ marginTop: 14 }}>Correct record</Link></div></div></div>;

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    const form = new FormData(event.currentTarget);
    const payload = {
      showName: String(form.get('showName') || '').trim(),
      venue: String(form.get('venue') || '').trim(),
      venueAddress: optional(form, 'venueAddress'),
      workDate: String(form.get('workDate') || ''),
      scheduledStart: optional(form, 'scheduledStart'),
      estimatedEnd: optional(form, 'estimatedEnd'),
      role: String(form.get('role') || call.role).trim(),
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
    };
    if (!payload.showName || !payload.venue || !payload.workDate || !payload.role) {
      setError('Show, venue, work date, and role cannot be blank.');
      return;
    }

    try {
      setSaving(true);
      const response = await fetch(`/api/calls/${callId}/details`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error || 'The call details could not be saved.');
      if (!result.updated) {
        setError('Nothing changed. The call was left exactly as it was.');
        return;
      }
      await Promise.all([
        client.invalidateQueries({ queryKey: getGetCallWorkdayQueryKey(callId) }),
        client.invalidateQueries({ queryKey: getListCallsQueryKey() }),
        client.invalidateQueries({ queryKey: getGetDashboardQueryKey() }),
      ]);
      setLocation(`/workday/${callId}?updated=1`);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'The call details could not be saved.');
    } finally {
      setSaving(false);
    }
  };

  return <div className="page-wrap"><div className="page-heading"><div><Link href={`/workday/${callId}`} className="link-text"><ArrowLeft size={17}/> Back to call</Link><div className="eyebrow" style={{ marginTop: 22 }}>Open call details / #{callId}</div><h1 style={{ marginTop: 10 }}>Edit the call.</h1><p className="subtitle">Fix dispatch details before the Receipt is locked. Nothing here restarts the paid clock.</p></div><span className={`badge badge-${call.status}`}>{call.status}</span></div>

  <form className="card card-pad form-card" onSubmit={submit}>
    <div className="form-grid">
      <Field label="Show or event" name="showName" defaultValue={call.showName} required />
      <Field label="Venue" name="venue" defaultValue={call.venue} required />
      <Field label="Venue address" name="venueAddress" defaultValue={call.venueAddress || ''} />
      <Field label="Work date" name="workDate" type="date" defaultValue={call.workDate} required />
      <Field label="Scheduled start" name="scheduledStart" type="time" defaultValue={call.scheduledStart || ''} />
      <Field label="Estimated end" name="estimatedEnd" type="time" defaultValue={call.estimatedEnd || ''} />
      <div className="field"><label htmlFor="edit-role">Role *</label><input id="edit-role" name="role" list="edit-call-roles" required defaultValue={call.role} readOnly={Boolean(call.actualStart)}/><datalist id="edit-call-roles">{CALL_ROLES.map((role) => <option value={role} key={role}/>)}</datalist>{call.actualStart && <span className="help-text">Paid work has started. Use Final role check at Finish Call if the performed role changed.</span>}</div>
      <Field label="Department" name="department" defaultValue={call.department || ''} />
      <Field label="Employer / labor provider" name="employer" defaultValue={call.employer || ''} />
      <Field label="Crew contact" name="crewContactName" defaultValue={call.crewContactName || ''} />
      <Field label="Crew contact phone" name="crewContactPhone" type="tel" defaultValue={call.crewContactPhone || ''} />
      <div className="field"><label htmlFor="edit-pay-type">Pay type</label><select id="edit-pay-type" name="payType" defaultValue={call.payType}><option value="hourly">Hourly</option><option value="day">Day rate</option><option value="flat">Flat</option></select></div>
      <Field label="Rate / flat amount" name="hourlyRate" type="number" min="0" step="0.01" defaultValue={String(call.hourlyRate || 0)} />
      <Field label="Minimum hours" name="minimumHours" type="number" min="0" step="0.5" defaultValue={String(call.minimumHours || 0)} />
      <TextAreaField label="Crew entrance" name="crewEntrance" defaultValue={call.crewEntrance || ''}/>
      <TextAreaField label="Parking instructions" name="parkingInstructions" defaultValue={call.parkingInstructions || ''}/>
      <TextAreaField label="Dock / load-in info" name="loadingDockInfo" defaultValue={call.loadingDockInfo || ''}/>
      <TextAreaField label="Dress requirements" name="dressRequirements" defaultValue={call.dressRequirements || ''}/>
      <TextAreaField label="PPE requirements" name="ppeRequirements" defaultValue={call.ppeRequirements || ''}/>
      <TextAreaField label="Tool requirements" name="toolRequirements" defaultValue={call.toolRequirements || ''}/>
      <TextAreaField label="Other dispatch notes" name="generalNotes" defaultValue={call.generalNotes || ''}/>
    </div>
    {error && <div className="error-box" role="alert" style={{ marginTop: 18 }}><AlertCircle size={20}/>{error}</div>}
    <div className="form-actions" style={{ marginTop: 22 }}><button className="btn btn-primary" type="submit" disabled={saving}>{saving ? 'Saving…' : <><Save size={19}/> Save call details</>}</button><Link href={`/workday/${callId}`} className="btn btn-quiet">Cancel</Link></div>
    <div className="privacy-rule"><CheckCircle2 size={18}/> If the role changes before paid work starts, StageWire refreshes role-suggested checklist items and keeps your custom items.</div>
  </form></div>;
}

function Field({ label, name, defaultValue, type = 'text', required = false, min, step }: { label: string; name: string; defaultValue: string; type?: string; required?: boolean; min?: string; step?: string }) {
  return <div className="field"><label htmlFor={`edit-${name}`}>{label}{required && ' *'}</label><input id={`edit-${name}`} name={name} type={type} defaultValue={defaultValue} required={required} min={min} step={step}/></div>;
}

function TextAreaField({ label, name, defaultValue }: { label: string; name: string; defaultValue: string }) {
  return <div className="field"><label htmlFor={`edit-${name}`}>{label}</label><textarea id={`edit-${name}`} name={name} rows={2} defaultValue={defaultValue}/></div>;
}
