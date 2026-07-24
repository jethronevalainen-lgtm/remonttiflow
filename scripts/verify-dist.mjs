import fs from 'node:fs';
import path from 'node:path';

const outputDirectory = path.resolve('dist');
const versionPath = path.join(outputDirectory, 'version.json');
const indexPath = path.join(outputDirectory, 'index.html');

if (!fs.existsSync(indexPath)) {
  throw new Error('Production build is missing dist/index.html');
}

if (!fs.existsSync(versionPath)) {
  throw new Error('Production build is missing dist/version.json');
}

const metadata = JSON.parse(fs.readFileSync(versionPath, 'utf8'));
const requiredStringFields = ['commit', 'branch', 'environment', 'repository', 'builtAt'];

for (const field of requiredStringFields) {
  if (typeof metadata[field] !== 'string' || metadata[field].trim().length === 0) {
    throw new Error(`dist/version.json is missing a valid ${field}`);
  }
}

if (metadata.repository !== 'jethronevalainen-lgtm/remonttiflow') {
  throw new Error(`Unexpected release repository: ${metadata.repository}`);
}

if (process.env.CF_PAGES_COMMIT_SHA && metadata.commit !== process.env.CF_PAGES_COMMIT_SHA) {
  throw new Error(
    `Release metadata commit mismatch: expected ${process.env.CF_PAGES_COMMIT_SHA}, received ${metadata.commit}`,
  );
}

if (process.env.CF_PAGES_BRANCH && metadata.branch !== process.env.CF_PAGES_BRANCH) {
  throw new Error(
    `Release metadata branch mismatch: expected ${process.env.CF_PAGES_BRANCH}, received ${metadata.branch}`,
  );
}

console.log(`Verified dist/version.json for ${metadata.commit} (${metadata.environment}).`);
