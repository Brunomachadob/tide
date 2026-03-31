import { readFileSync, writeFileSync, existsSync } from 'fs';

const tap = existsSync('tap-output.txt') ? readFileSync('tap-output.txt', 'utf8') : '';
const get = (key) => {
  const m = tap.match(new RegExp(`^# ${key} (\\d+)`, 'm'));
  return m ? parseInt(m[1], 10) : 0;
};

const tests = get('tests');
const pass  = get('pass');
const fail  = get('fail');
const skip  = get('skipped');

const failures = [];
for (const line of tap.split('\n')) {
  if (/^not ok \d+/.test(line))
    failures.push(line.replace(/^not ok \d+ - /, '').trim());
}

const icon = fail > 0 ? '❌' : '✅';
const out = [
  `## ${icon} Test Results`,
  '',
  '| Result | Count |',
  '|--------|-------|',
  `| ✅ Passed  | ${pass} |`,
  `| ❌ Failed  | ${fail} |`,
  `| ⏭️ Skipped | ${skip} |`,
  `| **Total**  | **${tests}** |`,
];

if (failures.length > 0) {
  out.push('', '### Failed Tests', '');
  for (const f of failures) out.push(`- \`${f}\``);
}

writeFileSync(process.env.GITHUB_STEP_SUMMARY, out.join('\n') + '\n');
