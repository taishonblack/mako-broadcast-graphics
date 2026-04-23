import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { createProject, listProjects } from '@/lib/poll-persistence';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { toast } from 'sonner';
import { FolderOpen, Clock, Search, Settings, X, Plus } from 'lucide-react';
import makoIllustration from '@/assets/mako-illustration.png';

type ProjectRecord = {
  id: string;
  name: string;
  description: string | null;
  tags: string[];
  created_at: string;
  updated_at: string;
  project_date: string;
};

export default function ProjectLauncher() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [projects, setProjects] = useState<ProjectRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [newProjectOpen, setNewProjectOpen] = useState(false);
  const [openPreviousOpen, setOpenPreviousOpen] = useState(false);
  const [confirmProject, setConfirmProject] = useState<ProjectRecord | null>(null);
  const [newProjectName, setNewProjectName] = useState('');
  const [newTag, setNewTag] = useState('');
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [search, setSearch] = useState('');
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    if (!user) return;
    setLoading(true);
    listProjects()
      .then((items) => setProjects((items as ProjectRecord[]) ?? []))
      .catch((error) => toast.error(`Could not load projects: ${error.message}`))
      .finally(() => setLoading(false));
  }, [user]);

  const recentProjects = useMemo(
    () => [...projects].sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()).slice(0, 10),
    [projects],
  );

  const currentProject = recentProjects[0];

  const availableTags = useMemo(
    () => Array.from(new Set(projects.flatMap((project) => project.tags ?? []).map((tag) => tag.trim()).filter(Boolean))).sort(),
    [projects],
  );

  const filteredProjects = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return projects;
    return projects.filter((project) => {
      const haystack = [project.name, project.description ?? '', ...(project.tags ?? [])].join(' ').toLowerCase();
      return haystack.includes(term);
    });
  }, [projects, search]);

  const openProject = (project: Pick<ProjectRecord, 'id' | 'name'>) => {
    localStorage.setItem('mako-active-project', project.id);
    navigate('/polls/new?mode=output');
  };

  const addTag = (value: string) => {
    const normalized = value.trim();
    if (!normalized || selectedTags.includes(normalized)) return;
    setSelectedTags((current) => [...current, normalized]);
    setNewTag('');
  };

  const removeTag = (value: string) => {
    setSelectedTags((current) => current.filter((tag) => tag !== value));
  };

  const handleCreateProject = async () => {
    if (!user || !newProjectName.trim()) return;
    setCreating(true);
    try {
      const created = await createProject(newProjectName.trim(), user.id, selectedTags);
      const nextProject = created as ProjectRecord;
      setProjects((current) => [nextProject, ...current]);
      setNewProjectOpen(false);
      setNewProjectName('');
      setSelectedTags([]);
      setNewTag('');
      toast.success(`Project "${nextProject.name}" created`);
      openProject(nextProject);
    } catch (error) {
      toast.error(`Could not create project: ${(error as Error).message}`);
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex flex-col relative">
      {/* Header */}
      <header className="h-14 border-b border-border flex items-center px-6 bg-card/50 shrink-0">
        <Link to="/projects" className="flex items-center gap-2 hover:opacity-90 transition-opacity">
          <img src={makoIllustration} alt="MakoVote" className="h-6" />
          <span className="text-sm font-semibold text-foreground">
            <span>Mako</span>
            <span className="text-primary">Vote</span>
          </span>
        </Link>
        <span className="ml-auto text-[10px] text-muted-foreground font-mono">v0.1</span>
      </header>

      {/* Content */}
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="w-full max-w-2xl space-y-6">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Projects</h1>
            <p className="text-sm text-muted-foreground mt-1">Select a project or create a new poll</p>
          </div>

          {/* Current Project */}
          {currentProject && (
            <div className="mako-panel p-5 space-y-3">
              <p className="text-[10px] text-muted-foreground font-mono uppercase">Last Used</p>
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    onClick={() => openProject(currentProject)}
                    className="w-full text-left p-4 rounded-xl bg-primary/5 border border-primary/20 hover:bg-primary/10 transition-colors"
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-semibold text-foreground">{currentProject.name}</p>
                        {currentProject.description && (
                          <p className="text-xs text-muted-foreground mt-0.5">{currentProject.description}</p>
                        )}
                        {currentProject.tags.length > 0 && (
                          <div className="flex flex-wrap gap-1.5 mt-2">
                            {currentProject.tags.map((tag) => (
                              <Badge key={tag} variant="secondary" className="text-[10px] font-mono uppercase">
                                {tag}
                              </Badge>
                            ))}
                          </div>
                        )}
                      </div>
                      <div className="flex items-center gap-3 text-xs text-muted-foreground">
                        <span className="font-mono">{new Date(currentProject.updated_at).toLocaleDateString()}</span>
                        <FolderOpen className="w-4 h-4 text-primary" />
                      </div>
                    </div>
                  </button>
                </TooltipTrigger>
                <TooltipContent>Open the most recently used project</TooltipContent>
              </Tooltip>
            </div>
          )}

          {/* Recent Projects */}
          <div className="mako-panel p-5 space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-[10px] text-muted-foreground font-mono uppercase">Recent Projects</p>
              <Clock className="w-3.5 h-3.5 text-muted-foreground" />
            </div>
            <div className="space-y-1.5">
              {loading ? (
                <div className="rounded-xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
                  Loading projects…
                </div>
              ) : recentProjects.length === 0 ? (
                <div className="rounded-xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
                  No projects yet.
                </div>
              ) : recentProjects.map((project) => (
                <Tooltip key={project.id}>
                  <TooltipTrigger asChild>
                    <button
                      onClick={() => openProject(project)}
                      className="w-full text-left p-3 rounded-xl border border-border/50 hover:bg-accent/30 transition-colors"
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm font-medium text-foreground">{project.name}</p>
                          {project.description && (
                            <p className="text-[11px] text-muted-foreground mt-0.5">{project.description}</p>
                          )}
                          {project.tags.length > 0 && (
                            <div className="flex flex-wrap gap-1.5 mt-2">
                              {project.tags.slice(0, 3).map((tag) => (
                                <Badge key={tag} variant="outline" className="text-[10px] font-mono uppercase">
                                  {tag}
                                </Badge>
                              ))}
                            </div>
                          )}
                        </div>
                        <div className="flex items-center gap-3 text-[10px] text-muted-foreground font-mono">
                          <span>{new Date(project.updated_at).toLocaleDateString()}</span>
                        </div>
                      </div>
                    </button>
                  </TooltipTrigger>
                  <TooltipContent>Open this project and load its polls</TooltipContent>
                </Tooltip>
              ))}
            </div>
          </div>

          {/* Actions */}
          <div className="grid grid-cols-2 gap-3">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="outline" className="w-full gap-2 h-12" onClick={() => setNewProjectOpen(true)}>
                  <Plus className="w-4 h-4" /> New Project
                </Button>
              </TooltipTrigger>
              <TooltipContent>Create a project before entering Operator Workspace</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="outline" className="w-full gap-2 h-12" onClick={() => setOpenPreviousOpen(true)}>
                  <FolderOpen className="w-4 h-4" /> Open Previous Project
                </Button>
              </TooltipTrigger>
                <TooltipContent>Browse every project saved to this account</TooltipContent>
            </Tooltip>
          </div>
        </div>
      </div>

      <div className="absolute bottom-6 left-6">
        <Button variant="ghost" size="icon" aria-label="Settings">
          <Settings className="w-5 h-5" />
        </Button>
      </div>

      <Dialog open={newProjectOpen} onOpenChange={setNewProjectOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>New Project</DialogTitle>
            <DialogDescription>Name the project and add short tags to help organize it.</DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <p className="text-xs font-medium text-muted-foreground">Project name</p>
              <Input
                value={newProjectName}
                onChange={(event) => setNewProjectName(event.target.value)}
                placeholder="Friday Night Show"
                autoFocus
              />
            </div>

            <div className="space-y-2">
              <p className="text-xs font-medium text-muted-foreground">Tags</p>
              <div className="flex gap-2">
                <Input
                  value={newTag}
                  onChange={(event) => setNewTag(event.target.value)}
                  placeholder="Morning show"
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') {
                      event.preventDefault();
                      addTag(newTag);
                    }
                  }}
                />
                <Button type="button" variant="outline" onClick={() => addTag(newTag)}>
                  Add
                </Button>
              </div>

              {availableTags.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {availableTags.map((tag) => {
                    const selected = selectedTags.includes(tag);
                    return (
                      <button
                        key={tag}
                        type="button"
                        onClick={() => selected ? removeTag(tag) : addTag(tag)}
                        className={`rounded-full border px-3 py-1 text-[11px] font-mono uppercase transition-colors ${selected ? 'border-primary bg-primary/10 text-primary' : 'border-border text-muted-foreground hover:bg-accent'}`}
                      >
                        {tag}
                      </button>
                    );
                  })}
                </div>
              )}

              {selectedTags.length > 0 && (
                <div className="flex flex-wrap gap-2 pt-1">
                  {selectedTags.map((tag) => (
                    <Badge key={tag} variant="secondary" className="gap-1 pr-1 text-[11px] font-mono uppercase">
                      {tag}
                      <button type="button" onClick={() => removeTag(tag)} aria-label={`Remove ${tag}`}>
                        <X className="w-3 h-3" />
                      </button>
                    </Badge>
                  ))}
                </div>
              )}
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setNewProjectOpen(false)}>
              Cancel
            </Button>
            <Button type="button" onClick={handleCreateProject} disabled={creating || !newProjectName.trim()}>
              {creating ? 'Creating…' : 'Create Project'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Sheet open={openPreviousOpen} onOpenChange={setOpenPreviousOpen}>
        <SheetContent side="right" className="w-full sm:max-w-xl">
          <SheetHeader>
            <SheetTitle>Open Previous Project</SheetTitle>
            <SheetDescription>Search all projects on this account, then double-click to open one.</SheetDescription>
          </SheetHeader>

          <div className="mt-6 space-y-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 w-4 h-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search projects or tags"
                className="pl-9"
              />
            </div>

            <div className="max-h-[70vh] overflow-y-auto rounded-lg border border-border">
              {filteredProjects.length === 0 ? (
                <div className="p-6 text-center text-sm text-muted-foreground">No matching projects found.</div>
              ) : (
                filteredProjects.map((project) => (
                  <button
                    key={project.id}
                    type="button"
                    onDoubleClick={() => setConfirmProject(project)}
                    className="w-full border-b border-border/70 p-4 text-left transition-colors last:border-b-0 hover:bg-accent/40"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-foreground truncate">{project.name}</p>
                        {project.description && <p className="mt-1 text-xs text-muted-foreground truncate">{project.description}</p>}
                        {project.tags.length > 0 && (
                          <div className="mt-2 flex flex-wrap gap-1.5">
                            {project.tags.map((tag) => (
                              <Badge key={tag} variant="outline" className="text-[10px] font-mono uppercase">
                                {tag}
                              </Badge>
                            ))}
                          </div>
                        )}
                      </div>
                      <div className="text-right text-[10px] font-mono text-muted-foreground shrink-0">
                        <div>Updated</div>
                        <div>{new Date(project.updated_at).toLocaleDateString()}</div>
                      </div>
                    </div>
                  </button>
                ))
              )}
            </div>
          </div>
        </SheetContent>
      </Sheet>

      <Dialog open={!!confirmProject} onOpenChange={(open) => !open && setConfirmProject(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Open project?</DialogTitle>
            <DialogDescription>
              {confirmProject ? `Open “${confirmProject.name}” in Operator Workspace?` : 'Choose a project to open.'}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setConfirmProject(null)}>
              X
            </Button>
            <Button
              type="button"
              onClick={() => {
                if (!confirmProject) return;
                setConfirmProject(null);
                setOpenPreviousOpen(false);
                openProject(confirmProject);
              }}
            >
              Continue
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
