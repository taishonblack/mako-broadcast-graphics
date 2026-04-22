import { z } from 'zod';

export const TEMPLATE_NAMES = [
  'horizontal-bar', 'vertical-bar', 'pie-donut', 'progress-bar',
  'puck-slider', 'fullscreen-hero', 'lower-third',
] as const;

export const ANSWER_TYPES = ['yes-no', 'multiple-choice', 'custom'] as const;
export const MC_LABEL_STYLES = ['letters', 'numbers', 'custom'] as const;
export const PREVIEW_DATA_MODES = ['test', 'real'] as const;

const hexColor = z
  .string()
  .regex(/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/, {
    message: 'must be a hex color (e.g. #1a1a2e)',
  });

const answerSchema = z.object({
  id: z.string().min(1, 'id is required'),
  text: z.string().max(500, 'text must be under 500 characters'),
  shortLabel: z.string().max(50, 'shortLabel must be under 50 characters'),
  testVotes: z.number().int().nonnegative().optional(),
});

export const pollImportSchema = z.object({
  internalName: z.string().trim().max(120, 'internalName must be under 120 characters'),
  question: z.string().trim().max(500, 'question must be under 500 characters'),
  subheadline: z.string().trim().max(500, 'subheadline must be under 500 characters'),
  slug: z
    .string()
    .trim()
    .max(80, 'slug must be under 80 characters')
    .regex(/^[a-z0-9-]*$/, 'slug may only contain lowercase letters, numbers, and dashes'),
  template: z.enum(TEMPLATE_NAMES, {
    errorMap: () => ({ message: `template must be one of: ${TEMPLATE_NAMES.join(', ')}` }),
  }),
  answerType: z.enum(ANSWER_TYPES, {
    errorMap: () => ({ message: `answerType must be one of: ${ANSWER_TYPES.join(', ')}` }),
  }),
  mcLabelStyle: z.enum(MC_LABEL_STYLES, {
    errorMap: () => ({ message: `mcLabelStyle must be one of: ${MC_LABEL_STYLES.join(', ')}` }),
  }),
  answers: z.array(answerSchema).min(2, 'at least 2 answers are required').max(20, 'no more than 20 answers'),
  showLiveResults: z.boolean(),
  showThankYou: z.boolean(),
  showFinalResults: z.boolean(),
  autoCloseSeconds: z.number().int().positive().max(86400).optional(),
  bgColor: hexColor,
  bgImage: z.string().url('bgImage must be a valid URL').optional(),
  previewDataMode: z.enum(PREVIEW_DATA_MODES, {
    errorMap: () => ({ message: `previewDataMode must be one of: ${PREVIEW_DATA_MODES.join(', ')}` }),
  }),
});

export type PollImport = z.infer<typeof pollImportSchema>;

export interface ImportIssue {
  path: string;
  message: string;
  code: string;
}

export function formatZodIssues(error: z.ZodError): ImportIssue[] {
  return error.issues.map((i) => ({
    path: i.path.length ? i.path.join('.') : '(root)',
    message: i.message,
    code: i.code,
  }));
}