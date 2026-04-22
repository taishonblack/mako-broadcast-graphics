import { useNavigate } from 'react-router-dom';
import { mockProjects } from '@/lib/mock-data';
import { Project } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { PlusCircle, FolderOpen, Clock, Layers } from 'lucide-react';
import makoIllustration from '@/assets/mako-illustration.png';

export default function ProjectLauncher() {
  const navigate = useNavigate();
  const recentProjects = [...mockProjects].sort(
    (a, b) => new Date(b.lastOpenedAt).getTime() - new Date(a.lastOpenedAt).getTime()
  ).slice(0, 10);

  const currentProject = recentProjects[0];

  const openProject = (project: Project) => {
    localStorage.setItem('mako-active-project', project.id);
    navigate('/polls/new?mode=output');
  };

  const assignedBlockCount = (p: Project) => new Set(p.polls.map((poll) => poll.blockLetter).filter(Boolean)).size;
  const pollCount = (p: Project) => p.polls.length;

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <header className="h-14 border-b border-border flex items-center px-6 bg-card/50 shrink-0">
        <div className="flex items-center gap-2">
          <img src={makoIllustration} alt="MakoVote" className="h-6" />
          <span className="text-sm font-semibold text-foreground">
            <span>Mako</span>
            <span className="text-primary">Vote</span>
          </span>
        </div>
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
              <p className="text-[10px] text-muted-foreground font-mono uppercase">Current Project</p>
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
                      </div>
                      <div className="flex items-center gap-3 text-xs text-muted-foreground">
                         <span className="flex items-center gap-1 font-mono"><Layers className="w-3 h-3" />{assignedBlockCount(currentProject)} blocks</span>
                        <span className="font-mono">{pollCount(currentProject)} polls</span>
                        <FolderOpen className="w-4 h-4 text-primary" />
                      </div>
                    </div>
                  </button>
                </TooltipTrigger>
                <TooltipContent>Open this project and load its polls</TooltipContent>
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
              {recentProjects.map((project) => (
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
                        </div>
                        <div className="flex items-center gap-3 text-[10px] text-muted-foreground font-mono">
                           <span>{assignedBlockCount(project)} blocks · {pollCount(project)} polls</span>
                          <span>{new Date(project.lastOpenedAt).toLocaleDateString()}</span>
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
                <Button variant="outline" className="w-full gap-2 h-12" onClick={() => navigate('/polls/new')}>
                  <PlusCircle className="w-4 h-4" /> Create New Poll
                </Button>
              </TooltipTrigger>
              <TooltipContent>Create a new poll in Operator Workspace</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="outline" className="w-full gap-2 h-12" onClick={() => navigate('/polls/new?mode=build')}>
                  <FolderOpen className="w-4 h-4" /> New Project
                </Button>
              </TooltipTrigger>
                <TooltipContent>Create a new project in Operator Workspace</TooltipContent>
            </Tooltip>
          </div>
        </div>
      </div>
    </div>
  );
}
