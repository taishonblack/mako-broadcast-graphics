import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { OperatorLayout } from '@/components/layout/OperatorLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import {
  BLOCK_LETTERS, DEFAULT_BLOCK_LABELS, BlockLetter,
  fromRow, SavedPoll,
} from '@/lib/poll-persistence';
import { Search, FolderOpen, Plus, ArrowRight, Grid3x3 } from 'lucide-react';

interface ProjectLite {
  id: string;
  name: string;
  description: string | null;
  updated_at: string;
}

const RECENT_LIMIT = 10;

export default function Blocks() {
  const { user, loading: authLoading } = useAuth();
  const [projects, setProjects] = useState<ProjectLite[]>([]);
  const [activeProjectId, setActiveProjectId] = useState<string | null>(null);
  const [polls, setPolls] = useState<SavedPoll[]>([]);
  const [allProjectsOpen, setAllProjectsOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);

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
    if (!user || !activeProjectId) { setPolls([]); return; }
    void (async () => {
      const { data } = await supabase
        .from('polls').select('*')
        .eq('project_id', activeProjectId)
        .order('updated_at', { ascending: false });
      setPolls((data ?? []).map((r) => fromRow(r as Record<string, unknown>)));
    })();
  }, [user, activeProjectId]);

  const recentProjects = useMemo(() => projects.slice(0, RECENT_LIMIT), [projects]);
  const filteredAllProjects = useMemo(
    () => projects.filter((p) => p.name.toLowerCase().includes(search.toLowerCase())),
    [projects, search],
  );

  const pollsByBlock = useMemo(() => {
    const map: Record<string, SavedPoll[]> = { A: [], B: [], C: [], D: [], E: [], unassigned: [] };
    polls.forEach((p) => {
      const key = p.blockLetter && BLOCK_LETTERS.includes(p.blockLetter) ? p.blockLetter : 'unassigned';
      map[key].push(p);
    });
    return map;
  }, [polls]);

  const reassignPollBlock = async (pollId: string, letter: BlockLetter | null) => {
    await supabase.from('polls').update({
      block_letter: letter,
      block_label: letter ? DEFAULT_BLOCK_LABELS[letter] : null,
    }).eq('id', pollId);
    setPolls((prev) => prev.map((p) => p.id === pollId
      ? { ...p, blockLetter: letter ?? undefined, blockLabel: letter ? DEFAULT_BLOCK_LABELS[letter] : undefined }
      : p));
  };

  if (authLoading) {
    return <OperatorLayout><div className="p-8 text-muted-foreground">Loading…</div></OperatorLayout>;
  }

  return (
    <OperatorLayout>
      <header className="h-14 border-b border-border flex items-center justify-between px-6 shrink-0 bg-card/50">
        <div className="flex items-center gap-3">
          <Grid3x3 className="w-4 h-4 text-primary" />
          <h1 className="text-sm font-semibold">Blocks</h1>
          <span className="text-xs text-muted-foreground">·</span>
          <span className="text-xs text-muted-foreground">
            Organize polls into show segments A–E
          </span>
        </div>
        <div className="flex items-center gap-2">
          <ProjectSwitcher
            projects={recentProjects}
            activeProjectId={activeProjectId}
            onSelect={setActiveProjectId}
            onOpenAll={() => setAllProjectsOpen(true)}
          />
        </div>
      </header>

      <div className="flex-1 overflow-auto p-6">
        {loading ? (
          <div className="text-muted-foreground text-sm">Loading projects…</div>
        ) : projects.length === 0 ? (
          <div className="max-w-md mx-auto mt-16 text-center space-y-3">
            <Grid3x3 className="w-10 h-10 text-muted-foreground/40 mx-auto" />
            <h2 className="text-base font-semibold">No projects yet</h2>
            <p className="text-sm text-muted-foreground">
              Create a project from the Projects page, then assign polls to Blocks A–E here.
            </p>
            <Link to="/projects"><Button size="sm" className="gap-2"><FolderOpen className="w-3.5 h-3.5" /> Open Projects</Button></Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
            {BLOCK_LETTERS.map((letter) => (
              <BlockColumn
                key={letter}
                letter={letter}
                label={DEFAULT_BLOCK_LABELS[letter]}
                polls={pollsByBlock[letter]}
                unassigned={pollsByBlock.unassigned}
                onAssign={reassignPollBlock}
              />
            ))}
          </div>
        )}

        {pollsByBlock.unassigned.length > 0 && (
          <div className="mt-8">
            <h3 className="text-xs font-semibold text-muted-foreground font-mono uppercase mb-2">
              Unassigned · {pollsByBlock.unassigned.length}
            </h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
              {pollsByBlock.unassigned.map((poll) => (
                <UnassignedPollCard key={poll.id} poll={poll} onAssign={reassignPollBlock} />
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
  letter, label, polls, unassigned, onAssign,
}: {
  letter: BlockLetter;
  label: string;
  polls: SavedPoll[];
  unassigned: SavedPoll[];
  onAssign: (pollId: string, letter: BlockLetter | null) => void;
}) {
  const [pickerOpen, setPickerOpen] = useState(false);
  return (
    <div className="mako-panel p-3 space-y-3 min-h-[300px]">
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-bold font-mono text-primary leading-none">{letter}</span>
            <span className="text-[10px] font-mono uppercase text-muted-foreground">{polls.length}</span>
          </div>
          <p className="text-[10px] text-muted-foreground mt-1">{label}</p>
        </div>
        <button
          onClick={() => setPickerOpen((v) => !v)}
          title="Add poll to this block"
          className="text-muted-foreground hover:text-primary transition-colors"
        >
          <Plus className="w-4 h-4" />
        </button>
      </div>

      {pickerOpen && (
        <div className="border border-border rounded-md bg-background/60 p-2 space-y-1 max-h-48 overflow-auto">
          <p className="text-[10px] font-mono uppercase text-muted-foreground px-1">Assign poll</p>
          {unassigned.length === 0 ? (
            <p className="text-[11px] text-muted-foreground px-1 py-1">No unassigned polls.</p>
          ) : (
            unassigned.map((p) => (
              <button
                key={p.id}
                onClick={() => { onAssign(p.id, letter); setPickerOpen(false); }}
                className="w-full text-left text-xs p-1.5 rounded hover:bg-accent/50 truncate"
              >
                {p.internalName || p.question || 'Untitled poll'}
              </button>
            ))
          )}
        </div>
      )}

      <div className="space-y-1.5">
        {polls.length === 0 ? (
          <p className="text-[11px] text-muted-foreground/60 italic">No polls in this block.</p>
        ) : (
          polls.map((poll) => (
            <PollChip key={poll.id} poll={poll} onAssign={onAssign} />
          ))
        )}
      </div>
    </div>
  );
}

function PollChip({
  poll, onAssign,
}: {
  poll: SavedPoll;
  onAssign: (pollId: string, letter: BlockLetter | null) => void;
}) {
  return (
    <div className="group bg-accent/30 border border-border/50 rounded-md p-2 hover:bg-accent/50 transition-colors">
      <div className="flex items-center justify-between gap-2">
        <Link
          to={`/polls/${poll.id}`}
          className="text-xs font-medium text-foreground truncate flex-1 hover:text-primary"
        >
          {poll.internalName || poll.question || 'Untitled'}
        </Link>
        <Badge variant="outline" className="text-[9px] font-mono px-1 py-0">{poll.status}</Badge>
      </div>
      {poll.question && poll.internalName && (
        <p className="text-[10px] text-muted-foreground mt-0.5 truncate">{poll.question}</p>
      )}
      <div className="flex items-center justify-between mt-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
        <select
          defaultValue={poll.blockLetter ?? ''}
          onChange={(e) => onAssign(poll.id, (e.target.value || null) as BlockLetter | null)}
          className="h-6 rounded border border-input bg-background px-1 text-[10px]"
        >
          <option value="">Unassigned</option>
          {BLOCK_LETTERS.map((l) => <option key={l} value={l}>Block {l}</option>)}
        </select>
        <Link to={`/polls/${poll.id}`} className="text-[10px] text-primary inline-flex items-center gap-0.5">
          Edit <ArrowRight className="w-2.5 h-2.5" />
        </Link>
      </div>
    </div>
  );
}

function UnassignedPollCard({
  poll, onAssign,
}: {
  poll: SavedPoll;
  onAssign: (pollId: string, letter: BlockLetter | null) => void;
}) {
  return (
    <div className="mako-panel p-2.5 space-y-1.5">
      <Link
        to={`/polls/${poll.id}`}
        className="text-xs font-medium text-foreground truncate block hover:text-primary"
      >
        {poll.internalName || poll.question || 'Untitled'}
      </Link>
      <div className="flex gap-1 flex-wrap">
        {BLOCK_LETTERS.map((l) => (
          <button
            key={l}
            onClick={() => onAssign(poll.id, l)}
            className="text-[10px] font-mono w-6 h-6 rounded border border-border hover:bg-primary/20 hover:text-primary hover:border-primary/30 transition-colors"
          >
            {l}
          </button>
        ))}
      </div>
    </div>
  );
}
