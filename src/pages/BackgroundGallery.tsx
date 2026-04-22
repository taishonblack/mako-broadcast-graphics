import { useEffect, useRef, useState, useMemo } from 'react';
import { OperatorLayout } from '@/components/layout/OperatorLayout';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Loader2, Upload, Trash2, Image as ImageIcon, Search } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { Background, listBackgrounds, uploadBackground, deleteBackground } from '@/lib/backgrounds';
import { toast } from 'sonner';

export default function BackgroundGallery() {
  const { user } = useAuth();
  const [items, setItems] = useState<Background[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [query, setQuery] = useState('');
  const fileInput = useRef<HTMLInputElement>(null);

  const refresh = async () => {
    setLoading(true);
    try { setItems(await listBackgrounds()); }
    catch (e) { toast.error(`Failed to load: ${(e as Error).message}`); }
    finally { setLoading(false); }
  };

  useEffect(() => { refresh(); }, [user?.id]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return items;
    return items.filter((b) => b.name.toLowerCase().includes(q));
  }, [items, query]);

  const onUpload = async (file: File) => {
    if (!user) { toast.error('Sign in to upload'); return; }
    if (file.size > 10 * 1024 * 1024) { toast.error('Image must be under 10 MB'); return; }
    setUploading(true);
    try {
      const bg = await uploadBackground({ userId: user.id, file });
      setItems((l) => [bg, ...l]);
      toast.success('Background uploaded');
    } catch (e) { toast.error(`Upload failed: ${(e as Error).message}`); }
    finally { setUploading(false); }
  };

  const onDelete = async (bg: Background) => {
    try {
      await deleteBackground(bg);
      setItems((l) => l.filter((x) => x.id !== bg.id));
      toast.success('Deleted');
    } catch (e) { toast.error(`Delete failed: ${(e as Error).message}`); }
  };

  return (
    <OperatorLayout>
      <header className="h-11 border-b border-border flex items-center justify-between px-4 bg-card/50 shrink-0">
        <div className="flex items-center gap-2">
          <ImageIcon className="w-4 h-4 text-primary" />
          <span className="text-xs font-semibold">Background Gallery</span>
          <span className="text-[10px] text-muted-foreground">{items.length} saved</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="w-3 h-3 absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search backgrounds…"
              className="h-7 text-[11px] pl-7 w-56"
            />
          </div>
          <input
            ref={fileInput}
            type="file"
            accept="image/png,image/jpeg,image/webp,image/svg+xml"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) onUpload(f);
              if (fileInput.current) fileInput.current.value = '';
            }}
          />
          <Button size="sm" onClick={() => fileInput.current?.click()} disabled={uploading} className="h-7 text-[11px] gap-1">
            {uploading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Upload className="w-3 h-3" />}
            Upload
          </Button>
        </div>
      </header>

      <div className="flex-1 min-h-0 overflow-auto p-6">
        {loading ? (
          <div className="flex items-center justify-center h-40 text-muted-foreground text-xs gap-2">
            <Loader2 className="w-4 h-4 animate-spin" /> Loading backgrounds…
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-60 text-muted-foreground gap-2">
            <ImageIcon className="w-8 h-8 opacity-40" />
            <p className="text-xs">{items.length === 0 ? 'No backgrounds uploaded yet.' : 'No backgrounds match your search.'}</p>
            {items.length === 0 && (
              <Button size="sm" variant="outline" onClick={() => fileInput.current?.click()} className="mt-2 text-[11px] h-7 gap-1">
                <Upload className="w-3 h-3" /> Upload your first background
              </Button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
            {filtered.map((bg) => (
              <div key={bg.id} className="group relative rounded-lg overflow-hidden border border-border bg-card/40 aspect-video">
                <img src={bg.thumbnailUrl || bg.imageUrl} alt={bg.name} className="w-full h-full object-cover" />
                <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-background/95 to-transparent p-2 flex items-end justify-between opacity-0 group-hover:opacity-100 transition-opacity">
                  <span className="text-[10px] text-foreground font-medium truncate flex-1">{bg.name}</span>
                  <button
                    onClick={() => onDelete(bg)}
                    className="text-muted-foreground hover:text-destructive p-1 rounded"
                    title="Delete"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </OperatorLayout>
  );
}