import { useMemo, useState, type FormEvent } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Check, CheckCheck, HardHat, Plus, RotateCcw, Trash2, Upload, Wrench } from 'lucide-react';
import { Link } from 'wouter';
import {
  getGetCrewKitStateQueryKey,
  useGetCrewKitState,
  useUpdateCrewKitState,
  type CrewKitCustomItem,
  type CrewKitState,
} from '@workspace/api-client-react';

type Item = { id: string; label: string };

const roleKits: Record<string, Item[]> = {
  Stagehand: [
    { id: 'gloves', label: 'Work gloves' },
    { id: 'boots', label: 'Work boots' },
    { id: 'knife', label: 'Utility knife / multitool' },
    { id: 'light', label: 'Flashlight / headlamp' },
    { id: 'water', label: 'Water' },
    { id: 'sharpie', label: 'Sharpie' },
  ],
  Rigger: [
    { id: 'helmet', label: 'Approved helmet' },
    { id: 'harness', label: 'Harness' },
    { id: 'lanyard', label: 'Approved positioning / fall gear' },
    { id: 'gloves', label: 'Work gloves' },
    { id: 'boots', label: 'Work boots' },
    { id: 'light', label: 'Headlamp' },
  ],
  'Up Rigger': [
    { id: 'helmet', label: 'Approved helmet' },
    { id: 'harness', label: 'Inspected harness' },
    { id: 'fall-gear', label: 'Approved fall-protection / positioning gear' },
    { id: 'rescue', label: 'Confirm site rescue plan and assigned rescue gear' },
    { id: 'gloves', label: 'Work gloves' },
    { id: 'boots', label: 'Work boots' },
    { id: 'light', label: 'Headlamp with fresh batteries' },
    { id: 'radio', label: 'Radio / communication method if issued' },
  ],
  'Down Rigger': [
    { id: 'helmet', label: 'Approved helmet' },
    { id: 'gloves', label: 'Work gloves' },
    { id: 'boots', label: 'Work boots' },
    { id: 'light', label: 'Flashlight / headlamp' },
    { id: 'wrench', label: 'Adjustable wrench / approved hand tools' },
    { id: 'radio', label: 'Radio / communication method if issued' },
    { id: 'motor-check', label: 'Confirm motor, cable and control assignment' },
  ],
  Pusher: [
    { id: 'gloves', label: 'Work gloves' },
    { id: 'boots', label: 'Work boots' },
    { id: 'radio', label: 'Radio if issued' },
    { id: 'light', label: 'Flashlight / headlamp' },
    { id: 'multi', label: 'Multitool / adjustable wrench if personally carried' },
    { id: 'water', label: 'Water' },
    { id: 'sharpie', label: 'Sharpie' },
  ],
  Audio: [
    { id: 'gloves', label: 'Work gloves' },
    { id: 'boots', label: 'Work boots' },
    { id: 'light', label: 'Flashlight' },
    { id: 'tester', label: 'Cable tester if personally carried' },
    { id: 'sharpie', label: 'Sharpie' },
  ],
  Lighting: [
    { id: 'gloves', label: 'Work gloves' },
    { id: 'boots', label: 'Work boots' },
    { id: 'light', label: 'Flashlight' },
    { id: 'wrench', label: 'Adjustable wrench' },
    { id: 'sharpie', label: 'Sharpie' },
  ],
  Video: [
    { id: 'gloves', label: 'Work gloves' },
    { id: 'boots', label: 'Work boots' },
    { id: 'light', label: 'Flashlight' },
    { id: 'sharpie', label: 'Sharpie' },
  ],
  Carpentry: [
    { id: 'gloves', label: 'Work gloves' },
    { id: 'boots', label: 'Work boots' },
    { id: 'eye', label: 'Eye protection' },
    { id: 'measure', label: 'Tape measure' },
    { id: 'pencil', label: 'Pencil / marker' },
  ],
  'Forklift / Aerial Lift Operator': [
    { id: 'boots', label: 'Work boots' },
    { id: 'vest', label: 'High-visibility vest if required' },
    { id: 'helmet', label: 'Approved helmet if required' },
    { id: 'authorization', label: 'Confirm current site / employer authorization' },
    { id: 'inspection', label: 'Complete the assigned pre-use inspection' },
    { id: 'spotter', label: 'Confirm spotter and communication plan' },
  ],
  'Show Crew / Deck': [
    { id: 'gloves', label: 'Work gloves' },
    { id: 'boots', label: 'Quiet work shoes / boots required by the call' },
    { id: 'black', label: 'Show blacks / dress requirement' },
    { id: 'light', label: 'Low-light flashlight with safe color/filter if required' },
    { id: 'radio', label: 'Radio / headset if issued' },
    { id: 'running', label: 'Review running order, cues and assigned track' },
  ],
};

