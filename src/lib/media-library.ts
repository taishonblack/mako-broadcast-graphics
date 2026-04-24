import { supabase } from '@/integrations/supabase/client';

export type MediaKind = 'background' | 'logo' | 'image';

export interface MediaItem {
  id: string;
  kind: MediaKind;
  userId: string;
  name: string;
  imageUrl: string;
  thumbnailUrl?: string;
  filePath: string;
  thumbnailPath?: string;
  createdAt: string;
}

const KIND_TO_TABLE: Record<MediaKind, 'backgrounds' | 'logos' | 'images'> = {
  background: 'backgrounds',
  logo: 'logos',
  image: 'images',
};

const KIND_TO_BUCKET: Record<MediaKind, string> = {
  background: 'backgrounds',
  logo: 'logos',
  image: 'images',
};

async function toSignedUrl(bucket: string, path?: string | null): Promise<string | undefined> {
  if (!path) return undefined;
  const { data, error } = await supabase.storage.from(bucket).createSignedUrl(path, 60 * 60);
  if (error) throw error;
  return data.signedUrl;
}

async function fromRow(kind: MediaKind, r: Record<string, unknown>): Promise<MediaItem> {
  const bucket = KIND_TO_BUCKET[kind];
  const filePath = r.file_path as string;
  const thumbnailPath = (r.thumbnail_path as string | null) ?? undefined;
  const [imageUrl, thumbnailUrl] = await Promise.all([
    toSignedUrl(bucket, filePath),
    toSignedUrl(bucket, thumbnailPath),
  ]);
  return {
    id: r.id as string,
    kind,
    userId: ((r.account_id as string | null) ?? (r.user_id as string | null) ?? '') as string,
    name: (r.name as string) ?? 'Untitled',
    imageUrl: imageUrl ?? '',
    thumbnailUrl,
    filePath,
    thumbnailPath,
    createdAt: r.created_at as string,
  };
}

export async function listMedia(kind: MediaKind): Promise<MediaItem[]> {
  const table = KIND_TO_TABLE[kind];
  const { data, error } = await supabase
    .from(table)
    .select('*')
    .order('created_at', { ascending: false });
  if (error) throw error;
  return Promise.all((data ?? []).map((row) => fromRow(kind, row as Record<string, unknown>)));
}

export async function listAllMedia(): Promise<MediaItem[]> {
  const [bg, logos, images] = await Promise.all([
    listMedia('background').catch(() => []),
    listMedia('logo').catch(() => []),
    listMedia('image').catch(() => []),
  ]);
  return [...bg, ...logos, ...images].sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
}

export async function uploadMedia(opts: {
  kind: MediaKind;
  userId: string;
  file: File;
  name?: string;
}): Promise<MediaItem> {
  const bucket = KIND_TO_BUCKET[opts.kind];
  const table = KIND_TO_TABLE[opts.kind];
  const ext = opts.file.name.split('.').pop()?.toLowerCase() || 'png';
  const path = `${opts.userId}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
  const { error: upErr } = await supabase.storage
    .from(bucket)
    .upload(path, opts.file, { cacheControl: '3600', upsert: false });
  if (upErr) throw upErr;
  const insertRow: Record<string, unknown> = {
    user_id: opts.userId,
    account_id: opts.userId,
    created_by: opts.userId,
    name: opts.name || opts.file.name.replace(/\.[^.]+$/, ''),
    image_url: path,
    file_path: path,
  };
  // 'backgrounds' table is the only one that historically required image_url.
  // Logos/images tables also have image_url NOT NULL — covered above.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase.from(table) as any).insert([insertRow]).select().single();
  if (error) throw error;
  return fromRow(opts.kind, data);
}

export async function deleteMedia(item: MediaItem): Promise<void> {
  const bucket = KIND_TO_BUCKET[item.kind];
  const table = KIND_TO_TABLE[item.kind];
  const paths = [item.filePath, item.thumbnailPath].filter(Boolean) as string[];
  if (paths.length > 0) {
    await supabase.storage.from(bucket).remove(paths);
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase.from(table) as any).delete().eq('id', item.id);
  if (error) throw error;
}