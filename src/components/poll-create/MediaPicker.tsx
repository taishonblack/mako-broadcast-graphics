import { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Loader2, Upload, X, Image as ImageIcon, Trash2, Check } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { listMedia, uploadMedia, deleteMedia, MediaItem, MediaKind } from '@/lib/media-library';
import { toast } from 'sonner';
import { Label } from '@/components/ui/label';

interface MediaPickerProps {
  kind: MediaKind;
  /** Currently selected image URL (signed) */
  value?: string;
  onChange: (url: string | undefined) => void;
  /** Optional: emit when user clears (lets parent reset related state) */
  onClear?: () => void;
  label?: string;
  emptyHint?: string;
}

/**
 * Reusable inspector-side picker that shows the user's library for a given
 * media kind (logo or image), with inline upload and delete. Mirrors the
 * BackgroundPicker UX so logos and custom images get the same treatment.
 */
export function MediaPicker({ kind, value, onChange, onClear, label, emptyHint }: MediaPickerProps) {
  const { user } = useAuth();
  const [library, setLibrary] = useState<MediaItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);

  const labelText = label ?? (kind === 'logo' ? 'Logo' : kind === 'image' ? 'Image' : 'Media');

  const refresh = async () => {
    if (!user) return;
    setLoading(true);
    try {
      setLibrary(await listMedia(kind));
    } catch (e) {
      toast.error(`Could not load ${labelText.toLowerCase()}s: ${(e as Error).message}`);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { refresh(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [user?.id, kind]);

  const onUpload = async (file: File) => {
    if (!user) { toast.error(`Sign in to upload ${labelText.toLowerCase()}s`); return; }
    if (file.size > 10 * 1024 * 1024) { toast.error('Image must be under 10 MB'); return; }
    setUploading(true);
    try {
      const item = await uploadMedia({ kind, userId: user.id, file });
      setLibrary((l) => [item, ...l]);
      onChange(item.imageUrl);
      toast.success(`${labelText} uploaded`);
    } catch (e) {
      toast.error(`Upload failed: ${(e as Error).message}`);
    } finally {
      setUploading(false);
    }
  };

  const onDelete = async (item: MediaItem) => {
    try {
      await deleteMedia(item);
      setLibrary((l) => l.filter((x) => x.id !== item.id));
      if (value === item.imageUrl) {
        onChange(undefined);
        onClear?.();
      }
      toast.success('Deleted');
    } catch (e) {
      toast.error(`Delete failed: ${(e as Error).message}`);
    }
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <Label className="text-[10px] text-muted-foreground">{labelText}</Label>
        {value && (
          <button
            onClick={() => { onChange(undefined); onClear?.(); }}
            className="text-[10px] text-muted-foreground hover:text-destructive flex items-center gap-1"
            title={`Clear ${labelText.toLowerCase()}`}
          >
            <X className="w-3 h-3" /> Clear
          </button>
        )}
      </div>

      {value ? (
        <div className="relative w-full h-20 rounded-md overflow-hidden border border-border bg-background/40">
          <img src={value} alt={`Selected ${labelText}`} className="w-full h-full object-contain" />
          <div className="absolute bottom-1 right-1 bg-primary/90 text-primary-foreground rounded-full p-0.5">
            <Check className="w-3 h-3" />
          </div>
        </div>
      ) : (
        <div className="w-full h-20 rounded-md border border-dashed border-border/60 flex items-center justify-center text-muted-foreground">
          <div className="flex flex-col items-center gap-1">
            <ImageIcon className="w-4 h-4 opacity-60" />
            <span className="text-[10px]">{emptyHint ?? `No ${labelText.toLowerCase()} selected`}</span>
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
      </div>

      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <Label className="text-[10px] text-muted-foreground">Saved {labelText}s</Label>
          <span className="text-[9px] text-muted-foreground/60 font-mono">{library.length}</span>
        </div>
        {loading ? (
          <div className="text-[10px] text-muted-foreground flex items-center gap-1">
            <Loader2 className="w-3 h-3 animate-spin" /> Loading…
          </div>
        ) : library.length === 0 ? (
          <p className="text-[10px] text-muted-foreground italic">
            Uploaded {labelText.toLowerCase()}s will be saved here for reuse.
          </p>
        ) : (
          <div className="grid grid-cols-3 gap-1.5 max-h-48 overflow-y-auto pr-1">
            {library.map((item) => {
              const isActive = value === item.imageUrl;
              return (
                <div
                  key={item.id}
                  className={`relative group rounded-md overflow-hidden border cursor-pointer aspect-video bg-background/40 ${
                    isActive ? 'border-primary ring-1 ring-primary/40' : 'border-border/60 hover:border-border'
                  }`}
                  onClick={() => onChange(item.imageUrl)}
                  title={item.name}
                >
                  <img src={item.thumbnailUrl || item.imageUrl} alt={item.name} className="w-full h-full object-contain" />
                  {isActive && (
                    <div className="absolute top-0.5 right-0.5 bg-primary/90 text-primary-foreground rounded-full p-0.5">
                      <Check className="w-2.5 h-2.5" />
                    </div>
                  )}
                  <button
                    onClick={(e) => { e.stopPropagation(); onDelete(item); }}
                    className="absolute bottom-0.5 right-0.5 bg-background/80 hover:bg-destructive hover:text-destructive-foreground rounded p-0.5 opacity-0 group-hover:opacity-100 transition-all"
                    title={`Delete ${labelText.toLowerCase()}`}
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