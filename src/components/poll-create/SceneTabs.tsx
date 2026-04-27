import { useState } from 'react';
import { Plus, Copy, Trash2, Pencil, MoreVertical, Layers } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { SCENE_PRESETS, type ScenePreset, type PollScene, getScenePreset } from '@/lib/poll-scenes';

interface SceneTabsProps {
  scenes: PollScene[];
  activeSceneId: string | null;
  onSelectScene: (id: string) => void;
  onAddScene: (preset: ScenePreset) => void;
  onRenameScene: (id: string, name: string) => void;
  onDuplicateScene: (id: string) => void;
  onRemoveScene: (id: string) => void;
  /** Compact label shown to the left ("Scenes"). */
  label?: string;
}

/**
 * Horizontal scene tabs that sit above the build canvas.
 * Multiple scenes per folder/poll. Empty state ("Add your first scene")
 * is rendered inline so the operator immediately sees what to do.
 */
export function SceneTabs({
  scenes,
  activeSceneId,
  onSelectScene,
  onAddScene,
  onRenameScene,
  onDuplicateScene,
  onRemoveScene,
  label = 'Scenes',
}: SceneTabsProps) {
  const [pendingDelete, setPendingDelete] = useState<PollScene | null>(null);

  return (
    <div className="flex items-center gap-1.5 px-3 py-2 border-b border-border/60 bg-background/40">
      <div className="flex items-center gap-1.5 mr-1">
        <Layers className="w-3 h-3 text-muted-foreground" />
        <span className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
          {label}
        </span>
      </div>

      <div className="flex-1 flex items-center gap-1 overflow-x-auto">
        {scenes.length === 0 && (
          <span className="text-[10px] text-muted-foreground/70 italic px-2">
            No scenes yet — add one to begin.
          </span>
        )}
        {scenes.map((scene) => {
          const isActive = scene.id === activeSceneId;
          const preset = getScenePreset(scene.preset);
          return (
            <div
              key={scene.id}
              className={`group flex items-center gap-1 rounded-md border transition-colors ${
                isActive
                  ? 'border-primary/60 bg-primary/10'
                  : 'border-border/60 bg-card/30 hover:border-border'
              }`}
            >
              <button
                type="button"
                onClick={() => onSelectScene(scene.id)}
                className={`flex items-center gap-1.5 pl-2 pr-1 py-1 text-[11px] font-medium ${
                  isActive ? 'text-primary' : 'text-foreground'
                }`}
                title={preset.description}
              >
                <span className="truncate max-w-[140px]">{scene.name}</span>
                <span className="text-[8px] font-mono uppercase text-muted-foreground/70">
                  {preset.label}
                </span>
              </button>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-6 w-6 opacity-60 group-hover:opacity-100"
                    aria-label={`Scene actions for ${scene.name}`}
                  >
                    <MoreVertical className="w-3 h-3" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-44">
                  <DropdownMenuItem
                    className="gap-2"
                    onClick={() => {
                      const next = window.prompt('Rename scene', scene.name);
                      if (next && next.trim()) onRenameScene(scene.id, next.trim());
                    }}
                  >
                    <Pencil className="w-3.5 h-3.5 text-muted-foreground" /> Rename
                  </DropdownMenuItem>
                  <DropdownMenuItem className="gap-2" onClick={() => onDuplicateScene(scene.id)}>
                    <Copy className="w-3.5 h-3.5 text-muted-foreground" /> Duplicate
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    className="gap-2 text-destructive focus:text-destructive"
                    onClick={() => setPendingDelete(scene)}
                  >
                    <Trash2 className="w-3.5 h-3.5" /> Delete
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          );
        })}
      </div>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            size="sm"
            variant={scenes.length === 0 ? 'default' : 'outline'}
            className="h-7 gap-1 text-[10px]"
          >
            <Plus className="w-3.5 h-3.5" />
            {scenes.length === 0 ? 'Add Scene' : 'Add'}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56">
          <DropdownMenuLabel className="text-[10px] uppercase font-mono">
            New Scene Preset
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          {SCENE_PRESETS.map((p) => (
            <DropdownMenuItem key={p.id} onClick={() => onAddScene(p.id)} className="gap-2">
              <div className="flex flex-col">
                <span className="text-xs">{p.label}</span>
                <span className="text-[10px] text-muted-foreground line-clamp-1">
                  {p.description}
                </span>
              </div>
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>

      <AlertDialog
        open={Boolean(pendingDelete)}
        onOpenChange={(open) => { if (!open) setPendingDelete(null); }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete scene?</AlertDialogTitle>
            <AlertDialogDescription>
              {pendingDelete
                ? `Delete "${pendingDelete.name}"? Assets in the poll are not removed — only this scene's visibility settings.`
                : null}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => {
                if (pendingDelete) onRemoveScene(pendingDelete.id);
                setPendingDelete(null);
              }}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