const LEGACY_READY_KEY = 'stagewire-crew-kit-v14';
const LEGACY_CUSTOM_KEY = 'stagewire-crew-kit-custom-v14';

function readLegacyState(): CrewKitState {
  let readyMarks: string[] = [];
  let customItems: CrewKitCustomItem[] = [];
  try {
    const raw = JSON.parse(localStorage.getItem(LEGACY_READY_KEY) || '{}') as Record<string, boolean>;
    readyMarks = Object.entries(raw)
      .filter(([, ready]) => ready)
      .map(([key]) => key.trim())
      .filter((key) => key.length > 0 && key.length <= 220)
      .slice(0, 500);
  } catch {}
  try {
    const raw = JSON.parse(localStorage.getItem(LEGACY_CUSTOM_KEY) || '{}') as Record<string, Item[]>;
    const seen = new Set<string>();
    customItems = Object.entries(raw).flatMap(([role, items]) => {
      if (!Array.isArray(items)) return [];
      return items.flatMap((item) => {
        const id = String(item?.id || '').trim();
        const label = String(item?.label || '').trim();
        const cleanRole = role.trim();
        if (!id || !label || !cleanRole || id.length > 100 || label.length > 160 || cleanRole.length > 80 || seen.has(id)) return [];
        seen.add(id);
        return [{ id, role: cleanRole, label }];
      });
    }).slice(0, 200);
  } catch {}
  return { customItems, readyMarks };
}

function kitRole(requested: string) {
  const value = requested.trim().toLowerCase();
  const exact = Object.keys(roleKits).find((role) => role.toLowerCase() === value);
  if (exact) return exact;
  if (value.includes('up rigger')) return 'Up Rigger';
  if (value.includes('down rigger')) return 'Down Rigger';
  if (value.includes('rigger')) return 'Rigger';
  if (value.includes('pusher')) return 'Pusher';
  if (value.includes('forklift') || value.includes('aerial') || value.includes('lift operator')) return 'Forklift / Aerial Lift Operator';
  if (value.includes('show crew') || value.includes('deck')) return 'Show Crew / Deck';
  if (value.includes('audio') || value.includes('sound')) return 'Audio';
  if (value.includes('light') || value === 'lx') return 'Lighting';
  if (value.includes('video') || value.includes('led')) return 'Video';
  if (value.includes('carp')) return 'Carpentry';
  return 'Stagehand';
}

function params() {
  const query = new URLSearchParams(window.location.search);
  const requested = query.get('role') || '';
  return { requestedRole: requested, role: kitRole(requested), callId: query.get('callId') || '' };
}

