export type PipelineStepId =
  | '1'
  | '2'
  | '3'
  | '4'
  | '5'
  | '6'
  | '7'
  | '8'
  | '9a'
  | '9b'
  | '9c'
  | '9d'
  | '10'
  | '11'
  | '12';

export type PipelineStepStatus = 'ran' | 'skipped';

export interface PipelineStepTiming {
  status: PipelineStepStatus;
  durationMs: number;
  reason?: string;
}

export const PIPELINE_STEP_IDS: PipelineStepId[] = [
  '1',
  '2',
  '3',
  '4',
  '5',
  '6',
  '7',
  '8',
  '9a',
  '9b',
  '9c',
  '9d',
];

export const FULL_SCAN_STEP_IDS: PipelineStepId[] = [
  ...PIPELINE_STEP_IDS,
  '10',
  '11',
  '12',
];

export function selectPipelineSteps(
  fromStep: string | undefined,
  toStep: string | undefined,
  allowedSteps: PipelineStepId[],
): PipelineStepId[] {
  const from = normalizeStepBoundary(fromStep, allowedSteps, 'from');
  const to = normalizeStepBoundary(toStep, allowedSteps, 'to');
  const fromIndex = allowedSteps.indexOf(from);
  const toIndex = allowedSteps.indexOf(to);

  if (fromIndex === -1) {
    throw new Error(`Unsupported fromStep "${from}"`);
  }
  if (toIndex === -1) {
    throw new Error(`Unsupported toStep "${to}"`);
  }
  if (fromIndex > toIndex) {
    throw new Error(`fromStep must be before or equal to toStep`);
  }

  return allowedSteps.slice(fromIndex, toIndex + 1);
}

function normalizeStepBoundary(
  value: string | undefined,
  allowedSteps: PipelineStepId[],
  boundary: 'from' | 'to',
): PipelineStepId {
  if (!value) {
    return boundary === 'from' ? allowedSteps[0] : allowedSteps[allowedSteps.length - 1];
  }

  const normalized = value.trim().toLowerCase();
  if (normalized === '9') {
    return boundary === 'from' ? '9a' : '9d';
  }
  if (isPipelineStepId(normalized)) {
    return normalized;
  }
  throw new Error(`Invalid ${boundary}Step "${value}"`);
}

function isPipelineStepId(value: string): value is PipelineStepId {
  return (FULL_SCAN_STEP_IDS as string[]).includes(value);
}
