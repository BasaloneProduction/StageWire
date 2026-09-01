import fs from 'node:fs';

const path = 'lib/api-spec/openapi.yaml';
let source = fs.readFileSync(path, 'utf8');

function replaceOnce(search, replacement, label) {
  const first = source.indexOf(search);
  if (first < 0) throw new Error(`Could not find ${label}`);
  if (source.indexOf(search, first + search.length) >= 0) throw new Error(`Multiple matches for ${label}`);
  source = source.replace(search, replacement);
}

replaceOnce(
`  - name: learning\n    description: Worker-owned credential operations\n  - name: calls\n`,
`  - name: learning\n    description: Worker-owned credential operations\n  - name: crewkit\n    description: Worker-owned Crew Kit preparation state\n  - name: calls\n`,
'Crew Kit tag anchor',
);

replaceOnce(
`  /vault:\n`,
`  /crew-kit-state:\n    get:\n      operationId: getCrewKitState\n      tags: [crewkit]\n      summary: Get the worker-owned Crew Kit state\n      responses:\n        "200":\n          description: Crew Kit state\n          content:\n            application/json:\n              schema:\n                $ref: "#/components/schemas/CrewKitState"\n    put:\n      operationId: updateCrewKitState\n      tags: [crewkit]\n      summary: Replace the worker-owned Crew Kit state\n      requestBody:\n        required: true\n        content:\n          application/json:\n            schema:\n              $ref: "#/components/schemas/CrewKitState"\n      responses:\n        "200":\n          description: Updated Crew Kit state\n          content:\n            application/json:\n              schema:\n                $ref: "#/components/schemas/CrewKitState"\n        "400":\n          description: Invalid Crew Kit state\n          content:\n            application/json:\n              schema:\n                $ref: "#/components/schemas/ErrorResponse"\n\n  /vault:\n`,
'Crew Kit path anchor',
);

replaceOnce(
`    WorkerProfile:\n`,
`    CrewKitCustomItem:\n      type: object\n      properties:\n        id:\n          type: string\n          minLength: 1\n          maxLength: 100\n        role:\n          type: string\n          minLength: 1\n          maxLength: 80\n        label:\n          type: string\n          minLength: 1\n          maxLength: 160\n      required: [id, role, label]\n    CrewKitState:\n      type: object\n      properties:\n        customItems:\n          type: array\n          maxItems: 200\n          items:\n            $ref: "#/components/schemas/CrewKitCustomItem"\n        readyMarks:\n          type: array\n          maxItems: 500\n          uniqueItems: true\n          items:\n            type: string\n            minLength: 1\n            maxLength: 220\n      required: [customItems, readyMarks]\n\n    WorkerProfile:\n`,
'Crew Kit schema anchor',
);

fs.writeFileSync(path, source);
console.log('Crew Kit API contract added.');
