import { describe, beforeAll, afterAll, it, expect } from 'vitest';
import { setupNock } from '../../test/nockSetup';
import dataGovAgent from './dataGovAgent';
import redactInvocationIds from '../../test/redactInvocationIds';
import exportGraphPNG from './helpers/exportGraphPNG';
import { HumanMessage } from 'langchain';

describe('Data Gov Agent with Nock replay', () => {
  let nockHelper: ReturnType<typeof setupNock>;

  beforeAll(() => {
    nockHelper = setupNock('data-gov-agent');
  });

  afterAll(() => {
    nockHelper?.stop();
  });

  it('searches for climate change datasets', async () => {
    const result = await dataGovAgent.invoke({
      messages: [
        new HumanMessage({ content: 'Find datasets about climate change' }),
      ],
    });

    expect(redactInvocationIds(result)).toMatchSnapshot();
  }, 30000); // Increased timeout for LLM calls

  it('searches for economic data', async () => {
    const result = await dataGovAgent.invoke({
      messages: [
        new HumanMessage({ content: 'I need economic indicators data' }),
      ],
    });

    expect(redactInvocationIds(result)).toMatchSnapshot();
  }, 30000); // Increased timeout for LLM calls

  it('handles empty search results', async () => {
    const result = await dataGovAgent.invoke({
      messages: [new HumanMessage({ content: 'xyz123nonexistentdata' })],
    });

    expect(redactInvocationIds(result)).toMatchSnapshot();
  }, 30000); // Increased timeout for LLM calls

  it('stores an agent graph', async () => {
    const pngBuffer = await exportGraphPNG(dataGovAgent);
    expect(pngBuffer).toMatchImageSnapshot();
  });
});
