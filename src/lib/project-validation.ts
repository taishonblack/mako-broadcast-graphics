import { z } from 'zod';

export const MAX_PROJECT_NAME_LENGTH = 80;
export const MAX_PROJECT_TAG_LENGTH = 24;
export const MAX_PROJECT_TAG_COUNT = 8;

const collapseWhitespace = (value: string) => value.trim().replace(/\s+/g, ' ');

export const normalizeProjectTag = (value: string) => collapseWhitespace(value).toLowerCase();

export const normalizeProjectName = (value: string) => collapseWhitespace(value);

export const normalizeProjectTags = (tags: string[]) => {
  const unique = new Set<string>();

  for (const tag of tags) {
    const normalized = normalizeProjectTag(tag);
    if (!normalized) continue;
    unique.add(normalized);
    if (unique.size >= MAX_PROJECT_TAG_COUNT) break;
  }

  return Array.from(unique);
};

export const projectNameSchema = z
  .string()
  .transform(normalizeProjectName)
  .refine((value) => value.length > 0, 'Project name cannot be empty')
  .refine((value) => value.length <= MAX_PROJECT_NAME_LENGTH, `Project name must be ${MAX_PROJECT_NAME_LENGTH} characters or fewer`);

export const projectTagSchema = z
  .string()
  .transform(normalizeProjectTag)
  .refine((value) => value.length > 0, 'Tag cannot be empty')
  .refine((value) => value.length <= MAX_PROJECT_TAG_LENGTH, `Tags must be ${MAX_PROJECT_TAG_LENGTH} characters or fewer`);

export const projectTagsSchema = z
  .array(z.string())
  .transform(normalizeProjectTags)
  .refine((value) => value.length <= MAX_PROJECT_TAG_COUNT, `Projects can have at most ${MAX_PROJECT_TAG_COUNT} tags`);

export const projectCreateSchema = z.object({
  name: projectNameSchema,
  tags: projectTagsSchema,
});

export const projectRenameSchema = z.object({
  name: projectNameSchema,
});