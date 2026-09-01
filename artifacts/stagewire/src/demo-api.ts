type DemoCall = Record<string, any>;
type DemoState = {
  calls: DemoCall[];
  profile: Record<string, any>;
  checklist: Record<number, any[]>;
  notes: Record<number, any[]>;
  expenses: Record<number, any[]>;
  nextCallId: number;
  nextItemId: number;
  nextNoteId: number;
  nextExpenseId: number;
};

const KEY = 'stagewire-demo-v14';

function seed(): DemoState {
  return {
    calls: [],
    profile: {
      id: 1,
      displayName: 'StageWire Worker',
      homeCityState: '',
      phone: '',
      email: '',
      primaryRole: 'Stagehand',
      additionalRoles: ['Pusher'],
      yearsExperience: 0,
      skills: [],
      certifications: [],
      bio: null,
      emergencyContact: null,
      profilePhotoName: null,
      privateByDefault: true,
    },
    checklist: {},
    notes: {},
    expenses: {},
    nextCallId: 1,
    nextItemId: 1,
    nextNoteId: 1,
    nextExpenseId: 1,
  };
}

function load(): DemoState {
  try {
    const saved = localStorage.getItem(KEY);
    return saved ? { ...seed(), ...JSON.parse(saved) } : seed();
  } catch {
    return seed();
  }
}

function save(state: DemoState) {
  localStorage.setItem(KEY, JSON.stringify(state));
}

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

function body(init?: RequestInit) {
  if (!init?.body || typeof init.body !== 'string') return {};
  try { return JSON.parse(init.body); } catch { return {}; }
}

function blankCall(id: number, input: Record<string, any>): DemoCall {
  return {
    id,
    venue: input.venue || '',
    venueAddress: input.venueAddress ?? null,
    showName: input.showName || '',
    workDate: input.workDate || new Date().toISOString().slice(0, 10),
    scheduledStart: input.scheduledStart ?? null,
    estimatedEnd: input.estimatedEnd ?? null,
    role: input.role || 'Stagehand',
    department: input.department ?? null,
    employer: input.employer ?? null,
    crewContactName: input.crewContactName ?? null,
    crewContactPhone: input.crewContactPhone ?? null,
    parkingInstructions: input.parkingInstructions ?? null,
    crewEntrance: input.crewEntrance ?? null,
    loadingDockInfo: input.loadingDockInfo ?? null,
    dressRequirements: input.dressRequirements ?? null,
    ppeRequirements: input.ppeRequirements ?? null,
    toolRequirements: input.toolRequirements ?? null,
    generalNotes: input.generalNotes ?? null,
    payType: input.payType || 'hourly',
    minimumHours: Number(input.minimumHours || 0),
    status: 'upcoming',
    arrivalAt: null,
    actualStart: null,
    actualEnd: null,
    breakMinutes: 0,
    hourlyRate: Number(input.hourlyRate || 0),
    expenseAmount: 0,
    mileage: 0,
    parkingExpense: 0,
    tollExpense: 0,
    expenseDescription: null,
    note: null,
    receiptAttachmentName: null,
    workPhotoName: null,
    overtimeHours: 0,
    doubleTimeHours: 0,
    mealPenaltyAmount: 0,
    completedAt: null,
    hours: 0,
    gross: 0,
  };
}

function defaultChecklist(callId: number, role: string, state: DemoState) {
  const labels = ['Work gloves', 'Crescent wrench', 'Flashlight / headlamp', 'Hard hat', 'Water', 'ID / credentials'];
  if (role === 'Pusher') labels.push('Crew contact saved', 'Truck / dock details reviewed');
  return labels.map((label, index) => ({
    id: state.nextItemId++, callId, label, checked: false,
    isCustom: false, isSuggested: index >= 6, sortOrder: index,
    createdAt: new Date().toISOString(),
  }));
}