export default function CrewKitPage() {
  const initial = params();
  const [role, setRole] = useState(initial.role);
  const [legacy, setLegacy] = useState(readLegacyState);
  const [newItem, setNewItem] = useState('');
  const [resetConfirm, setResetConfirm] = useState(false);
  const queryClient = useQueryClient();
  const crewKit = useGetCrewKitState();
  const update = useUpdateCrewKitState();
  const callId = initial.callId;
  const scope = callId ? `call-${callId}` : 'general';
  const state: CrewKitState = crewKit.data ?? { customItems: [], readyMarks: [] };
  const custom = state.customItems.filter((item) => item.role === role).map(({ id, label }) => ({ id, label }));
  const items = useMemo(() => [...(roleKits[role] || []), ...custom], [role, custom]);
  const ready = useMemo(() => new Set(state.readyMarks), [state.readyMarks]);
  const keyFor = (id: string) => `${scope}:${role}:${id}`;

  const saveState = (next: CrewKitState, afterSuccess?: () => void) => {
    if (update.isPending) return;
    const previous = state;
    queryClient.setQueryData(getGetCrewKitStateQueryKey(), next);
    update.mutate({ data: next }, {
      onSuccess: (saved) => {
        queryClient.setQueryData(getGetCrewKitStateQueryKey(), saved);
        afterSuccess?.();
      },
      onError: () => queryClient.setQueryData(getGetCrewKitStateQueryKey(), previous),
    });
  };

  const toggle = (id: string) => {
    const next = new Set(state.readyMarks);
    const key = keyFor(id);
    if (next.has(key)) next.delete(key); else next.add(key);
    saveState({ ...state, readyMarks: [...next] });
  };

  const reset = () => {
    const removeKeys = new Set(items.map((item) => keyFor(item.id)));
    saveState({ ...state, readyMarks: state.readyMarks.filter((mark) => !removeKeys.has(mark)) });
    setResetConfirm(false);
  };

  const markAllReady = () => {
    const next = new Set(state.readyMarks);
    items.forEach((item) => next.add(keyFor(item.id)));
    saveState({ ...state, readyMarks: [...next] });
  };

  const add = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!newItem.trim()) return;
    const clean = newItem.trim().slice(0, 160);
    const id = `custom-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    saveState({ ...state, customItems: [...state.customItems, { id, role, label: clean }] }, () => setNewItem(''));
  };

  const remove = (id: string) => {
    saveState({
      customItems: state.customItems.filter((item) => item.id !== id),
      readyMarks: state.readyMarks.filter((mark) => !mark.endsWith(`:${role}:${id}`)),
    });
  };

  const importLegacy = () => {
    const ids = new Set(state.customItems.map((item) => item.id));
    const mergedCustom = [...state.customItems, ...legacy.customItems.filter((item) => !ids.has(item.id))].slice(0, 200);
    const mergedReady = Array.from(new Set([...state.readyMarks, ...legacy.readyMarks])).slice(0, 500);
    saveState({ customItems: mergedCustom, readyMarks: mergedReady }, () => {
      try {
        localStorage.removeItem(LEGACY_READY_KEY);
        localStorage.removeItem(LEGACY_CUSTOM_KEY);
      } catch {}
      setLegacy({ customItems: [], readyMarks: [] });
    });
  };

  if (crewKit.isLoading) return <div className="page-wrap"><div className="card card-pad"><h2>Opening Crew Kit…</h2></div></div>;
  if (crewKit.isError) return <div className="page-wrap"><div className="error-box"><strong>Crew Kit could not load your worker record.</strong><button className="btn btn-quiet" onClick={() => crewKit.refetch()}>Try again</button></div></div>;

  const done = items.filter((item) => ready.has(keyFor(item.id))).length;
  const missing = items.filter((item) => !ready.has(keyFor(item.id)));
  const allReady = items.length > 0 && done === items.length;
  const returnHref = callId ? `/workday/${callId}` : '/calls';
  const returnLabel = callId ? (allReady ? 'Kit ready — back to call' : 'Back to call') : 'Back to calls';
  const mappedRole = Boolean(callId && initial.requestedRole && initial.requestedRole.toLowerCase() !== role.toLowerCase());
  const hasLegacy = legacy.customItems.length > 0 || legacy.readyMarks.length > 0;

  return <div className="page-wrap">
    <div className="page-heading"><div><div className="eyebrow">Before the call{callId ? ` / call #${callId}` : ''}</div><h1 style={{ marginTop: 10 }}>Crew Kit</h1><p className="subtitle">A fast personal checklist based on the role you are walking into.</p></div><div className="form-actions"><span className={`badge ${allReady ? 'badge-active' : 'badge-finished'}`}><HardHat size={16}/> {done}/{items.length} ready</span><Link href={returnHref} className="btn btn-primary"><ArrowLeft size={18}/> {callId ? 'Back to call' : 'Back to calls'}</Link></div></div>

    {hasLegacy && <section className="card card-pad" style={{ marginBottom: 22 }}><div className="finish-context"><div><div className="eyebrow">Older browser kit found</div><h2 style={{ marginTop: 7 }}>Move your old Crew Kit into your worker record.</h2><p className="subtitle">StageWire found {legacy.customItems.length} personal item{legacy.customItems.length === 1 ? '' : 's'} and {legacy.readyMarks.length} ready mark{legacy.readyMarks.length === 1 ? '' : 's'} from the browser-only version. Import merges them without replacing newer server records.</p></div><button className="btn btn-secondary" type="button" disabled={update.isPending} onClick={importLegacy}><Upload size={18}/> {update.isPending ? 'Moving…' : 'Move browser kit'}</button></div></section>}

    {update.error && <div className="error-box" role="alert"><strong>{(update.error as Error).message || 'Crew Kit change could not be saved.'}</strong><span>Your last change was rolled back so the screen does not pretend it saved.</span></div>}

    <section className="card card-pad"><div className="field" style={{ maxWidth: 360 }}><label htmlFor="kit-role">{callId ? 'Kit category for this call' : 'Crew Kit role'}</label><select id="kit-role" value={role} disabled={Boolean(callId) || update.isPending} onChange={(event) => setRole(event.target.value)}>{Object.keys(roleKits).map((value) => <option key={value}>{value}</option>)}</select></div>{callId ? <p className="help-text" style={{ marginTop: 12 }}>{mappedRole ? `${initial.requestedRole} is using the ${role} kit. ` : ''}Ready marks are unique to this call. Your personal kit items stay with the kit category for future calls.</p> : <p className="help-text" style={{ marginTop: 12 }}>General kit mode lets you build and maintain your personal checklist for any role before a specific call is attached.</p>}

      {!allReady && missing.length > 0 && <div className="error-box" style={{ marginTop: 16 }}><HardHat size={20}/><div><strong>{missing.length} item{missing.length === 1 ? '' : 's'} still not marked ready.</strong><p>{missing.slice(0, 3).map((item) => item.label).join(' · ')}{missing.length > 3 ? ` · +${missing.length - 3} more` : ''}</p></div></div>}
      {allReady && <div className="success-box" style={{ marginTop: 16 }}><CheckCheck size={20}/> Crew Kit ready for this {callId ? 'call' : 'role'}.</div>}

      <div className="experience-list" style={{ marginTop: 20 }}>{items.map((item) => { const key = keyFor(item.id); const isCustom = item.id.startsWith('custom-'); const isReady = ready.has(key); return <div className="experience-row" key={item.id}><button type="button" disabled={update.isPending} onClick={() => toggle(item.id)} style={{ flex: 1, textAlign: 'left', background: 'none', border: 0, color: 'inherit', padding: 0 }}><span><b>{item.label}</b><small>{isReady ? 'Packed / ready' : isCustom ? 'Your saved item · tap when ready' : 'Tap when ready'}</small></span></button><span className={`badge ${isReady ? 'badge-active' : 'badge-finished'}`}>{isReady ? <><Check size={15}/> Ready</> : 'Not yet'}</span>{isCustom && <button className="icon-btn" disabled={update.isPending} aria-label={`Remove ${item.label}`} onClick={() => remove(item.id)}><Trash2 size={17}/></button>}</div>; })}</div>

      <form onSubmit={add} className="form-actions" style={{ marginTop: 18 }}><input aria-label="Personal Crew Kit item" value={newItem} maxLength={160} onChange={(event) => setNewItem(event.target.value)} placeholder="Add something you personally carry"/><button className="btn btn-secondary" type="submit" disabled={update.isPending || !newItem.trim()}><Plus size={18}/> Add my item</button></form>
      <div className="form-actions" style={{ marginTop: 14 }}>{!allReady && items.length > 0 && <button className="btn btn-secondary" disabled={update.isPending} onClick={markAllReady}><CheckCheck size={18}/> Mark all ready</button>}{resetConfirm ? <><button className="btn btn-primary" disabled={update.isPending} onClick={reset}><RotateCcw size={17}/> Confirm reset</button><button className="btn btn-quiet" type="button" onClick={() => setResetConfirm(false)}>Keep my checks</button></> : <button className="btn btn-quiet" disabled={update.isPending} onClick={() => setResetConfirm(true)}><RotateCcw size={17}/> Reset this checklist</button>}<Link href={returnHref} className="btn btn-primary"><ArrowLeft size={18}/> {returnLabel}</Link></div>
    </section>

    <section className="card card-pad" style={{ marginTop: 22 }}><div className="eyebrow">Your kit follows you</div><h2 style={{ marginTop: 7 }}>Personal items stay with the role. Ready marks stay with the call.</h2><p className="subtitle">Crew Kit now saves to the worker record instead of only this browser. When signed-in accounts are mounted, the same personal role items and call prep state can follow the worker across devices. A new call still starts with its own ready marks.</p></section>
    <section className="card card-pad" style={{ marginTop: 22 }}><div className="eyebrow">Important</div><h2 style={{ marginTop: 7 }}><Wrench size={21}/> This is a memory aid, not a safety standard.</h2><p className="subtitle">The employer, venue, union, manufacturer, competent person, and the actual job conditions determine required PPE, tools, training, inspection and procedures. StageWire should never tell a worker that checking boxes makes a hazardous task safe.</p></section>
  </div>;
}
