import { useEffect, useRef, useState } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Loader2, Upload, X, Image as ImageIcon, Trash2, Check, Repeat2 } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import {
  Background, listBackgrounds, uploadBackground, deleteBackground,
} from '@/lib/backgrounds';
import { toast } from 'sonner';

interface Props {
  bgColor: string;
  setBgColor: (v: string) => void;
  bgImage?: string;
  setBgImage: (v: string | undefined) => void;
}

export function BackgroundPicker({ bgColor, setBgColor, bgImage, setBgImage }: Props) {
  const { user } = useAuth();
  const [library, setLibrary] = useState<Background[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [lastUsedUrl, setLastUsedUrl] = useState<string | undefined>(() => {
    try { return localStorage.getItem('mako-last-bg-url') ?? undefined; } catch { return undefined; }
  });
  const fileInput = useRef<HTMLInputElement>(null);

  // Remember the most recently selected library image so we can offer one-click reuse
  // when the operator opens a different poll that has no background set.
  useEffect(() => {
    if (bgImage) {
      try { localStorage.setItem('mako-last-bg-url', bgImage); } catch { /* ignore */ }
      setLastUsedUrl(bgImage);
    }
  }, [bgImage]);

  const refresh = async () => {
    if (!user) return;
    setLoading(true);
    try {
      setLibrary(await listBackgrounds());
    } catch (e) {
      toast.error(`Could not load backgrounds: ${(e as Error).message}`);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { refresh(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [user?.id]);

  const onUpload = async (file: File) => {
    if (!user) { toast.error('Sign in to upload backgrounds'); return; }
    if (file.size > 10 * 1024 * 1024) { toast.error('Image must be under 10 MB'); return; }
    setUploading(true);
    try {
      const bg = await uploadBackground({ userId: user.id, file });
      setLibrary((l) => [bg, ...l]);
      setBgImage(bg.imageUrl);
      toast.success('Background uploaded');
    } catch (e) {
      toast.error(`Upload failed: ${(e as Error).message}`);
    } finally {
      setUploading(false);
    }
  };

  const onDelete = async (bg: Background) => {
    try {
      await deleteBackground(bg);
      setLibrary((l) => l.filter((x) => x.id !== bg.id));
      if (bgImage === bg.imageUrl) setBgImage(undefined);
      toast.success('Background deleted');
    } catch (e) {
      toast.error(`Delete failed: ${(e as Error).message}`);
    }
  };

  return (
    <div className="space-y-3">
      <div className="space-y-1.5">
        <Label className="text-[10px] text-muted-foreground">Background Color</Label>
        <div className="flex items-center gap-2">
          <input
            type="color"
            value={bgColor || '#1a1a2e'}
            onChange={(e) => setBgColor(e.target.value)}
            className="w-7 h-7 rounded-md border border-border bg-transparent cursor-pointer p-0"
          />
          <Input
            value={bgColor}
            onChange={(e) => setBgColor(e.target.value)}
            className="bg-background/50 h-7 text-[10px] font-mono flex-1"
          />
        </div>
      </div>

      <div className="flex items-center justify-between">
        <Label className="text-[10px] text-muted-foreground">Image</Label>
        {bgImage && (
          <button
            onClick={() => setBgImage(undefined)}
            className="text-[10px] text-muted-foreground hover:text-destructive flex items-center gap-1"
            title="Clear background image"
          >
            <X className="w-3 h-3" /> Clear
          </button>
        )}
      </div>

      {bgImage ? (
        <div className="relative w-full h-20 rounded-md overflow-hidden border border-border">
          <img src={bgImage} alt="Selected background" className="w-full h-full object-cover" />
          <div className="absolute bottom-1 right-1 bg-primary/90 text-primary-foreground rounded-full p-0.5">
            <Check className="w-3 h-3" />
          </div>
        </div>
      ) : (
        <div className="w-full h-20 rounded-md border border-dashed border-border/60 flex items-center justify-center text-muted-foreground">
          <div className="flex flex-col items-center gap-1">
            <ImageIcon className="w-4 h-4 opacity-60" />
            <span className="text-[10px]">No image selected</span>
          </div>
        </div>
      )}

      <div className="flex gap-1.5">
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
        <Button
          size="sm" variant="outline"
          onClick={() => fileInput.current?.click()}
          disabled={uploading}
          className="h-7 text-[10px] gap-1 flex-1"
        >
          {uploading
            ? <Loader2 className="w-3 h-3 animate-spin" />
            : <Upload className="w-3 h-3" />}
          Upload New
        </Button>
        {lastUsedUrl && lastUsedUrl !== bgImage && (
          <Button
            size="sm" variant="outline"
            onClick={() => { setBgImage(lastUsedUrl); toast.success('Reusing last background'); }}
            className="h-7 text-[10px] gap-1 flex-1"
            title="Reuse the background you used most recently"
          >
            <Repeat2 className="w-3 h-3" />
            Reuse Last
          </Button>
        )}
      </div>

      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <Label className="text-[10px] text-muted-foreground">Saved Backgrounds</Label>
          <span className="text-[9px] text-muted-foreground/60 font-mono">{library.length}</span>
        </div>
        {loading ? (
          <div className="text-[10px] text-muted-foreground flex items-center gap-1">
            <Loader2 className="w-3 h-3 animate-spin" /> Loading…
          </div>
        ) : library.length === 0 ? (
          <p className="text-[10px] text-muted-foreground italic">
            Uploaded backgrounds will be saved here for reuse.
          </p>
        ) : (
          <div className="grid grid-cols-3 gap-1.5 max-h-48 overflow-y-auto pr-1">
            {library.map((bg) => {
              const isActive = bgImage === bg.imageUrl;
              return (
                <div
                  key={bg.id}
                  className={`relative group rounded-md overflow-hidden border cursor-pointer aspect-video ${
                    isActive ? 'border-primary ring-1 ring-primary/40' : 'border-border/60 hover:border-border'
                  }`}
                  onClick={() => setBgImage(bg.imageUrl)}
                  title={bg.name}
                >
                  <img src={bg.thumbnailUrl || bg.imageUrl} alt={bg.name} className="w-full h-full object-cover" />
                  {isActive && (
                    <div className="absolute top-0.5 right-0.5 bg-primary/90 text-primary-foreground rounded-full p-0.5">
                      <Check className="w-2.5 h-2.5" />
                    </div>
                  )}
                  <button
                    onClick={(e) => { e.stopPropagation(); onDelete(bg); }}
                    className="absolute bottom-0.5 right-0.5 bg-background/80 hover:bg-destructive hover:text-destructive-foreground rounded p-0.5 opacity-0 group-hover:opacity-100 transition-all"
                    title="Delete background"
                  >
                    <Trash2 className="w-2.5 h-2.5" />
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}