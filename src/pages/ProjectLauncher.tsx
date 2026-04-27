import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { createProject, deleteProject, listProjects, markProjectLastUsed, renameProject } from '@/lib/poll-persistence';
import {
  MAX_PROJECT_TAG_COUNT,
  MAX_PROJECT_TAG_LENGTH,
  normalizeProjectTags,
  projectCreateSchema,
  projectRenameSchema,
  projectTagSchema,
} from '@/lib/project-validation';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
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
import { Input } from '@/components/ui/input';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { toast } from 'sonner';
import { Clock, FolderOpen, Pencil, Plus, Search, Settings, Tag, Trash2, X } from 'lucide-react';
import makoIllustration from '@/assets/mako-illustration.png';

type ProjectRecord = {
  id: string;
  name: string;
  description: string | null;
  tags: string[];
  created_at: string;
  updated_at: string;
  last_used_at: string;
  project_date: string;
};

const STARTER_TAGS = ['morning show', 'asl', 'animated'];

const sortProjectsByLastUsed = (items: ProjectRecord[]) => (
  [...items].sort((a, b) => new Date(b.last_used_at).getTime() - new Date(a.last_used_at).getTime())
);

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
  const [searchName, setSearchName] = useState('');
  const [searchTags, setSearchTags] = useState<string[]>([]);
  const [creating, setCreating] = useState(false);
  const [renameTarget, setRenameTarget] = useState<ProjectRecord | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const [renaming, setRenaming] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<ProjectRecord | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [nameError, setNameError] = useState<string | null>(null);
  const [tagError, setTagError] = useState<string | null>(null);
  const [guidedDialogShown, setGuidedDialogShown] = useState(false);
  // Pending "switch project" intent — when an operator already has a project
  // open and clicks New Project / Open Existing, we surface a confirm dialog
  // so they don't accidentally close their current workspace.
  const [pendingSwitch, setPendingSwitch] = useState<
    | { kind: 'new' }
    | { kind: 'openExisting' }
    | { kind: 'open'; project: Pick<ProjectRecord, 'id' | 'name'> }
    | null
  >(null);

  const activeProjectId = typeof window !== 'undefined'
    ? localStorage.getItem('mako-active-project')
    : null;
  const activeProject = useMemo(
    () => projects.find((p) => p.id === activeProjectId) ?? null,
    [projects, activeProjectId],
  );

  const loadProjects = async () => {
    if (!user) return;

    setLoading(true);
    try {
      const items = await listProjects();
      setProjects(sortProjectsByLastUsed((items as ProjectRecord[]) ?? []));
    } catch (error) {
      toast.error(`Could not load projects: ${(error as Error).message}`);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadProjects();
  }, [user]);

  useEffect(() => {
    if (!loading && projects.length === 0 && !guidedDialogShown) {
      setNewProjectOpen(true);
      setGuidedDialogShown(true);
    }
  }, [guidedDialogShown, loading, projects.length]);

  const recentProjects = useMemo(() => projects.slice(0, 10), [projects]);

  const currentProject = recentProjects[0];

  const availableTags = useMemo(
    () => Array.from(new Set([...STARTER_TAGS, ...projects.flatMap((project) => project.tags ?? [])])).sort(),
    [projects],
  );

  const filteredProjects = useMemo(() => {
    const term = searchName.trim().toLowerCase();

    return projects.filter((project) => {
      const nameMatches = term.length === 0
        ? true
        : [project.name, project.description ?? ''].join(' ').toLowerCase().includes(term);
      const tagMatches = searchTags.length === 0
        ? true
        : searchTags.every((tag) => project.tags.includes(tag));

      return nameMatches && tagMatches;
    });
  }, [projects, searchName, searchTags]);

  const resetNewProjectForm = () => {
    setNewProjectName('');
    setNewTag('');
    setSelectedTags([]);
    setNameError(null);
    setTagError(null);
  };

  const openProject = async (project: Pick<ProjectRecord, 'id' | 'name'>) => {
    try {
      const updated = await markProjectLastUsed(project.id);
      setProjects((current) => sortProjectsByLastUsed(current.map((item) => (
        item.id === project.id ? { ...item, last_used_at: updated.last_used_at } : item
      ))));
    } catch (error) {
      toast.error(`Could not update last used time: ${(error as Error).message}`);
    }

    localStorage.setItem('mako-active-project', project.id);
    navigate('/polls/new?mode=build');
  };

  /** Wraps an action with a "close current project?" confirmation when there
   *  is already an active project distinct from the target. Used by both the
   *  New Project trigger and the Open Existing buttons. */
  const guardProjectSwitch = (
    action: () => void,
    target?: Pick<ProjectRecord, 'id'>,
  ) => {
    if (!activeProject || (target && target.id === activeProject.id)) {
      action();
      return;
    }
    if (target) {
      setPendingSwitch({ kind: 'open', project: target as ProjectRecord });
    } else {
      setPendingSwitch({ kind: 'new' });
    }
  };

  const confirmPendingSwitch = () => {
    const intent = pendingSwitch;
    setPendingSwitch(null);
    if (!intent) return;
    if (intent.kind === 'new') {
      setNewProjectOpen(true);
    } else if (intent.kind === 'openExisting') {
      setOpenPreviousOpen(true);
    } else if (intent.kind === 'open') {
      void openProject(intent.project);
    }
  };

  const addTag = (value: string) => {
    const parsed = projectTagSchema.safeParse(value);
    if (!parsed.success) {
      setTagError(parsed.error.issues[0]?.message ?? 'Invalid tag');
      return;
    }

    const nextTags = normalizeProjectTags([...selectedTags, parsed.data]);
    if (nextTags.length === selectedTags.length) {
      setTagError('That tag has already been added');
      return;
    }

    if (nextTags.length > MAX_PROJECT_TAG_COUNT) {
      setTagError(`Projects can have at most ${MAX_PROJECT_TAG_COUNT} tags`);
      return;
    }

    setSelectedTags(nextTags);
    setNewTag('');
    setTagError(null);
  };

  const removeTag = (value: string) => {
    setSelectedTags((current) => current.filter((tag) => tag !== value));
  };

  const toggleSearchTag = (value: string) => {
    setSearchTags((current) => current.includes(value)
      ? current.filter((tag) => tag !== value)
      : [...current, value]);
  };

  const handleCreateProject = async () => {
    if (!user) return;

    const parsed = projectCreateSchema.safeParse({ name: newProjectName, tags: selectedTags });
    if (!parsed.success) {
      const firstIssue = parsed.error.issues[0];
      if (firstIssue?.path[0] === 'name') {
        setNameError(firstIssue.message);
      } else {
        setTagError(firstIssue?.message ?? 'Invalid project details');
      }
      return;
    }

    setCreating(true);
    try {
      const created = await createProject(parsed.data.name, user.id, parsed.data.tags);
      const nextProject = created as ProjectRecord;
      setProjects((current) => sortProjectsByLastUsed([nextProject, ...current]));
      setNewProjectOpen(false);
      resetNewProjectForm();
      toast.success(`Project "${nextProject.name}" created`);
      await openProject(nextProject);
    } catch (error) {
      toast.error(`Could not create project: ${(error as Error).message}`);
    } finally {
      setCreating(false);
    }
  };

  const handleRenameProject = async () => {
    if (!renameTarget) return;

    const parsed = projectRenameSchema.safeParse({ name: renameValue });
    if (!parsed.success) {
      toast.error(parsed.error.issues[0]?.message ?? 'Invalid project name');
      return;
    }

    setRenaming(true);
    try {
      const updated = await renameProject(renameTarget.id, parsed.data.name);
      setProjects((current) => current.map((project) => (
        project.id === renameTarget.id ? { ...project, ...(updated as Partial<ProjectRecord>) } : project
      )));
      toast.success(`Renamed to "${parsed.data.name}"`);
      setRenameTarget(null);
      setRenameValue('');
    } catch (error) {
      toast.error(`Could not rename project: ${(error as Error).message}`);
    } finally {
      setRenaming(false);
    }
  };

  const handleDeleteProject = async () => {
    if (!deleteTarget) return;

    setDeleting(true);
    try {
      await deleteProject(deleteTarget.id);
      setProjects((current) => current.filter((project) => project.id !== deleteTarget.id));
      toast.success(`Deleted "${deleteTarget.name}"`);
      setDeleteTarget(null);
      if (confirmProject?.id === deleteTarget.id) {
        setConfirmProject(null);
      }
    } catch (error) {
      toast.error(`Could not delete project: ${(error as Error).message}`);
    } finally {
      setDeleting(false);
    }
  };

  const renderProjectActions = (project: ProjectRecord) => (
    <div className="flex items-center gap-1">
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={(event) => {
              event.stopPropagation();
              setRenameTarget(project);
              setRenameValue(project.name);
            }}
            aria-label={`Rename ${project.name}`}
          >
            <Pencil className="w-4 h-4" />
          </Button>
        </TooltipTrigger>
        <TooltipContent>Rename project</TooltipContent>
      </Tooltip>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={(event) => {
              event.stopPropagation();
              setDeleteTarget(project);
            }}
            aria-label={`Delete ${project.name}`}
          >
            <Trash2 className="w-4 h-4" />
          </Button>
        </TooltipTrigger>
        <TooltipContent>Delete project</TooltipContent>
      </Tooltip>
    </div>
  );

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
            <p className="text-sm text-muted-foreground mt-1">Create, reopen, rename, and organize your project library.</p>
          </div>

          {!loading && projects.length === 0 && (
            <div className="mako-panel border border-dashed border-border p-8 text-center space-y-4">
              <div className="space-y-2">
                <h2 className="text-lg font-semibold text-foreground">Start your first project</h2>
                <p className="text-sm text-muted-foreground max-w-md mx-auto">
                  Create a project first, then open it in Operator Workspace. Tags like morning show, asl, and animated help you find it faster later.
                </p>
              </div>
              <Button onClick={() => guardProjectSwitch(() => setNewProjectOpen(true))} className="gap-2">
                <Plus className="w-4 h-4" /> New Project
              </Button>
            </div>
          )}

          {/* Current Project */}
          {currentProject && (
            <div className="mako-panel p-5 space-y-3">
              <p className="text-[10px] text-muted-foreground font-mono uppercase">Last Used</p>
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    onClick={() => guardProjectSwitch(() => openProject(currentProject), currentProject)}
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
                        <div className="text-right">
                          <div className="font-mono">{new Date(currentProject.last_used_at).toLocaleDateString()}</div>
                          <div className="text-[10px] uppercase tracking-wide">Last used</div>
                        </div>
                        <FolderOpen className="w-4 h-4 text-primary" />
                        {renderProjectActions(currentProject)}
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
                      onClick={() => guardProjectSwitch(() => openProject(project), project)}
                      className="w-full text-left p-3 rounded-xl border border-border/50 hover:bg-accent/30 transition-colors"
                    >
                      <div className="flex items-center justify-between">
                        <div className="min-w-0">
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
                          <span>{new Date(project.last_used_at).toLocaleDateString()}</span>
                          {renderProjectActions(project)}
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
                <Button variant="outline" className="w-full gap-2 h-12" onClick={() => guardProjectSwitch(() => setNewProjectOpen(true))}>
                  <Plus className="w-4 h-4" /> New Project
                </Button>
              </TooltipTrigger>
              <TooltipContent>Create a project before entering Operator Workspace</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="outline" className="w-full gap-2 h-12" onClick={() => activeProject ? setPendingSwitch({ kind: 'openExisting' }) : setOpenPreviousOpen(true)}>
                  <FolderOpen className="w-4 h-4" /> Open Previous Project
                </Button>
              </TooltipTrigger>
                <TooltipContent>Browse every project saved to this account</TooltipContent>
            </Tooltip>
          </div>
        </div>
      </div>

      <div className="absolute bottom-6 left-6">
        <Button asChild variant="ghost" size="icon" aria-label="Settings">
          <Link to="/settings">
          <Settings className="w-5 h-5" />
          </Link>
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
                onChange={(event) => {
                  setNewProjectName(event.target.value);
                  setNameError(null);
                }}
                placeholder="Project or Show"
                autoFocus
              />
              <p className="text-[11px] text-muted-foreground">Up to 80 characters.</p>
              {nameError && <p className="text-[11px] text-destructive">{nameError}</p>}
            </div>

            <div className="space-y-2">
              <p className="text-xs font-medium text-muted-foreground">Tags</p>
              <div className="flex gap-2">
                <Input
                  value={newTag}
                  onChange={(event) => {
                    setNewTag(event.target.value);
                    setTagError(null);
                  }}
                  placeholder="tag name"
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
              <p className="text-[11px] text-muted-foreground">Up to {MAX_PROJECT_TAG_COUNT} tags, {MAX_PROJECT_TAG_LENGTH} characters each.</p>
              {tagError && <p className="text-[11px] text-destructive">{tagError}</p>}

              {availableTags.length > 0 && (
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-[11px] font-mono uppercase text-muted-foreground">
                    <Tag className="w-3 h-3" /> Suggestions
                  </div>
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
            <div className="space-y-3">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 w-4 h-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={searchName}
                  onChange={(event) => setSearchName(event.target.value)}
                  placeholder="Filter by project name"
                  className="pl-9"
                />
              </div>

              <div className="space-y-2">
                <div className="text-[11px] font-mono uppercase text-muted-foreground">Filter by tags</div>
                <div className="flex flex-wrap gap-2">
                  {availableTags.map((tag) => {
                    const active = searchTags.includes(tag);
                    return (
                      <button
                        key={tag}
                        type="button"
                        onClick={() => toggleSearchTag(tag)}
                        className={`rounded-full border px-3 py-1 text-[11px] font-mono uppercase transition-colors ${active ? 'border-primary bg-primary/10 text-primary' : 'border-border text-muted-foreground hover:bg-accent'}`}
                      >
                        {tag}
                      </button>
                    );
                  })}
                </div>
              </div>

              {(searchName || searchTags.length > 0) && (
                <div className="flex items-center justify-between rounded-lg border border-border bg-card/40 px-3 py-2 text-xs text-muted-foreground">
                  <span>{filteredProjects.length} matching projects</span>
                  <Button type="button" variant="ghost" size="sm" onClick={() => { setSearchName(''); setSearchTags([]); }}>
                    Clear filters
                  </Button>
                </div>
              )}
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
                        <div>Last used</div>
                        <div>{new Date(project.last_used_at).toLocaleDateString()}</div>
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

      <Dialog open={!!renameTarget} onOpenChange={(open) => !open && setRenameTarget(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Rename project</DialogTitle>
            <DialogDescription>
              {renameTarget ? `Update the name for “${renameTarget.name}”.` : 'Rename this project.'}
            </DialogDescription>
          </DialogHeader>
          <Input value={renameValue} onChange={(event) => setRenameValue(event.target.value)} placeholder="Project name" autoFocus />
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setRenameTarget(null)}>Cancel</Button>
            <Button type="button" onClick={handleRenameProject} disabled={renaming}>{renaming ? 'Saving…' : 'Save'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Delete project?</DialogTitle>
            <DialogDescription>
              {deleteTarget ? `This will remove “${deleteTarget.name}”. This action cannot be undone.` : 'Delete this project.'}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setDeleteTarget(null)}>Cancel</Button>
            <Button type="button" variant="destructive" onClick={handleDeleteProject} disabled={deleting}>{deleting ? 'Deleting…' : 'Delete'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!pendingSwitch} onOpenChange={(open) => !open && setPendingSwitch(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Close current project?</AlertDialogTitle>
            <AlertDialogDescription>
              {activeProject
                ? `“${activeProject.name}” is currently open. ${
                    pendingSwitch?.kind === 'open'
                      ? `Open “${pendingSwitch.project.name}” instead?`
                      : pendingSwitch?.kind === 'new'
                        ? 'Start a new project and close this one?'
                        : 'Open another project and close this one?'
                  }`
                : 'Switch projects?'}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setPendingSwitch(null)}>Keep current</AlertDialogCancel>
            <AlertDialogAction onClick={confirmPendingSwitch}>
              {pendingSwitch?.kind === 'new' ? 'Start new project' : 'Switch'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
