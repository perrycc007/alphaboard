import {
  FULL_SCAN_STEP_IDS,
  PIPELINE_STEP_IDS,
  selectPipelineSteps,
} from './pipeline-steps';

describe('selectPipelineSteps', () => {
  it('selects numeric pipeline ranges', () => {
    expect(selectPipelineSteps('7', '9c', PIPELINE_STEP_IDS)).toEqual([
      '7',
      '8',
      '9a',
      '9b',
      '9c',
    ]);
  });

  it('treats step 9 as the full market rebuild boundary', () => {
    expect(selectPipelineSteps('9', undefined, PIPELINE_STEP_IDS)).toEqual([
      '9a',
      '9b',
      '9c',
      '9d',
    ]);
    expect(selectPipelineSteps(undefined, '9', PIPELINE_STEP_IDS).slice(-4)).toEqual([
      '9a',
      '9b',
      '9c',
      '9d',
    ]);
  });

  it('supports full-scan tail steps', () => {
    expect(selectPipelineSteps('9c', undefined, FULL_SCAN_STEP_IDS)).toEqual([
      '9c',
      '9d',
      '10',
      '11',
      '12',
    ]);
  });

  it('rejects invalid or reversed ranges', () => {
    expect(() => selectPipelineSteps('13', undefined, FULL_SCAN_STEP_IDS)).toThrow(
      'Invalid fromStep',
    );
    expect(() => selectPipelineSteps('9d', '7', FULL_SCAN_STEP_IDS)).toThrow(
      'fromStep must be before or equal to toStep',
    );
  });
});