function dashboard(state: DemoState) {
  const finished = state.calls.filter((c) => c.status === 'finished');
  const currentMonth = new Date().toISOString().slice(0, 7);
  const finishedThisMonth = finished.filter((c) => String(c.workDate || '').slice(0, 7) === currentMonth);
  const upcoming = state.calls.filter((c) => c.status === 'upcoming').sort((a, b) => `${a.workDate} ${a.scheduledStart || ''}`.localeCompare(`${b.workDate} ${b.scheduledStart || ''}`));
  const active = state.calls.filter((c) => c.status === 'arrived' || c.status === 'active').sort((a, b) => String(b.arrivalAt || b.createdAt || '').localeCompare(String(a.arrivalAt || a.createdAt || '')));
  return {
    upcomingCount: upcoming.length,
    completedCount: finished.length,
    hoursThisMonth: finishedThisMonth.reduce((sum, c) => sum + Number(c.hours || 0), 0),
    grossThisMonth: finishedThisMonth.reduce((sum, c) => sum + Number(c.gross || 0), 0),
    upcomingCall: upcoming[0] || null,
    activeCall: active[0] || null,
  };
}

function passport(state: DemoState) {
  const finished = state.calls.filter((c) => c.status === 'finished');
  const byRole = new Map<string, { role: string; calls: number; hours: number }>();
  for (const call of finished) {
    const row = byRole.get(call.role) || { role: call.role, calls: 0, hours: 0 };
    row.calls += 1; row.hours += Number(call.hours || 0); byRole.set(call.role, row);
  }
  return {
    workerName: state.profile.displayName,
    primaryRole: state.profile.primaryRole,
    additionalRoles: state.profile.additionalRoles,
    completedCallCount: finished.length,
    experience: Array.from(byRole.values()),
    skills: state.profile.skills,
    certifications: state.profile.certifications,
    privateByDefault: true,
  };
}

