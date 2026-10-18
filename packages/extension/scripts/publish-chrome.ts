import process from 'node:process';

import { outputDirectory } from './constants';
import { log, logError, r } from './utils';

// Uploads the release zip to the Chrome Web Store and submits it for review (API v2)
const {
  CHROME_ACCESS_TOKEN: token,
  CHROME_PUBLISHER_ID: publisherId,
  CHROME_EXTENSION_ID: extensionId,
  RELEASE_VERSION: version,
} = process.env;

const api = 'https://chromewebstore.googleapis.com';
const item = `publishers/${publisherId}/items/${extensionId}`;
// The upload response and fetchStatus name the in-progress state differently
const inProgress = new Set(['UPLOAD_IN_PROGRESS', 'IN_PROGRESS']);

async function call(url: string, init?: RequestInit): Promise<any> {
  const response = await fetch(url, {
    ...init,
    headers: { ...init?.headers, Authorization: `Bearer ${token}` },
  });
  const body = await response.json();

  if (!response.ok)
    throw new Error(`${response.status} ${JSON.stringify(body, null, 2)}`);

  return body;
}

try {
  if (!token || !publisherId || !extensionId || !version)
    throw new Error(
      'CHROME_ACCESS_TOKEN, CHROME_PUBLISHER_ID, CHROME_EXTENSION_ID and RELEASE_VERSION are required',
    );

  const file = Bun.file(r(outputDirectory, `extension-${version}.zip`));

  log('CHROME', `uploading ${file.name}`);
  let status = await call(`${api}/upload/v2/${item}:upload`, {
    method: 'POST',
    body: file,
  });
  let state = status.uploadState;

  for (let attempt = 0; inProgress.has(state); attempt++) {
    if (attempt === 24)
      throw new Error('upload still in progress after 2 minutes');

    await Bun.sleep(5000);
    status = await call(`${api}/v2/${item}:fetchStatus`);
    state = status.lastAsyncUploadState;
  }

  if (state !== 'SUCCEEDED')
    throw new Error(`upload failed: ${JSON.stringify(status, null, 2)}`);

  log('CHROME', 'submitting for review');
  const submission = await call(`${api}/v2/${item}:publish`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: '{}',
  });

  for (const warning of submission.warningInfo?.warnings ?? [])
    log('CHROME', `warning: ${warning.reason}: ${warning.description}`);

  log('CHROME', `done, item state: ${submission.state}`);
} catch (err: any) {
  logError('CHROME', err.message || err);
  process.exit(1);
}
