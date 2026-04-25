import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { OperatorLayout } from '@/components/layout/OperatorLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from '@/components/ui/dialog';
import {
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem,
} from '@/components/ui/dropdown-menu';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import {
  BLOCK_LETTERS, DEFAULT_BLOCK_LABELS, BlockLetter,
} from '@/lib/poll-persistence';
import {
  PollingAssetFolder,
  PollingAssetFolderState,
  loadProjectPollingAssetFolders,
  saveProjectPollingAssetFolders,
} from '@/lib/polling-asset-folders';
import { Search, FolderOpen, MoreHorizontal, Grid3x3, Pencil } from 'lucide-react';

interface ProjectLite {
  id: string;
  name: string;
  description: string | null;
  updated_at: string;
}

const RECENT_LIMIT = 10;

const blockLabelStorageKey = (projectId: string) => `mako-block-labels:${projectId}`;

function loadBlockLabels(projectId: string): Record<BlockLetter, string> {
  try {
    const raw = localStorage.getItem(blockLabelStorageKey(projectId));
    if (!raw) return { ...DEFAULT_BLOCK_LABELS };
    const parsed = JSON.parse(raw) as Partial<Record<BlockLetter, string>>;
    const out = { ...DEFAULT_BLOCK_LABELS };
    BLOCK_LETTERS.forEach((l) => { if (typeof parsed[l] === 'string' && parsed[l]!.trim()) out[l] = parsed[l]!; });
    return out;
  } catch { return { ...DEFAULT_BLOCK_LABELS }; }
}

function saveBlockLabels(projectId: string, labels: Record<BlockLetter, string>) {
  try { localStorage.setItem(blockLabelStorageKey(projectId), JSON.stringify(labels)); } catch { /* ignore */ }
}