export function installDemoApi() {
  if (!import.meta.env.DEV || import.meta.env.VITE_REAL_API === 'true') return;
  const nativeFetch = window.fetch.bind(window);

  window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    const raw = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;
    const url = new URL(raw, window.location.origin);
    if (url.origin !== window.location.origin || !url.pathname.startsWith('/api/')) return nativeFetch(input, init);

    const method = String(init?.method || (input instanceof Request ? input.method : 'GET')).toUpperCase();
    const state = load();

    if (url.pathname === '/api/healthz') return json({ status: 'ok' });
    if (url.pathname === '/api/profile') {
      if (method === 'PUT') { state.profile = { ...state.profile, ...body(init), id: 1, privateByDefault: true }; save(state); }
      return json(state.profile);
    }
    if (url.pathname === '/api/dashboard') return json(dashboard(state));
    if (url.pathname === '/api/vault') {
      const finished = state.calls.filter((c) => c.status === 'finished');
      return json({ calls: finished, certifications: state.profile.certifications, skills: state.profile.skills, documents: finished.filter((c) => c.receiptAttachmentName).map((c) => ({ name: c.receiptAttachmentName, kind: 'document', callId: c.id })), photos: finished.filter((c) => c.workPhotoName).map((c) => ({ name: c.workPhotoName, kind: 'photo', callId: c.id })) });
    }
    if (url.pathname === '/api/passport') return json(passport(state));

    if (url.pathname === '/api/calls' && method === 'GET') return json(state.calls);
    if (url.pathname === '/api/calls' && method === 'POST') {
      const inputData = body(init);
      const call = blankCall(state.nextCallId++, inputData);
      state.calls.push(call);
      state.checklist[call.id] = defaultChecklist(call.id, call.role, state);
      state.notes[call.id] = [];
      state.expenses[call.id] = [];
      save(state);
      return json(call, 201);
    }

    const match = url.pathname.match(/^\/api\/calls\/(\d+)(?:\/(.*))?$/);
    if (!match) return json({ error: 'Demo route not found' }, 404);
    const id = Number(match[1]);
    const tail = match[2] || '';
    const call = state.calls.find((c) => c.id === id);
    if (!call) return json({ error: 'Call not found' }, 404);

    if (!tail && method === 'GET') return json(call);
    if (tail === 'workday' && method === 'GET') return json({ call, checklist: { items: state.checklist[id] || [] }, notes: state.notes[id] || [], expenses: state.expenses[id] || [] });
    if (tail === 'arrive' && method === 'POST') { Object.assign(call, body(init), { status: 'arrived' }); save(state); return json(call); }
    if (tail === 'start' && method === 'POST') { Object.assign(call, body(init), { status: 'active' }); save(state); return json(call); }
    if (tail === 'notes' && method === 'POST') {
      const data = body(init); const note = { id: state.nextNoteId++, callId: id, text: data.text, category: data.category ?? null, createdAt: new Date().toISOString() };
      (state.notes[id] ||= []).push(note); save(state); return json(note, 201);
    }
    if (tail === 'expenses' && method === 'POST') {
      const data = body(init); const amount = Number(data.amount || 0); const category = String(data.category || 'Other');
      const expense = { id: state.nextExpenseId++, callId: id, amount, category, description: data.description ?? null, receiptAttachmentName: data.receiptAttachmentName ?? null, createdAt: new Date().toISOString() };
      (state.expenses[id] ||= []).push(expense);
      call.expenseAmount = Number((Number(call.expenseAmount || 0) + amount).toFixed(2));
      if (category.toLowerCase() === 'parking') call.parkingExpense = Number((Number(call.parkingExpense || 0) + amount).toFixed(2));
      if (category.toLowerCase() === 'toll' || category.toLowerCase() === 'tolls') call.tollExpense = Number((Number(call.tollExpense || 0) + amount).toFixed(2));
      save(state); return json(expense, 201);
    }
    if (tail === 'checklist/items' && method === 'POST') {
      const data = body(init); const item = { id: state.nextItemId++, callId: id, label: data.label, checked: false, isCustom: true, isSuggested: false, sortOrder: (state.checklist[id] || []).length, createdAt: new Date().toISOString() };
      (state.checklist[id] ||= []).push(item); save(state); return json(item, 201);
    }
    const itemMatch = tail.match(/^checklist\/items\/(\d+)$/);
    if (itemMatch && method === 'PATCH') {
      const item = (state.checklist[id] || []).find((x) => x.id === Number(itemMatch[1]));
      if (!item) return json({ error: 'Checklist item not found' }, 404);
      Object.assign(item, body(init)); save(state); return json(item);
    }
    if (tail === 'finish' && method === 'POST') {
      const data = body(init);
      const additionalAmount = Number(data.additionalExpenseAmount || data.expenseAmount || 0);
      const parkingExpense = Number(data.parkingExpense || 0);
      const tollExpense = Number(data.tollExpense || 0);
      if (additionalAmount > 0) {
        (state.expenses[id] ||= []).push({ id: state.nextExpenseId++, callId: id, amount: additionalAmount, category: data.additionalExpenseCategory || 'Other', description: data.additionalExpenseDescription ?? data.expenseDescription ?? null, receiptAttachmentName: data.receiptAttachmentName ?? null, createdAt: new Date().toISOString() });
      }
      if (parkingExpense > 0) {
        (state.expenses[id] ||= []).push({ id: state.nextExpenseId++, callId: id, amount: parkingExpense, category: 'Parking', description: 'Added while finishing the call', receiptAttachmentName: null, createdAt: new Date().toISOString() });
      }
      if (tollExpense > 0) {
        (state.expenses[id] ||= []).push({ id: state.nextExpenseId++, callId: id, amount: tollExpense, category: 'Toll', description: 'Added while finishing the call', receiptAttachmentName: null, createdAt: new Date().toISOString() });
      }
      Object.assign(call, data, { status: 'finished', completedAt: new Date().toISOString() });
      call.expenseAmount = Number((Number(call.expenseAmount || 0) + additionalAmount + parkingExpense + tollExpense).toFixed(2));
      call.parkingExpense = Number((Number(call.parkingExpense || 0) + parkingExpense).toFixed(2));
      call.tollExpense = Number((Number(call.tollExpense || 0) + tollExpense).toFixed(2));
      const start = new Date(call.actualStart || data.actualStart).getTime();
      const end = new Date(call.actualEnd || data.actualEnd).getTime();
      const hours = Math.max(0, (end - start) / 3600000 - Number(call.breakMinutes || 0) / 60);
      call.hours = Number(hours.toFixed(2));
      call.gross = Number((call.hours * Number(call.hourlyRate || 0)).toFixed(2));
      save(state); return json(call);
    }

    return json({ error: 'Demo route not found' }, 404);
  };
}
