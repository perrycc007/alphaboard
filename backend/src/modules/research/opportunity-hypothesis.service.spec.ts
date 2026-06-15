import {
  classifyEventCategory,
  getOpportunityPlaybook,
} from './opportunity-hypothesis.service';

describe('opportunity hypothesis playbook', () => {
  it('classifies rate-cut liquidity news and maps the right areas', () => {
    const category = classifyEventCategory(
      'Fed signals possible rate cut as Treasury yields fall and liquidity improves',
    );
    const playbook = getOpportunityPlaybook(category);

    expect(category).toBe('RATES_LIQUIDITY');
    expect(playbook.relatedEtfs).toEqual(
      expect.arrayContaining(['QQQ', 'XLF', 'XHB', 'GLD']),
    );
    expect(playbook.affectedThemes).toEqual(
      expect.arrayContaining(['Growth duration', 'Banks', 'Housing']),
    );
    expect(playbook.historicalAnalogues.length).toBeGreaterThan(0);
  });

  it('classifies AI capex news as a technology cycle thesis', () => {
    const category = classifyEventCategory(
      'Cloud companies raise AI capex for GPU servers, networking, and data-center power',
    );
    const playbook = getOpportunityPlaybook(category);

    expect(category).toBe('TECH_CYCLE');
    expect(playbook.possibleBeneficiaries).toEqual(
      expect.arrayContaining(['NVDA', 'AMD', 'ANET', 'VRT']),
    );
    expect(playbook.affectedThemes).toEqual(
      expect.arrayContaining(['AI infrastructure', 'Power and cooling']),
    );
  });
});
