import fs from 'node:fs';

const path = 'lib/api-spec/openapi.yaml';
let source = fs.readFileSync(path, 'utf8');

if (source.includes('        sharePhoto:\n') && source.includes('        - shareCertifications\n')) {
  console.log('Sharing preference API contract is already present.');
  process.exit(0);
}

function replaceOnce(search, replacement, label) {
  const first = source.indexOf(search);
  if (first === -1) throw new Error(`Sharing preference contract could not find: ${label}`);
  if (source.indexOf(search, first + search.length) !== -1) {
    throw new Error(`Sharing preference contract found multiple matches for: ${label}`);
  }
  source = source.replace(search, replacement);
}

replaceOnce(
`        profilePhotoName:\n          type: ["string", "null"]\n        privateByDefault:\n          type: boolean\n      required:\n`,
`        profilePhotoName:\n          type: ["string", "null"]\n        privateByDefault:\n          type: boolean\n        sharePhoto:\n          type: boolean\n        shareHomeBase:\n          type: boolean\n        shareSkills:\n          type: boolean\n        shareCertifications:\n          type: boolean\n      required:\n`,
'WorkerProfile sharing properties',
);

replaceOnce(
`        - profilePhotoName\n        - privateByDefault\n    ProfileInput:\n`,
`        - profilePhotoName\n        - privateByDefault\n        - sharePhoto\n        - shareHomeBase\n        - shareSkills\n        - shareCertifications\n    ProfileInput:\n`,
'WorkerProfile sharing requirements',
);

replaceOnce(
`        profilePhotoName:\n          type: ["string", "null"]\n      required:\n        - displayName\n`,
`        profilePhotoName:\n          type: ["string", "null"]\n        sharePhoto:\n          type: boolean\n        shareHomeBase:\n          type: boolean\n        shareSkills:\n          type: boolean\n        shareCertifications:\n          type: boolean\n      required:\n        - displayName\n`,
'ProfileInput sharing properties',
);

fs.writeFileSync(path, source);
console.log('Sharing preference API contract inserted.');
