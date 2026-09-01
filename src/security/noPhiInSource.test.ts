// SPDX-FileCopyrightText: Copyright Orangebot, Inc. and Medplum contributors
// SPDX-License-Identifier: Apache-2.0
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { extname, join } from 'node:path';
import { describe, expect, test } from 'vitest';

const SRC_ROOT = join(process.cwd(), 'src');

const CONSOLE_LOG = /\bconsole\.(log|debug|info|dir)\s*\(/;
const SSN_NUMBER = /\b\d{3}-\d{2}-\d{4}\b/;
const SSN_FIELD = /Social Security Number|linkId:\s*['"]ssn['"]/i;
const HARDCODED_DOB = /birthDate:\s*['"]\d{4}-\d{2}-\d{2}['"]/;
const ALLOWED_SYNTHETIC_DOB = "birthDate: '1990-01-01'";

function listSourceFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) {
      out.push(...listSourceFiles(path));
      continue;
    }
    if (extname(path) === '.ts' || extname(path) === '.tsx') {
      out.push(path);
    }
  }
  return out;
}

describe('no PHI in application source', () => {
  const files = listSourceFiles(SRC_ROOT).filter((path) => !path.endsWith('noPhiInSource.test.ts'));

  test('does not log clinical payloads or collect SSN', () => {
    const violations: string[] = [];

    for (const path of files) {
      const rel = path.slice(SRC_ROOT.length);
      const text = readFileSync(path, 'utf8');
      const lines = text.split('\n');

      lines.forEach((line, index) => {
        if (CONSOLE_LOG.test(line)) {
          violations.push(`${rel}:${index + 1}: console logging is banned (PHI can leak to DevTools)`);
        }
        if (SSN_NUMBER.test(line) || SSN_FIELD.test(line)) {
          violations.push(`${rel}:${index + 1}: SSN must not appear in the application`);
        }
        if (HARDCODED_DOB.test(line) && !line.includes(ALLOWED_SYNTHETIC_DOB)) {
          violations.push(`${rel}:${index + 1}: hardcoded birth dates must be the synthetic 1990-01-01 fixture`);
        }
      });
    }

    expect(violations).toEqual([]);
  });
});
