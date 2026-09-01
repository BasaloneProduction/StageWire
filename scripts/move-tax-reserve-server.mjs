import fs from 'node:fs';

function patchFile(path, edits) {
  let source = fs.readFileSync(path, 'utf8');
  for (const [search, replacement, label] of edits) {
    const first = source.indexOf(search);
    if (first === -1) throw new Error(`${path}: could not find ${label}`);
    if (source.indexOf(search, first + search.length) !== -1) throw new Error(`${path}: multiple matches for ${label}`);
    source = source.replace(search, replacement);
  }
  fs.writeFileSync(path, source);
}

patchFile('lib/db/src/schema/stagewire.ts', [[
`  shareSkills: boolean("share_skills").notNull().default(true),\n  shareCertifications: boolean("share_certifications").notNull().default(true),\n}, (table) => [\n  uniqueIndex("worker_profiles_owner_key_unique").on(table.ownerKey),\n]);\n`,
`  shareSkills: boolean("share_skills").notNull().default(true),\n  shareCertifications: boolean("share_certifications").notNull().default(true),\n  taxReservePercent: integer("tax_reserve_percent").notNull().default(25),\n}, (table) => [\n  uniqueIndex("worker_profiles_owner_key_unique").on(table.ownerKey),\n  check("worker_profiles_tax_reserve_percent_check", sql\`${table.taxReservePercent} between 0 and 100\`),\n]);\n`,
'worker tax reserve schema',
]]);

patchFile('lib/api-spec/openapi.yaml', [
[
`        shareSkills:\n          type: boolean\n        shareCertifications:\n          type: boolean\n      required:\n`,
`        shareSkills:\n          type: boolean\n        shareCertifications:\n          type: boolean\n        taxReservePercent:\n          type: integer\n          minimum: 0\n          maximum: 100\n      required:\n`,
'WorkerProfile tax reserve property',
],
[
`        - shareSkills\n        - shareCertifications\n    ProfileInput:\n`,
`        - shareSkills\n        - shareCertifications\n        - taxReservePercent\n    ProfileInput:\n`,
'WorkerProfile tax reserve requirement',
],
[
`        shareSkills:\n          type: boolean\n        shareCertifications:\n          type: boolean\n      required:\n        - displayName\n`,
`        shareSkills:\n          type: boolean\n        shareCertifications:\n          type: boolean\n        taxReservePercent:\n          type: integer\n          minimum: 0\n          maximum: 100\n      required:\n        - displayName\n`,
'ProfileInput tax reserve property',
],
]);

patchFile('artifacts/api-server/src/routes/stagewire.ts', [[
`          shareSkills: input.shareSkills ?? current.shareSkills,\n          shareCertifications: input.shareCertifications ?? current.shareCertifications,\n`,
`          shareSkills: input.shareSkills ?? current.shareSkills,\n          shareCertifications: input.shareCertifications ?? current.shareCertifications,\n          taxReservePercent: input.taxReservePercent ?? current.taxReservePercent,\n`,
'tax reserve profile save',
]]);

patchFile('artifacts/stagewire/src/demo-api.ts', [[
`      shareSkills: true,\n      shareCertifications: true,\n`,
`      shareSkills: true,\n      shareCertifications: true,\n      taxReservePercent: 25,\n`,
'tax reserve demo default',
]]);

patchFile('artifacts/api-server/src/routes/health.ts', [[
`        shareSkills: workerProfiles.shareSkills,\n        shareCertifications: workerProfiles.shareCertifications,\n`,
`        shareSkills: workerProfiles.shareSkills,\n        shareCertifications: workerProfiles.shareCertifications,\n        taxReservePercent: workerProfiles.taxReservePercent,\n`,
'tax reserve readiness field',
]]);

patchFile('artifacts/api-server/src/domain/database-readiness.test.ts', [[
`  assert.match(health, /workerProfiles\\.shareCertifications/);\n  assert.match(health, /workerCredentials\\.id/, "credential storage must be part of readiness");\n`,
`  assert.match(health, /workerProfiles\\.shareCertifications/);\n  assert.match(health, /workerProfiles\\.taxReservePercent/);\n  assert.match(health, /workerCredentials\\.id/, "credential storage must be part of readiness");\n`,
'tax reserve readiness regression',
]]);

