import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { templateLabels } from '@/lib/mock-data';
import { TemplateName } from '@/lib/types';
import { Save, FolderOpen, Copy, Upload, FileDown, X } from 'lucide-react';
import { useRef } from 'react';

const templateOptions: TemplateName[] = [
  'horizontal-bar', 'vertical-bar', 'pie-donut', 'progress-bar',
  'puck-slider', 'lower-third',
];

interface BuildControlsPanelProps {
  selectedTemplate: TemplateName;
  setSelectedTemplate: (t: TemplateName) => void;
  bgColor: string;
  setBgColor: (v: string) => void;
  bgImage?: string;
  setBgImage: (v: string | undefined) => void;
  /** Render only one section. Defaults to 'all' for backward-compat. */
  section?: 'all' | 'template' | 'background' | 'actions';
}

export function BuildControlsPanel({
  selectedTemplate, setSelectedTemplate,
  bgColor, setBgColor,
  bgImage, setBgImage,
  section = 'all',
}: BuildControlsPanelProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      alert('Please select a JPG, PNG, or WebP image');
      return;
    }
    const reader = new FileReader();
    reader.onload = (ev) => setBgImage(ev.target?.result as string);
    reader.readAsDataURL(file);
  };

  const Template = (
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
              <TooltipContent side="left">
                {t === 'lower-third'
                  ? 'Anchored bottom banner — leaves the top of frame clear for camera footage'
                  : `Full-frame ${templateLabels[t]} broadcast composition`}
              </TooltipContent>
            </Tooltip>
          ))}
        </div>
      </div>
  );

  const Background = (
      <div className="mako-panel p-4 space-y-3">
        <h2 className="text-xs font-semibold text-foreground uppercase tracking-wider">Background</h2>
        <div className="space-y-2.5">
          <div className="space-y-1">
            <Label className="text-[10px] text-muted-foreground">Color</Label>
            <div className="flex items-center gap-2">
              <input
                type="color"
                value={bgColor || '#1a1a2e'}
                onChange={e => setBgColor(e.target.value)}
                className="w-7 h-7 rounded-md border border-border bg-transparent cursor-pointer p-0"
                aria-label="Background color picker"
              />
              <Input
                value={bgColor}
                onChange={e => setBgColor(e.target.value)}
                placeholder="#1a1a2e"
                className="bg-background/50 h-7 text-[10px] font-mono flex-1"
              />
            </div>
          </div>
          <div className="space-y-1">
            <Label className="text-[10px] text-muted-foreground">Background Image</Label>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              onChange={handleFileSelect}
              className="hidden"
            />
            {bgImage ? (
              <div className="space-y-1.5">
                <div className="relative w-full h-16 rounded-md overflow-hidden border border-border">
                  <img src={bgImage} alt="Background preview" className="w-full h-full object-cover" />
                  <button
                    onClick={() => setBgImage(undefined)}
                    className="absolute top-1 right-1 w-5 h-5 rounded-full bg-background/80 flex items-center justify-center hover:bg-destructive/80 transition-colors"
                    aria-label="Remove background image"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
                <Button
                  variant="outline" size="sm"
                  onClick={() => fileInputRef.current?.click()}
                  className="w-full gap-1.5 text-[10px] h-7"
                >
                  <Upload className="w-3 h-3" /> Replace Image
                </Button>
              </div>
            ) : (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="outline" size="sm"
                    onClick={() => fileInputRef.current?.click()}
                    className="w-full gap-1.5 text-[10px] h-7"
                  >
                    <Upload className="w-3 h-3" /> Upload Background Image
                  </Button>
                </TooltipTrigger>
                <TooltipContent>JPG, PNG, or WebP — appears live in preview</TooltipContent>
              </Tooltip>
            )}
          </div>
        </div>
      </div>
  );

  const Actions = (
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
  );

  if (section === 'template') return <div className="p-3">{Template}</div>;
  if (section === 'background') return <div className="p-3">{Background}</div>;
  if (section === 'actions') return <div className="p-3">{Actions}</div>;

  return (
    <div className="h-full overflow-y-auto space-y-3 p-3">
      {Template}
      {Background}
      {Actions}
    </div>
  );
}
