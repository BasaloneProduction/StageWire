import { Archive, Calculator, CalendarDays, LockKeyhole, ReceiptText, ShieldCheck, WalletCards } from 'lucide-react';
import { Link } from 'wouter';
import { useGetVault } from '@workspace/api-client-react';
import { useMemo, useState } from 'react';

function money(value:number){return new Intl.NumberFormat('en-US',{style:'currency',currency:'USD'}).format(value||0)}
const RESERVE_KEY='stagewire-tax-reserve-percent-v14';
function monthKey(value:string){const date=new Date(`${value}T12:00:00`);if(Number.isNaN(date.getTime()))return'';return`${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}`}
function monthLabel(key:string){const [year,month]=key.split('-').map(Number);if(!year||!month)return key;return new Intl.DateTimeFormat('en-US',{month:'long',year:'numeric'}).format(new Date(year,month-1,1))}

export default function MoneyCenterPage(){
  const vault=useGetVault();
  const data=vault.data;
  const[reservePercent,setReservePercent]=useState(()=>{const saved=Number(localStorage.getItem(RESERVE_KEY));return saved>=0&&saved<=100?saved:25});
  const[currentMonth,setCurrentMonth]=useState(()=>{const now=new Date();return`${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}`});
  if(vault.isLoading)return <div className="page-wrap"><div className="card card-pad"><h2>Opening Money…</h2></div></div>;
  if(vault.isError||!data)return <div className="page-wrap"><div className="error-box"><strong>Money could not be opened.</strong><button className="btn btn-quiet" onClick={()=>vault.refetch()}>Try again</button></div></div>;

  const monthOptions=Array.from(new Set(data.calls.map(call=>monthKey(call.workDate)).filter(Boolean))).sort().reverse();
  const monthCalls=useMemo(()=>data.calls.filter(call=>monthKey(call.workDate)===currentMonth),[data.calls,currentMonth]);
  const gross=data.calls.reduce((sum,call)=>sum+call.gross,0);
  const hours=data.calls.reduce((sum,call)=>sum+call.hours,0);
  const mileage=data.calls.reduce((sum,call)=>sum+(call.mileage||0),0);
  const expenses=data.calls.reduce((sum,call)=>sum+(call.expenseAmount||0),0);
  const parking=data.calls.reduce((sum,call)=>sum+(call.parkingExpense||0),0);
  const tolls=data.calls.reduce((sum,call)=>sum+(call.tollExpense||0),0);
  const otherExpenses=Math.max(0,expenses-parking-tolls);
  const afterExpenses=Math.max(0,gross-expenses);
  const reserve=afterExpenses*(reservePercent/100);
  const afterReserve=Math.max(0,afterExpenses-reserve);
  const monthGross=monthCalls.reduce((sum,call)=>sum+call.gross,0);
  const monthHours=monthCalls.reduce((sum,call)=>sum+call.hours,0);
  const monthExpenses=monthCalls.reduce((sum,call)=>sum+(call.expenseAmount||0),0);
  const monthAfterExpenses=Math.max(0,monthGross-monthExpenses);
  const monthReserve=monthAfterExpenses*(reservePercent/100);
  const monthAfterReserve=Math.max(0,monthAfterExpenses-monthReserve);
  const changeReserve=(value:number)=>{const next=Math.min(100,Math.max(0,value||0));setReservePercent(next);localStorage.setItem(RESERVE_KEY,String(next))};

  return <div className="page-wrap">
    <div className="page-heading"><div><div className="eyebrow">Worker money / planning</div><h1 style={{marginTop:10}}>Money</h1><p className="subtitle">Finished calls build this automatically. No second timesheet inside StageWire.</p></div><span className="badge badge-finished"><LockKeyhole size={15}/> Private</span></div>

    <section className="card card-pad"><div className="finish-context"><div><div className="eyebrow">Monthly snapshot</div><h2 style={{marginTop:7}}><CalendarDays size={21}/> {monthLabel(currentMonth)}</h2></div><div className="field" style={{minWidth:220}}><label htmlFor="money-month">Month</label><input id="money-month" type="month" value={currentMonth} onChange={e=>setCurrentMonth(e.target.value)}/></div></div><div className="stats-grid" style={{marginTop:18}}><div className="card stat-card"><span className="stat-label">Finished calls</span><strong className="stat-value">{monthCalls.length}</strong></div><div className="card stat-card"><span className="stat-label">Recorded hours</span><strong className="stat-value">{monthHours.toFixed(1)}h</strong></div><div className="card stat-card"><span className="stat-label">Recorded gross</span><strong className="stat-value">{money(monthGross)}</strong></div><div className="card stat-card"><span className="stat-label">Recorded expenses</span><strong className="stat-value">{money(monthExpenses)}</strong></div><div className="card stat-card"><span className="stat-label">Reserve plan</span><strong className="stat-value">{money(monthReserve)}</strong></div></div>{monthCalls.length>0&&<div className="receipt-grid" style={{marginTop:18}}><div><div className="receipt-label">After recorded expenses</div><div className="receipt-value">{money(monthAfterExpenses)}</div></div><div><div className="receipt-label">After {reservePercent}% reserve plan</div><div className="receipt-value">{money(monthAfterReserve)}</div></div></div>}{monthCalls.length===0&&<p className="help-text" style={{marginTop:14}}>No finished calls are recorded for this month yet.</p>}{monthOptions.length>0&&<p className="help-text" style={{marginTop:14}}>Finished work is grouped by the work date saved on each Call Receipt.</p>}</section>

    <div className="stats-grid" style={{marginTop:22}}><div className="card stat-card"><span className="stat-label">All finished calls</span><strong className="stat-value">{data.calls.length}</strong></div><div className="card stat-card"><span className="stat-label">All recorded hours</span><strong className="stat-value">{hours.toFixed(1)}h</strong></div><div className="card stat-card"><span className="stat-label">All recorded gross</span><strong className="stat-value">{money(gross)}</strong></div><div className="card stat-card"><span className="stat-label">All recorded expenses</span><strong className="stat-value">{money(expenses)}</strong></div><div className="card stat-card"><span className="stat-label">All-time reserve plan</span><strong className="stat-value">{money(reserve)}</strong></div></div>

    <section className="card card-pad" style={{marginTop:22}}><div className="eyebrow">Tax planning</div><h2 style={{marginTop:7}}><Calculator size={22}/> Your reserve setting</h2><p className="subtitle">Pick a percentage you want StageWire to set aside in the planning view. This does not move money, calculate your tax bill, or file anything.</p><div className="field" style={{maxWidth:260,marginTop:16}}><label htmlFor="reserve-percent">Reserve percentage</label><div style={{display:'flex',alignItems:'center',gap:10}}><input id="reserve-percent" type="number" min="0" max="100" step="1" value={reservePercent} onChange={event=>changeReserve(Number(event.target.value))}/><strong>%</strong></div></div><div className="receipt-grid" style={{marginTop:18}}><div><div className="receipt-label">Recorded gross</div><div className="receipt-value">{money(gross)}</div></div><div><div className="receipt-label">All recorded expenses</div><div className="receipt-value">{money(expenses)}</div></div><div><div className="receipt-label">After recorded expenses</div><div className="receipt-value">{money(afterExpenses)}</div></div><div><div className="receipt-label">{reservePercent}% reserve plan</div><div className="receipt-value">{money(reserve)}</div></div><div><div className="receipt-label">After reserve plan</div><div className="receipt-value">{money(afterReserve)}</div></div></div></section>

    <section className="card card-pad" style={{marginTop:22}}><div className="eyebrow">Work costs captured automatically</div><h2 style={{marginTop:7}}>What the finished calls already know</h2><div className="stats-grid" style={{marginTop:16}}><div className="card stat-card"><span className="stat-label">Mileage logged</span><strong className="stat-value">{mileage.toFixed(1)} mi</strong></div><div className="card stat-card"><span className="stat-label">Parking</span><strong className="stat-value">{money(parking)}</strong></div><div className="card stat-card"><span className="stat-label">Tolls</span><strong className="stat-value">{money(tolls)}</strong></div><div className="card stat-card"><span className="stat-label">Other recorded expenses</span><strong className="stat-value">{money(otherExpenses)}</strong></div></div><p className="help-text" style={{marginTop:14}}>Recorded expenses include the costs saved during the call and at closeout. Mileage is shown as a work record only; StageWire does not automatically turn it into a tax deduction.</p></section>

    <section style={{marginTop:28}}><div className="section-label"><h2>{monthLabel(currentMonth)} call earnings</h2><span className="help-text">Every row comes from a finished Call Receipt.</span></div>{monthCalls.length===0?<div className="card empty"><WalletCards size={26}/><h3>No finished calls this month.</h3><p>Choose another month or finish a call and it will appear here automatically.</p></div>:<div className="calls-list">{monthCalls.map(call=><Link href={`/receipt/${call.id}`} className="card call-card" key={call.id}><div className="call-main"><span className="badge badge-finished">Finished</span><h3>{call.showName}</h3><p>{call.venue} · {call.role}</p></div><div className="call-money"><strong>{money(call.gross)}</strong><span>{call.hours.toFixed(1)}h · {money(call.expenseAmount||0)} expenses</span><span className="link-text"><ReceiptText size={16}/> Receipt</span></div></Link>)}</div>}</section>

    <div className="card card-pad" style={{marginTop:24}}><div className="eyebrow">One record</div><h2 style={{marginTop:7}}>Nothing to enter again.</h2><p className="subtitle">The Vault, Career Passport, and Money views all read from the same finished call record. If a finished work fact is wrong, open its Call Receipt and use Correct record; StageWire adds a private correction note so the change is never silent. Expense corrections remain separate for now so money totals cannot be changed accidentally.</p><div className="form-actions" style={{marginTop:16}}><Link href="/vault-v14" className="btn btn-secondary"><Archive size={19}/> The Vault</Link></div><div className="privacy-rule"><ShieldCheck size={18}/> Money information is private and is never part of Career Passport sharing.</div></div>
  </div>;
}