patchFile('artifacts/stagewire/src/pages/money-center.tsx', [
[
`import { useGetVault } from '@workspace/api-client-react';\nimport { useState } from 'react';\n`,
`import { useQueryClient } from '@tanstack/react-query';\nimport { getGetProfileQueryKey, useGetProfile, useGetVault, useUpdateProfile } from '@workspace/api-client-react';\nimport { useState } from 'react';\n`,
'Money profile imports',
],
[
`const RESERVE_KEY='stagewire-tax-reserve-percent-v14';\n`,
`const LEGACY_RESERVE_KEY='stagewire-tax-reserve-percent-v14';\nfunction legacyReservePercent(){const saved=Number(localStorage.getItem(LEGACY_RESERVE_KEY));return saved>=0&&saved<=100?saved:null}\n`,
'Money legacy reserve reader',
],
[
`  const vault=useGetVault();\n  const data=vault.data;\n  const[reservePercent,setReservePercent]=useState(()=>{const saved=Number(localStorage.getItem(RESERVE_KEY));return saved>=0&&saved<=100?saved:25});\n  const[currentMonth,setCurrentMonth]=useState(()=>{const now=new Date();return\`${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}\`});\n  if(vault.isLoading)return <div className="page-wrap"><div className="card card-pad"><h2>Opening Money…</h2></div></div>;\n  if(vault.isError||!data)return <div className="page-wrap"><div className="error-box"><strong>Money could not be opened.</strong><button className="btn btn-quiet" onClick={()=>vault.refetch()}>Try again</button></div></div>;\n\n`,
`  const vault=useGetVault();\n  const profile=useGetProfile();\n  const updateProfile=useUpdateProfile();\n  const client=useQueryClient();\n  const data=vault.data;\n  const worker=profile.data;\n  const[reserveDraft,setReserveDraft]=useState<number|null>(legacyReservePercent);\n  const[currentMonth,setCurrentMonth]=useState(()=>{const now=new Date();return\`${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}\`});\n  if(vault.isLoading||profile.isLoading)return <div className="page-wrap"><div className="card card-pad"><h2>Opening Money…</h2></div></div>;\n  if(vault.isError||profile.isError||!data||!worker)return <div className="page-wrap"><div className="error-box"><strong>Money could not be opened.</strong><button className="btn btn-quiet" onClick={()=>{vault.refetch();profile.refetch()}}>Try again</button></div></div>;\n  const reservePercent=reserveDraft??worker.taxReservePercent;\n\n`,
'Money server reserve state',
],
[
`  const changeReserve=(value:number)=>{const next=Math.min(100,Math.max(0,value||0));setReservePercent(next);localStorage.setItem(RESERVE_KEY,String(next))};\n`,
`  const changeReserve=(value:number)=>{const next=Math.min(100,Math.max(0,value||0));setReserveDraft(next)};\n  const saveReserve=()=>updateProfile.mutate({data:{displayName:worker.displayName,primaryRole:worker.primaryRole,taxReservePercent:reservePercent}},{onSuccess:(result)=>{client.setQueryData(getGetProfileQueryKey(),result);client.invalidateQueries({queryKey:getGetProfileQueryKey()});try{localStorage.removeItem(LEGACY_RESERVE_KEY)}catch{}setReserveDraft(null)}});\n`,
'Money reserve save action',
],
[
`<div className="field" style={{maxWidth:260,marginTop:16}}><label htmlFor="reserve-percent">Reserve percentage</label><div style={{display:'flex',alignItems:'center',gap:10}}><input id="reserve-percent" type="number" min="0" max="100" step="1" value={reservePercent} onChange={event=>changeReserve(Number(event.target.value))}/><strong>%</strong></div></div><div className="receipt-grid" style={{marginTop:18}}>`,
`<div className="field" style={{maxWidth:260,marginTop:16}}><label htmlFor="reserve-percent">Reserve percentage</label><div style={{display:'flex',alignItems:'center',gap:10}}><input id="reserve-percent" type="number" min="0" max="100" step="1" value={reservePercent} onChange={event=>changeReserve(Number(event.target.value))}/><strong>%</strong></div></div><div className="form-actions" style={{marginTop:12}}><button className="btn btn-secondary" type="button" onClick={saveReserve} disabled={reserveDraft===null||updateProfile.isPending}>{updateProfile.isPending?'Saving…':'Save reserve setting'}</button></div>{updateProfile.error&&<div className="error-box" role="alert" style={{marginTop:12}}><strong>{(updateProfile.error as Error).message||'Reserve setting could not be saved.'}</strong></div>}<div className="receipt-grid" style={{marginTop:18}}>`,
'Money reserve save UI',
],
]);

patchFile('artifacts/stagewire/src/pages/work-receipt.tsx', [
[
`import { useGetCallWorkday } from '@workspace/api-client-react';\n`,
`import { useGetCallWorkday, useGetProfile } from '@workspace/api-client-react';\n`,
'Receipt profile import',
],
[
`const RESERVE_KEY = 'stagewire-tax-reserve-percent-v14';\nfunction reservePercent() { const saved = Number(localStorage.getItem(RESERVE_KEY)); return saved >= 0 && saved <= 100 ? saved : 25; }\n`,
`const LEGACY_RESERVE_KEY = 'stagewire-tax-reserve-percent-v14';\nfunction legacyReservePercent() { const saved = Number(localStorage.getItem(LEGACY_RESERVE_KEY)); return saved >= 0 && saved <= 100 ? saved : null; }\n`,
'Receipt legacy reserve reader',
],
[
`  const { id } = useParams<{ id: string }>(); const callId = Number(id); const workday = useGetCallWorkday(callId); const data = workday.data; const call = data?.call; const corrected = new URLSearchParams(window.location.search).get('corrected') === '1';\n`,
`  const { id } = useParams<{ id: string }>(); const callId = Number(id); const workday = useGetCallWorkday(callId); const profile = useGetProfile(); const data = workday.data; const call = data?.call; const corrected = new URLSearchParams(window.location.search).get('corrected') === '1';\n`,
'Receipt profile query',
],
[
`  const reserve = reservePercent();\n`,
`  const reserve = legacyReservePercent() ?? profile.data?.taxReservePercent ?? 25;\n`,
'Receipt server reserve source',
],
]);

console.log('Tax reserve preference moved to worker profile with legacy browser fallback.');
