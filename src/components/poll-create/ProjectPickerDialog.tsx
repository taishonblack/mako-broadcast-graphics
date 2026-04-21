import { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { listProjects, createProject } from '@/lib/poll-persistence';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';
import { Plus, FolderOpen, Loader2 } from 'lucide-react';

interface ProjectPickerDialogProps {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onSelect: (projectId: string, projectName: string) => void;
}

export function ProjectPickerDialog({ open, onOpenChange, onSelect }: ProjectPickerDialogProps) {
  const { user } = useAuth();
  const [projects, setProjects] = useState<{ id: string; name: string; description: string | null }[]>([]);
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState('');
  const [showCreate, setShowCreate] = useState(false);

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    listProjects()
      .then((p) => setProjects(p as typeof projects))
      .catch((e) => toast.error(`Could not load projects: ${e.message}`))
      .finally(() => setLoading(false));
  }, [open]);

  const handleCreate = async () => {
    if (!user || !newName.trim()) return;
    setCreating(true);
    try {
      const project = await createProject(newName.trim(), user.id);
      toast.success(`Project "${project.name}" created`);
      onSelect(project.id, project.name);
      onOpenChange(false);
      setNewName('');
      setShowCreate(false);
    } catch (e) {
      toast.error(`Could not create project: ${(e as Error).message}`);
    } finally {
      setCreating(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Save to Project</DialogTitle>
          <DialogDescription>
            Choose a project to add this poll to, or create a new one.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2 max-h-72 overflow-y-auto">
          {loading ? (
            <div className="flex items-center justify-center py-8 text-muted-foreground text-xs">
              <Loader2 className="w-3 h-3 mr-2 animate-spin" /> Loading projects…
            </div>
          ) : projects.length === 0 ? (
            <div className="text-center py-6 text-xs text-muted-foreground">
              No projects yet. Create one below.
            </div>
          ) : (
            projects.map((p) => (
              <button
                key={p.id}
                onClick={() => { onSelect(p.id, p.name); onOpenChange(false); }}
                className="w-full flex items-center gap-2 p-3 rounded-lg border border-border hover:border-primary/50 hover:bg-accent/50 transition-colors text-left"
              >
                <FolderOpen className="w-4 h-4 text-primary shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-foreground truncate">{p.name}</div>
                  {p.description && <div className="text-[10px] text-muted-foreground truncate">{p.description}</div>}
                </div>
              </button>
            ))
          )}
        </div>

        {showCreate ? (
          <div className="space-y-2 pt-2 border-t border-border">
            <Label className="text-xs">New project name</Label>
            <Input
              autoFocus
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="e.g. Friday Night Show"
              onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
            />
            <div className="flex gap-2">
              <Button onClick={handleCreate} disabled={creating || !newName.trim()} size="sm" className="flex-1">
                {creating ? <Loader2 className="w-3 h-3 mr-1 animate-spin" /> : <Plus className="w-3 h-3 mr-1" />}
                Create & Save
              </Button>
              <Button onClick={() => { setShowCreate(false); setNewName(''); }} variant="outline" size="sm">
                Cancel
              </Button>
            </div>
          </div>
        ) : (
          <DialogFooter>
            <Button onClick={() => setShowCreate(true)} variant="outline" size="sm" className="gap-1">
              <Plus className="w-3 h-3" /> New Project
            </Button>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
}