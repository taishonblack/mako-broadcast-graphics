import { supabase } from '@/integrations/supabase/client';

export interface Background {
  id: string;
  userId: string;
  name: string;
  imageUrl: string;
  thumbnailUrl?: string;
  filePath: string;
  thumbnailPath?: string;
  createdAt: string;
}

async function toSignedUrl(path?: string | null): Promise<string | undefined> {
  if (!path) return undefined;
  const { data, error } = await supabase.storage.from('backgrounds').createSignedUrl(path, 60 * 60);
  if (error) throw error;
  return data.signedUrl;
}

async function fromRow(r: Record<string, unknown>): Promise<Background> {
  const filePath = r.file_path as string;
  const thumbnailPath = (r.thumbnail_path as string | null) ?? undefined;
  const [imageUrl, thumbnailUrl] = await Promise.all([
    toSignedUrl(filePath),
    toSignedUrl(thumbnailPath),
  ]);

  return {
    id: r.id as string,
    userId: ((r.account_id as string | null) ?? (r.created_by as string | null) ?? '') as string,
    name: (r.name as string) ?? 'Untitled',
    imageUrl: imageUrl ?? '',
    thumbnailUrl,
    filePath,
    thumbnailPath,
    createdAt: r.created_at as string,
  };
}

export async function listBackgrounds(): Promise<Background[]> {
  const { data, error } = await supabase
    .from('backgrounds')
    .select('*')
    .order('created_at', { ascending: false });
  if (error) throw error;
  return Promise.all((data ?? []).map((row) => fromRow(row as Record<string, unknown>)));
}

export async function deleteBackground(bg: Background): Promise<void> {
  if (bg.filePath || bg.thumbnailPath) {
    await supabase.storage.from('backgrounds').remove([bg.filePath, bg.thumbnailPath].filter(Boolean) as string[]);
  }
  const { error } = await supabase.from('backgrounds').delete().eq('id', bg.id);
  if (error) throw error;
}

export async function uploadBackground(opts: {
  userId: string;
  file: File;
  name?: string;
}): Promise<Background> {
  const ext = opts.file.name.split('.').pop()?.toLowerCase() || 'png';
  const path = `${opts.userId}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
  const { error: upErr } = await supabase.storage
    .from('backgrounds')
    .upload(path, opts.file, { cacheControl: '3600', upsert: false });
  if (upErr) throw upErr;
  const { data, error } = await supabase
    .from('backgrounds')
    .insert({
      account_id: opts.userId,
      created_by: opts.userId,
      name: opts.name || opts.file.name.replace(/\.[^.]+$/, ''),
      image_url: path,
      file_path: path,
    })
    .select()
    .single();
  if (error) throw error;
  return fromRow(data);
}