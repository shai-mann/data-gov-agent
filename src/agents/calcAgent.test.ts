import { describe, beforeAll, afterAll, it, expect } from 'vitest';
import { setupNock } from '../../test/nockSetup';
import calcAgent from './calcAgent';
import redactInvocationIds from '../../test/redactInvocationIds';
import exportGraphPNG from './helpers/exportGraphPNG';

describe('Calc agent with Nock replay', () => {
  let nockHelper: ReturnType<typeof setupNock>;

  beforeAll(() => {
    nockHelper = setupNock('calc-agent');
  });

  afterAll(() => {
    nockHelper?.stop();
  });

  it('returns a deterministic response', async () => {
    const result = await calcAgent.invoke({
      messages: [
        {
          role: 'user',
          content: 'What is 2 + 2?',
        },
      ],
    });

    expect(redactInvocationIds(result)).toMatchSnapshot();
  });

  it('stores an agent graph', async () => {
    const pngBuffer = await exportGraphPNG(calcAgent);
    expect(pngBuffer).toMatchImageSnapshot();
  });
});
