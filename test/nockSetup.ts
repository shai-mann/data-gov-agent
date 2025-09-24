import fs from 'node:fs';
import path from 'node:path';
import nock, { Definition } from 'nock';

const FIXTURES_DIR = path.join(__dirname, '__fixtures__');

export function setupNock(
  testName: string,
  mode: 'record' | 'replay' = 'replay'
) {
  const fixturePath = path.join(FIXTURES_DIR, `${testName}.json`);

  if (mode === 'record') {
    // Clean existing interceptors
    nock.cleanAll();
    nock.enableNetConnect();

    nock.recorder.clear();
    nock.recorder.rec({
      output_objects: true,
      dont_print: true,
    });

    return {
      stop: () => {
        const nockCalls = nock.recorder.play();
        fs.mkdirSync(FIXTURES_DIR, { recursive: true });

        if (nockCalls.length > 0) {
          fs.writeFileSync(fixturePath, JSON.stringify(nockCalls, null, 2));
          nock.recorder.clear();
        }
      },
    };
  }

  if (mode === 'replay') {
    // Start recording if no fixture found
    if (!fs.existsSync(fixturePath)) {
      console.warn(
        `No nock fixture found for ${testName}. Will record one now.`
      );
      return setupNock(testName, 'record');
    }

    const fixtures = JSON.parse(fs.readFileSync(fixturePath, 'utf8'));
    fixtures.forEach((def: Definition) => nock.define([def]));

    nock.disableNetConnect();
    // Allow connections to mermaid.ink:443 for graph generation
    nock.enableNetConnect('mermaid.ink:443');

    return { stop: () => {} };
  }

  throw new Error(`Unknown mode: ${mode}`);
}
