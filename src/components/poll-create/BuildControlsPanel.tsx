import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { templateLabels } from '@/lib/mock-data';
import { TemplateName } from '@/lib/types';
import { Save, FolderOpen, Copy, Upload, FileDown, Palette } from 'lucide-react';

const templateOptions: TemplateName[] = [
  'horizontal-bar', 'vertical-bar', 'pie-donut', 'progress-bar',
  'puck-slider', 'fullscreen-hero', 'lower-third',
];

interface BuildControlsPanelProps {
  selectedTemplate: TemplateName;
  setSelectedTemplate: (t: TemplateName) => void;
  bgColor: string;
  setBgColor: (v: string) => void;
}

export function BuildControlsPanel({
  selectedTemplate, setSelectedTemplate,
  bgColor, setBgColor,
}: BuildControlsPanelProps) {
  return (
    <div className="h-full overflow-y-auto space-y-3 p-3">
      {/* Template Selection */}
      <div className="mako-panel p-4 space-y-3">
        <h2 className="text-xs font-semibold text-foreground uppercase tracking-wider">Template</h2>
        <div className="space-y-1">
          {templateOptions.map(t => (
            <Tooltip key={t}>
              <TooltipTrigger asChild>
                <button
                  onClick={() => setSelectedTemplate(t)}
                  className={`w-full text-left p-2 rounded-lg text-[10px] font-medium transition-all border ${
                    selectedTemplate === t
                      ? 'bg-primary/10 border-primary/30 text-primary'
                      : 'bg-accent/30 border-border/50 text-muted-foreground hover:bg-accent/50'
                  }`}
                >
                  {templateLabels[t]}
                </button>
              </TooltipTrigger>
              <TooltipContent side="left">Use {templateLabels[t]} layout for this poll</TooltipContent>
            </Tooltip>
          ))}
        </div>
      </div>

      {/* Background */}
      <div className="mako-panel p-4 space-y-3">
        <h2 className="text-xs font-semibold text-foreground uppercase tracking-wider">Background</h2>
        <div className="space-y-2.5">
          <div className="space-y-1">
            <Label className="text-[10px] text-muted-foreground">Color</Label>
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-md border border-border" style={{ backgroundColor: bgColor || 'hsl(220, 20%, 10%)' }} />
              <Input value={bgColor} onChange={e => setBgColor(e.target.value)} placeholder="#1a1a2e" className="bg-background/50 h-7 text-[10px] font-mono flex-1" />
            </div>
          </div>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="outline" size="sm" className="w-full gap-1.5 text-[10px] h-7">
                <Upload className="w-3 h-3" /> Upload Background Image
              </Button>
            </TooltipTrigger>
            <TooltipContent>Upload a custom background image for this poll</TooltipContent>
          </Tooltip>
        </div>
      </div>

      {/* Draft Actions */}
      <div className="mako-panel p-4 space-y-3">
        <h2 className="text-xs font-semibold text-foreground uppercase tracking-wider">Actions</h2>
        <div className="space-y-1.5">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="outline" size="sm" className="w-full justify-start gap-1.5 text-[10px] h-7">
                <Save className="w-3 h-3" /> Save Draft
              </Button>
            </TooltipTrigger>
            <TooltipContent side="left">Save current work as a draft</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="outline" size="sm" className="w-full justify-start gap-1.5 text-[10px] h-7">
                <FolderOpen className="w-3 h-3" /> Save to Project
              </Button>
            </TooltipTrigger>
            <TooltipContent side="left">Save poll into the current project queue</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="outline" size="sm" className="w-full justify-start gap-1.5 text-[10px] h-7">
                <FolderOpen className="w-3 h-3" /> Load Previous Poll
              </Button>
            </TooltipTrigger>
            <TooltipContent side="left">Open an existing poll for editing</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="outline" size="sm" className="w-full justify-start gap-1.5 text-[10px] h-7">
                <FileDown className="w-3 h-3" /> Import from Project
              </Button>
            </TooltipTrigger>
            <TooltipContent side="left">Import a poll from another project</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="outline" size="sm" className="w-full justify-start gap-1.5 text-[10px] h-7">
                <Copy className="w-3 h-3" /> Duplicate Draft
              </Button>
            </TooltipTrigger>
            <TooltipContent side="left">Create a copy of this draft</TooltipContent>
          </Tooltip>
        </div>
      </div>
    </div>
  );
}
