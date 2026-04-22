import { supabase } from '@/integrations/supabase/client';

export interface Background {
  id: string;
  userId: string;
  name: string;
  imageUrl: string;
  thumbnailUrl?: string;
  createdAt: string;
}

function fromRow(r: Record<string, unknown>): Background {
  return {
    id: r.id as string,
    userId: r.user_id as string,
    name: (r.name as string) ?? 'Untitled',
    imageUrl: r.image_url as string,
    thumbnailUrl: (r.thumbnail_url as string | null) ?? undefined,
    createdAt: r.created_at as string,
  };
}

export async function listBackgrounds(): Promise<Background[]> {
  const { data, error } = await supabase
    .from('backgrounds')
    .select('*')
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data ?? []).map(fromRow);
}

export async function deleteBackground(bg: Background): Promise<void> {
  // Best-effort storage cleanup if URL is in our bucket
  const marker = '/storage/v1/object/public/backgrounds/';
  const idx = bg.imageUrl.indexOf(marker);
  if (idx >= 0) {
    const path = bg.imageUrl.slice(idx + marker.length);
    await supabase.storage.from('backgrounds').remove([path]);
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
  const { data: pub } = supabase.storage.from('backgrounds').getPublicUrl(path);
  const imageUrl = pub.publicUrl;
  const { data, error } = await supabase
    .from('backgrounds')
    .insert({
      user_id: opts.userId,
      name: opts.name || opts.file.name.replace(/\.[^.]+$/, ''),
      image_url: imageUrl,
    })
    .select()
    .single();
  if (error) throw error;
  return fromRow(data);
}