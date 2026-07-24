import fs from 'node:fs';
import path from 'node:path';

const commit =
  process.env.CF_PAGES_COMMIT_SHA ||
  process.env.GITHUB_SHA ||
  process.env.VERCEL_GIT_COMMIT_SHA ||
  'local';
const branch =
  process.env.CF_PAGES_BRANCH ||
  process.env.GITHUB_REF_NAME ||
  process.env.VERCEL_GIT_COMMIT_REF ||
  'local';
const environment = process.env.CF_PAGES
  ? branch === 'main'
    ? 'production'
    : 'preview'
  : process.env.NODE_ENV || 'local';

const metadata = {
  commit,
  branch,
  environment,
  repository: 'jethronevalainen-lgtm/remonttiflow',
  buildUrl: process.env.CF_PAGES_URL || null,
  builtAt: new Date().toISOString(),
};

const outputDirectory = path.resolve('dist');
fs.mkdirSync(outputDirectory, { recursive: true });
fs.writeFileSync(
  path.join(outputDirectory, 'version.json'),
  `${JSON.stringify(metadata, null, 2)}\n`,
  'utf8',
);

console.log(`Wrote dist/version.json for ${commit} (${environment}).`);
