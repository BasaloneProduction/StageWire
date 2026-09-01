import fs from 'node:fs';

const path = 'lib/api-spec/openapi.yaml';
let source = fs.readFileSync(path, 'utf8');

if (source.includes('\n  /credentials:\n') && source.includes('\n    Credential:\n')) {
  console.log('Worker credential API contract is already present.');
  process.exit(0);
}

function replaceOnce(search, replacement, label) {
  const first = source.indexOf(search);
  if (first === -1) throw new Error(`Credential contract could not find: ${label}`);
  if (source.indexOf(search, first + search.length) !== -1) {
    throw new Error(`Credential contract found multiple matches for: ${label}`);
  }
  source = source.replace(search, replacement);
}

replaceOnce(
  '  - name: profile\n    description: Worker profile operations\n  - name: calls\n',
  '  - name: profile\n    description: Worker profile operations\n  - name: learning\n    description: Worker-owned credential operations\n  - name: calls\n',
  'learning tag insertion',
);

replaceOnce(
  '  /vault:\n',
  `  /credentials:\n    get:\n      operationId: listCredentials\n      tags: [learning]\n      summary: List the worker credential wallet\n      responses:\n        "200":\n          description: Worker credentials\n          content:\n            application/json:\n              schema:\n                type: array\n                items:\n                  $ref: "#/components/schemas/Credential"\n    post:\n      operationId: createCredential\n      tags: [learning]\n      summary: Add a worker credential\n      requestBody:\n        required: true\n        content:\n          application/json:\n            schema:\n              $ref: "#/components/schemas/CredentialInput"\n      responses:\n        "201":\n          description: Created credential\n          content:\n            application/json:\n              schema:\n                $ref: "#/components/schemas/Credential"\n        "400":\n          description: Invalid credential\n          content:\n            application/json:\n              schema:\n                $ref: "#/components/schemas/ErrorResponse"\n\n  /credentials/{credentialId}:\n    patch:\n      operationId: updateCredential\n      tags: [learning]\n      summary: Update a worker credential\n      parameters:\n        - name: credentialId\n          in: path\n          required: true\n          schema:\n            type: integer\n            minimum: 1\n      requestBody:\n        required: true\n        content:\n          application/json:\n            schema:\n              $ref: "#/components/schemas/CredentialUpdateInput"\n      responses:\n        "200":\n          description: Updated credential\n          content:\n            application/json:\n              schema:\n                $ref: "#/components/schemas/Credential"\n        "400":\n          description: Invalid credential update\n          content:\n            application/json:\n              schema:\n                $ref: "#/components/schemas/ErrorResponse"\n        "404":\n          description: Credential not found\n          content:\n            application/json:\n              schema:\n                $ref: "#/components/schemas/ErrorResponse"\n    delete:\n      operationId: deleteCredential\n      tags: [learning]\n      summary: Remove a worker credential\n      parameters:\n        - name: credentialId\n          in: path\n          required: true\n          schema:\n            type: integer\n            minimum: 1\n      responses:\n        "204":\n          description: Credential removed\n        "404":\n          description: Credential not found\n          content:\n            application/json:\n              schema:\n                $ref: "#/components/schemas/ErrorResponse"\n\n  /vault:\n`,
  'credential paths insertion',
);

replaceOnce(
  '    WorkerProfile:\n',
  `    Credential:\n      type: object\n      properties:\n        id:\n          type: integer\n        name:\n          type: string\n        issuer:\n          type: string\n        expires:\n          type: ["string", "null"]\n          format: date\n        status:\n          type: string\n          enum: [current, planned]\n        createdAt:\n          type: string\n        updatedAt:\n          type: string\n      required: [id, name, issuer, expires, status, createdAt, updatedAt]\n    CredentialInput:\n      type: object\n      properties:\n        name:\n          type: string\n          minLength: 1\n        issuer:\n          type: string\n        expires:\n          type: ["string", "null"]\n          format: date\n        status:\n          type: string\n          enum: [current, planned]\n      required: [name, status]\n    CredentialUpdateInput:\n      type: object\n      properties:\n        name:\n          type: string\n          minLength: 1\n        issuer:\n          type: string\n        expires:\n          type: ["string", "null"]\n          format: date\n        status:\n          type: string\n          enum: [current, planned]\n\n    WorkerProfile:\n`,
  'credential schema insertion',
);

fs.writeFileSync(path, source);
console.log('Worker credential API contract inserted.');
