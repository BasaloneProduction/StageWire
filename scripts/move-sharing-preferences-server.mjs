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

patchFile('artifacts/api-server/src/routes/stagewire.ts', [[
`          profilePhotoName: input.profilePhotoName === undefined ? current.profilePhotoName : asNullable(input.profilePhotoName),\n          privateByDefault: true,\n`,
`          profilePhotoName: input.profilePhotoName === undefined ? current.profilePhotoName : asNullable(input.profilePhotoName),\n          privateByDefault: true,\n          sharePhoto: input.sharePhoto ?? current.sharePhoto,\n          shareHomeBase: input.shareHomeBase ?? current.shareHomeBase,\n          shareSkills: input.shareSkills ?? current.shareSkills,\n          shareCertifications: input.shareCertifications ?? current.shareCertifications,\n`,
'profile sharing save fields',
]]);

patchFile('artifacts/stagewire/src/demo-api.ts', [[
`      profilePhotoName: null,\n      privateByDefault: true,\n`,
`      profilePhotoName: null,\n      privateByDefault: true,\n      sharePhoto: false,\n      shareHomeBase: false,\n      shareSkills: true,\n      shareCertifications: true,\n`,
'demo sharing defaults',
]]);

patchFile('artifacts/stagewire/src/pages/worker-setup.tsx', [
[
`const SHARE_KEY = 'stagewire-share-settings-v14';\nconst FILES_KEY = 'stagewire-profile-files-v14';\n`,
`const LEGACY_SHARE_KEY = 'stagewire-share-settings-v14';\nconst FILES_KEY = 'stagewire-profile-files-v14';\n`,
'legacy sharing key rename',
],
[
`function readShareSettings(): ShareSettings {\n  try {\n    const raw = localStorage.getItem(SHARE_KEY);\n    if (raw) return { sharePhoto: false, shareHomeBase: false, shareSkills: true, shareCertifications: true, ...JSON.parse(raw) };\n  } catch {}\n  return { sharePhoto: false, shareHomeBase: false, shareSkills: true, shareCertifications: true };\n}\n`,
`function readLegacyShareSettings(): ShareSettings | null {\n  try {\n    const raw = localStorage.getItem(LEGACY_SHARE_KEY);\n    if (raw) return { sharePhoto: false, shareHomeBase: false, shareSkills: true, shareCertifications: true, ...JSON.parse(raw) };\n  } catch {}\n  return null;\n}\n`,
'legacy sharing reader',
],
[
`  const [saved, setSaved] = useState(false);\n  const [share, setShare] = useState<ShareSettings>(readShareSettings);\n  const [files, setFiles] = useState(readFiles);\n`,
`  const [saved, setSaved] = useState(false);\n  const [shareDraft, setShareDraft] = useState<ShareSettings | null>(readLegacyShareSettings);\n  const [files, setFiles] = useState(readFiles);\n`,
'sharing draft state',
],
[
`  const saveShare = (next: ShareSettings) => {\n    setShare(next);\n    localStorage.setItem(SHARE_KEY, JSON.stringify(next));\n  };\n`,
`  const share: ShareSettings = shareDraft ?? {\n    sharePhoto: worker.sharePhoto,\n    shareHomeBase: worker.shareHomeBase,\n    shareSkills: worker.shareSkills,\n    shareCertifications: worker.shareCertifications,\n  };\n\n  const saveShare = (next: ShareSettings) => {\n    setShareDraft(next);\n  };\n`,
'server-backed share state',
],
[
`      profilePhotoName: photoName || worker.profilePhotoName,\n    };\n`,
`      profilePhotoName: photoName || worker.profilePhotoName,\n      sharePhoto: share.sharePhoto,\n      shareHomeBase: share.shareHomeBase,\n      shareSkills: share.shareSkills,\n      shareCertifications: share.shareCertifications,\n    };\n`,
'profile payload sharing fields',
],
[
`        setSaved(true);\n        window.setTimeout(() => setSaved(false), 3000);\n`,
`        try { localStorage.removeItem(LEGACY_SHARE_KEY); } catch {}\n        setShareDraft(null);\n        setSaved(true);\n        window.setTimeout(() => setSaved(false), 3000);\n`,
'legacy sharing cleanup after save',
],
[
`<div className="setup-section-head"><span className="setup-step">5</span><div><div className="eyebrow">Sharing controls</div><h2>You choose what leaves the Vault.</h2><p className="subtitle">These settings affect Career Passport preview only. Private contact information is not included.</p></div></div>`,
`<div className="setup-section-head"><span className="setup-step">5</span><div><div className="eyebrow">Sharing controls</div><h2>You choose what leaves the Vault.</h2><p className="subtitle">Save Worker Setup to keep these Career Passport choices with your worker record across signed-in devices. Private contact information is never included.</p></div></div>`,
'sharing control copy',
],
]);

patchFile('artifacts/stagewire/src/pages/career-passport-v14.tsx', [
[
`const SHARE_KEY = 'stagewire-share-settings-v14';\nconst PHOTO_KEY = 'stagewire-profile-photo-preview-v14';\nfunction settings(): ShareSettings { try { return { sharePhoto: false, shareHomeBase: false, shareSkills: true, shareCertifications: true, ...JSON.parse(localStorage.getItem(SHARE_KEY) || '{}') }; } catch { return { sharePhoto: false, shareHomeBase: false, shareSkills: true, shareCertifications: true }; } }\n`,
`const LEGACY_SHARE_KEY = 'stagewire-share-settings-v14';\nconst PHOTO_KEY = 'stagewire-profile-photo-preview-v14';\nfunction legacySettings(): ShareSettings | null { try { const raw = localStorage.getItem(LEGACY_SHARE_KEY); return raw ? { sharePhoto: false, shareHomeBase: false, shareSkills: true, shareCertifications: true, ...JSON.parse(raw) } : null; } catch { return null; } }\n`,
'passport legacy share fallback',
],
[
`  const passport = useGetPassport(); const profile = useGetProfile(); const credentialQuery = useListCredentials(); const data = passport.data; const worker = profile.data; const share = settings(); const photo = localStorage.getItem(PHOTO_KEY) || ''; const [copied, setCopied] = useState(false);\n`,
`  const passport = useGetPassport(); const profile = useGetProfile(); const credentialQuery = useListCredentials(); const data = passport.data; const worker = profile.data; const photo = localStorage.getItem(PHOTO_KEY) || ''; const [copied, setCopied] = useState(false);\n`,
'passport share source removal',
],
[
`  if (passport.isError || credentialQuery.isError || !data) return <div className="page-wrap"><div className="error-box"><strong>Career Passport could not be opened.</strong><button className="btn btn-quiet" onClick={() => { passport.refetch(); credentialQuery.refetch(); }}>Try again</button></div></div>;\n  const totalHours = data.experience.reduce((sum, item) => sum + item.hours, 0);\n`,
`  if (passport.isError || profile.isError || credentialQuery.isError || !data || !worker) return <div className="page-wrap"><div className="error-box"><strong>Career Passport could not be opened.</strong><button className="btn btn-quiet" onClick={() => { passport.refetch(); profile.refetch(); credentialQuery.refetch(); }}>Try again</button></div></div>;\n  const share: ShareSettings = legacySettings() ?? { sharePhoto: worker.sharePhoto, shareHomeBase: worker.shareHomeBase, shareSkills: worker.shareSkills, shareCertifications: worker.shareCertifications };\n  const totalHours = data.experience.reduce((sum, item) => sum + item.hours, 0);\n`,
'passport server share source',
],
]);

console.log('Sharing preferences moved to worker profile with legacy migration fallback.');