export default function Blocks() {
  const { user, loading: authLoading } = useAuth();
  const [projects, setProjects] = useState<ProjectLite[]>([]);
  const [activeProjectId, setActiveProjectId] = useState<string | null>(null);
  const [folderState, setFolderState] = useState<PollingAssetFolderState | null>(null);
  const [labels, setLabels] = useState<Record<BlockLetter, string>>({ ...DEFAULT_BLOCK_LABELS });
  const [draggedFolderId, setDraggedFolderId] = useState<string | null>(null);
  const [allProjectsOpen, setAllProjectsOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [renameTarget, setRenameTarget] = useState<BlockLetter | null>(null);
  const [renameValue, setRenameValue] = useState('');

  useEffect(() => {
    if (!user) return;
    void (async () => {
      setLoading(true);
      const { data: pjs } = await supabase
        .from('projects')
        .select('id, name, description, updated_at')
        .order('updated_at', { ascending: false });
      const list = (pjs ?? []) as ProjectLite[];
      setProjects(list);
      if (list[0] && !activeProjectId) setActiveProjectId(list[0].id);
      setLoading(false);
    })();
  }, [user]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!user || !activeProjectId) { setFolderState(null); return; }
    setLabels(loadBlockLabels(activeProjectId));
    void loadProjectPollingAssetFolders(activeProjectId, user.id)
      .then((state) => setFolderState(state ?? { folders: [], activeFolderId: '' }))
      .catch(() => setFolderState({ folders: [], activeFolderId: '' }));
  }, [user, activeProjectId]);

  const recentProjects = useMemo(() => projects.slice(0, RECENT_LIMIT), [projects]);
  const filteredAllProjects = useMemo(
    () => projects.filter((p) => p.name.toLowerCase().includes(search.toLowerCase())),
    [projects, search],
  );

  const foldersByBlock = useMemo(() => {
    const map: Record<BlockLetter, PollingAssetFolder[]> = { A: [], B: [], C: [], D: [], E: [] };
    (folderState?.folders ?? []).forEach((f) => {
      const letter = BLOCK_LETTERS.includes(f.blockLetter) ? f.blockLetter : 'A';
      map[letter].push(f);
    });
    return map;
  }, [folderState]);

  const moveFolder = async (folderId: string, letter: BlockLetter) => {
    if (!user || !activeProjectId || !folderState) return;
    const next: PollingAssetFolderState = {
      ...folderState,
      folders: folderState.folders.map((f) => (f.id === folderId ? { ...f, blockLetter: letter } : f)),
    };
    setFolderState(next);
    try { await saveProjectPollingAssetFolders(activeProjectId, user.id, next); } catch { /* swallow */ }
  };

  const renameBlock = (letter: BlockLetter, name: string) => {
    if (!activeProjectId) return;
    const trimmed = name.trim() || DEFAULT_BLOCK_LABELS[letter];
    const next = { ...labels, [letter]: trimmed };
    setLabels(next);
    saveBlockLabels(activeProjectId, next);
  };

  if (authLoading) {
    return <OperatorLayout><div className="p-8 text-muted-foreground">Loading…</div></OperatorLayout>;
  }

  const totalFolders = folderState?.folders.length ?? 0;

  return (
    <OperatorLayout>
      <header className="h-14 border-b border-border flex items-center justify-between px-6 shrink-0 bg-card/50">
        <div className="flex items-center gap-3">
          <Grid3x3 className="w-4 h-4 text-primary" />
          <h1 className="text-sm font-semibold">Blocks</h1>
          <span className="text-xs text-muted-foreground">·</span>
          <span className="text-xs text-muted-foreground">
            Workspace folders grouped by block assignment A–E
          </span>
        </div>
        <ProjectSwitcher
          projects={recentProjects}
          activeProjectId={activeProjectId}
          onSelect={setActiveProjectId}
          onOpenAll={() => setAllProjectsOpen(true)}
        />
      </header>

      <div className="flex-1 overflow-auto p-6">
        {loading ? (
          <div className="text-muted-foreground text-sm">Loading projects…</div>
        ) : projects.length === 0 ? (
          <div className="max-w-md mx-auto mt-16 text-center space-y-3">
            <Grid3x3 className="w-10 h-10 text-muted-foreground/40 mx-auto" />
            <h2 className="text-base font-semibold">No projects yet</h2>
            <p className="text-sm text-muted-foreground">
              Create a project first, then this page will group its workspace folders by Blocks A–E.
            </p>
            <Link to="/projects"><Button size="sm" className="gap-2"><FolderOpen className="w-3.5 h-3.5" /> Open Projects</Button></Link>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h2 className="text-sm font-semibold text-foreground">
                  {projects.find((p) => p.id === activeProjectId)?.name ?? 'Current Project'}
                </h2>
                <p className="text-xs text-muted-foreground">
                  Folders are created in the Workspace and pinned here by their block. Drag a folder onto another block to reassign it.
                </p>
              </div>
              <span className="text-[10px] font-mono uppercase text-muted-foreground">
                {totalFolders} folders
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
              {BLOCK_LETTERS.map((letter) => (
                <BlockColumn
                  key={letter}
                  letter={letter}
                  label={labels[letter]}
                  folders={foldersByBlock[letter]}
                  draggedFolderId={draggedFolderId}
                  onDragStart={setDraggedFolderId}
                  onDragEnd={() => setDraggedFolderId(null)}
                  onDropFolder={moveFolder}
                  onRequestRename={() => { setRenameTarget(letter); setRenameValue(labels[letter]); }}
                />
              ))}
            </div>
          </div>
        )}
      </div>

      <Dialog open={allProjectsOpen} onOpenChange={setAllProjectsOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>All Projects</DialogTitle>
            <DialogDescription>Browse and switch between any project on your account.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
              <Input
                placeholder="Search projects…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9 h-9 text-sm"
              />
            </div>
            <div className="max-h-[50vh] overflow-auto space-y-1">
              {filteredAllProjects.map((p) => (
                <button
                  key={p.id}
                  onClick={() => { setActiveProjectId(p.id); setAllProjectsOpen(false); }}
                  className={`w-full text-left p-3 rounded-lg border transition-colors ${
                    p.id === activeProjectId
                      ? 'border-primary/40 bg-primary/5'
                      : 'border-border hover:bg-accent/40'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">{p.name}</span>
                    <span className="text-[10px] font-mono text-muted-foreground">
                      {new Date(p.updated_at).toLocaleDateString()}
                    </span>
                  </div>
                  {p.description && (
                    <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">{p.description}</p>
                  )}
                </button>
              ))}
              {filteredAllProjects.length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-6">No projects found.</p>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={renameTarget !== null} onOpenChange={(open) => { if (!open) setRenameTarget(null); }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Rename Block {renameTarget}</DialogTitle>
            <DialogDescription>Set a custom subheader for this block in the current project.</DialogDescription>
          </DialogHeader>
          <Input
            value={renameValue}
            onChange={(e) => setRenameValue(e.target.value)}
            placeholder={renameTarget ? DEFAULT_BLOCK_LABELS[renameTarget] : ''}
            className="h-9 text-sm"
            autoFocus
            onKeyDown={(e) => {
              if (e.key === 'Enter' && renameTarget) {
                renameBlock(renameTarget, renameValue);
                setRenameTarget(null);
              }
            }}
          />
          <div className="flex justify-end gap-2">
            <Button size="sm" variant="ghost" onClick={() => setRenameTarget(null)}>Cancel</Button>
            <Button
              size="sm"
              onClick={() => {
                if (renameTarget) renameBlock(renameTarget, renameValue);
                setRenameTarget(null);
              }}
            >
              Save
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </OperatorLayout>
  );
}

function ProjectSwitcher({
  projects, activeProjectId, onSelect, onOpenAll,
}: {
  projects: ProjectLite[];
  activeProjectId: string | null;
  onSelect: (id: string) => void;
  onOpenAll: () => void;
}) {
  const active = projects.find((p) => p.id === activeProjectId);
  return (
    <div className="flex items-center gap-2">
      <span className="text-[10px] font-mono uppercase text-muted-foreground">Project</span>
      <select
        value={activeProjectId ?? ''}
        onChange={(e) => onSelect(e.target.value)}
        className="h-8 rounded-md border border-input bg-background px-2 text-xs"
      >
        {!active && <option value="">Select…</option>}
        {projects.map((p) => (
          <option key={p.id} value={p.id}>{p.name}</option>
        ))}
      </select>
      <Button variant="outline" size="sm" className="text-xs h-8 gap-1.5" onClick={onOpenAll}>
        <Search className="w-3 h-3" /> More
      </Button>
    </div>
  );
}

function BlockColumn({
  letter, label, folders, draggedFolderId, onDragStart, onDragEnd, onDropFolder, onRequestRename,
}: {
  letter: BlockLetter;
  label: string;
  folders: PollingAssetFolder[];
  draggedFolderId: string | null;
  onDragStart: (folderId: string | null) => void;
  onDragEnd: () => void;
  onDropFolder: (folderId: string, letter: BlockLetter) => void;
  onRequestRename: () => void;
}) {
  const [isDropTarget, setIsDropTarget] = useState(false);

  return (
    <div
      className={`mako-panel p-3 space-y-3 min-h-[300px] transition-colors ${
        isDropTarget ? 'ring-1 ring-primary bg-primary/5' : ''
      }`}
      onDragOver={(event) => {
        if (!draggedFolderId) return;
        event.preventDefault();
        if (!isDropTarget) setIsDropTarget(true);
      }}
      onDragLeave={() => setIsDropTarget(false)}
      onDrop={(event) => {
        event.preventDefault();
        setIsDropTarget(false);
        if (draggedFolderId) {
          void onDropFolder(draggedFolderId, letter);
          onDragEnd();
        }
      }}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-bold font-mono text-primary leading-none">{letter}</span>
            <span className="text-[10px] font-mono uppercase text-muted-foreground">{folders.length}</span>
          </div>
          <p className="text-[10px] text-muted-foreground mt-1 truncate" title={label}>{label}</p>
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              title="Block options"
              className="text-muted-foreground hover:text-foreground transition-colors p-0.5 rounded"
            >
              <MoreHorizontal className="w-4 h-4" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={onRequestRename} className="gap-2 text-xs">
              <Pencil className="w-3.5 h-3.5" /> Rename block
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <div className="space-y-1.5">
        {folders.length === 0 ? (
          <p className="text-[11px] text-muted-foreground/60 italic">No folders in this block.</p>
        ) : (
          folders.map((folder) => (
            <FolderChip
              key={folder.id}
              folder={folder}
              onDragStart={onDragStart}
              onDragEnd={onDragEnd}
            />
          ))
        )}
      </div>
    </div>
  );
}

function FolderChip({
  folder, onDragStart, onDragEnd,
}: {
  folder: PollingAssetFolder;
  onDragStart: (folderId: string | null) => void;
  onDragEnd: () => void;
}) {
  return (
    <div
      draggable
      onDragStart={(event) => {
        event.dataTransfer.effectAllowed = 'move';
        onDragStart(folder.id);
      }}
      onDragEnd={onDragEnd}
      className="group bg-accent/30 border border-border/50 rounded-md p-2 hover:bg-accent/50 transition-colors cursor-grab active:cursor-grabbing"
    >
      <div className="flex items-center justify-between gap-2">
        <Link
          to="/workspace"
          className="text-xs font-medium text-foreground truncate flex-1 hover:text-primary"
          title={folder.name}
        >
          <FolderOpen className="w-3 h-3 inline mr-1 -mt-0.5 text-muted-foreground" />
          {folder.name}
        </Link>
        <span className="text-[9px] font-mono text-muted-foreground">{folder.assetIds.length}</span>
      </div>
      {folder.questionText && (
        <p className="text-[10px] text-muted-foreground mt-0.5 truncate" title={folder.questionText}>
          {folder.questionText}
        </p>
      )}
    </div>
  );
}
