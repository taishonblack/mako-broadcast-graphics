import { useState } from 'react';
import { BroadcastPreviewFrame } from '@/components/broadcast/BroadcastPreviewFrame';
import { FullscreenScene } from '@/components/broadcast/scenes/FullscreenScene';
import { LowerThirdScene } from '@/components/broadcast/scenes/LowerThirdScene';
import { QRScene } from '@/components/broadcast/scenes/QRScene';
import { ResultsScene } from '@/components/broadcast/scenes/ResultsScene';
import { ResizablePanelGroup, ResizablePanel, ResizableHandle } from '@/components/ui/resizable';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { AssetControls } from '@/components/broadcast/AssetControls';
import { themePresets } from '@/lib/themes';
import { templateLabels } from '@/lib/mock-data';
import { Poll, PollOption, QRPosition, TemplateName, ThemePreset } from '@/lib/types';
import { SceneType } from '@/lib/scenes';
import {
  Type, AlignLeft, AlignCenter, AlignRight, Bold, Italic,
  CaseSensitive, Save, Send, GripVertical, Plus, Trash2
} from 'lucide-react';

interface GraphicsWorkspaceProps {
  poll: Poll;
  previewScene: SceneType;
  qrSize: number;
  qrPosition: QRPosition;
  showBranding: boolean;
  brandingPosition: QRPosition;
  onQrSizeChange: (size: number) => void;
  onQrPositionChange: (pos: QRPosition) => void;
  onShowBrandingChange: (show: boolean) => void;
  onBrandingPositionChange: (pos: QRPosition) => void;
  onApplyToProgram: (draft: DraftState) => void;
}

export interface DraftState {
  question: string;
  options: PollOption[];
  template: TemplateName;
  themeId: string;
  fontSize: number;
  answerFontSize: number;
  percentFontSize: number;
  fontWeight: 'normal' | 'bold';
  fontStyle: 'normal' | 'italic';
  textTransform: 'none' | 'uppercase';
  textAlign: 'left' | 'center' | 'right';
  letterSpacing: number;
  lineHeight: number;
}

const templateOptions: TemplateName[] = [
  'horizontal-bar', 'vertical-bar', 'pie-donut', 'progress-bar',
  'puck-slider', 'fullscreen-hero', 'lower-third',
];

export function GraphicsWorkspace({
  poll,
  previewScene,
  qrSize,
  qrPosition,
  showBranding,
  brandingPosition,
  onQrSizeChange,
  onQrPositionChange,
  onShowBrandingChange,
  onBrandingPositionChange,
  onApplyToProgram,
}: GraphicsWorkspaceProps) {
  const [viewMode, setViewMode] = useState<'draft' | 'program'>('draft');
  const [draft, setDraft] = useState<DraftState>({
    question: poll.question,
    options: [...poll.options],
    template: poll.template,
    themeId: poll.themeId,
    fontSize: 24,
    answerFontSize: 14,
    percentFontSize: 16,
    fontWeight: 'bold',
    fontStyle: 'normal',
    textTransform: 'none',
    textAlign: 'center',
    letterSpacing: 0,
    lineHeight: 1.3,
  });
  const [selectedTheme, setSelectedTheme] = useState<ThemePreset>(
    themePresets.find(t => t.id === poll.themeId) || themePresets[0]
  );
  const [isDirty, setIsDirty] = useState(false);

  const updateDraft = (changes: Partial<DraftState>) => {
    setDraft(prev => ({ ...prev, ...changes }));
    setIsDirty(true);
  };

  const updateOption = (index: number, changes: Partial<PollOption>) => {
    const newOptions = draft.options.map((o, i) => i === index ? { ...o, ...changes } : o);
    updateDraft({ options: newOptions });
  };

  const addOption = () => {
    const newOpt: PollOption = {
      id: `opt-new-${Date.now()}`,
      text: `Option ${draft.options.length + 1}`,
      shortLabel: `O${draft.options.length + 1}`,
      votes: 0,
      order: draft.options.length,
    };
    updateDraft({ options: [...draft.options, newOpt] });
  };

  const removeOption = (index: number) => {
    if (draft.options.length <= 2) return;
    updateDraft({ options: draft.options.filter((_, i) => i !== index) });
  };

  const handleApply = () => {
    onApplyToProgram(draft);
    setIsDirty(false);
  };

  const colors = [selectedTheme.chartColorA, selectedTheme.chartColorB, selectedTheme.chartColorC, selectedTheme.chartColorD];

  const renderScene = () => {
    const displayQuestion = viewMode === 'draft' ? draft.question : poll.question;
    const displayOptions = viewMode === 'draft' ? draft.options : poll.options;
    const totalVotes = displayOptions.reduce((sum, o) => sum + o.votes, 0);

    switch (previewScene) {
      case 'lowerThird':
        return <LowerThirdScene question={displayQuestion} options={displayOptions} totalVotes={totalVotes} colors={colors} theme={selectedTheme} />;
      case 'qr':
        return <QRScene slug={poll.slug} theme={selectedTheme} />;
      case 'results':
        return <ResultsScene question={displayQuestion} options={displayOptions} totalVotes={totalVotes} colors={colors} theme={selectedTheme} />;
      default:
        return <FullscreenScene question={displayQuestion} options={displayOptions} totalVotes={totalVotes} colors={colors} theme={selectedTheme} />;
    }
  };

  return (
    <div className="h-[calc(100vh-3.5rem)] overflow-hidden">
      <ResizablePanelGroup direction="horizontal" className="h-full">
        {/* Left Panel — Content + Typography */}
        <ResizablePanel defaultSize={24} minSize={18} maxSize={35} className="p-3">
          <div className="h-full overflow-auto space-y-1">
            <Tabs defaultValue="content" className="w-full">
              <TabsList className="w-full h-8 bg-muted/50">
                <TabsTrigger value="content" className="text-[10px] flex-1">Content</TabsTrigger>
                <TabsTrigger value="typography" className="text-[10px] flex-1">Typography</TabsTrigger>
              </TabsList>

              <TabsContent value="content" className="mt-2 space-y-3">
                {/* Question */}
                <div className="space-y-1.5">
                  <Label className="text-[10px] text-muted-foreground font-mono uppercase">Question</Label>
                  <textarea
                    value={draft.question}
                    onChange={(e) => updateDraft({ question: e.target.value })}
                    className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring min-h-[60px] resize-none"
                  />
                </div>

                {/* Answers */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <Label className="text-[10px] text-muted-foreground font-mono uppercase">Answers</Label>
                    <button onClick={addOption} className="text-primary hover:text-primary/80 transition-colors">
                      <Plus className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  <div className="space-y-1.5">
                    {draft.options.map((opt, i) => (
                      <div key={opt.id} className="flex items-center gap-1.5 group">
                        <GripVertical className="w-3 h-3 text-muted-foreground/40 shrink-0" />
                        <Input
                          value={opt.text}
                          onChange={(e) => updateOption(i, { text: e.target.value })}
                          className="h-8 text-xs flex-1"
                          placeholder="Answer text"
                        />
                        <Input
                          value={opt.shortLabel || ''}
                          onChange={(e) => updateOption(i, { shortLabel: e.target.value })}
                          className="h-8 text-xs w-14"
                          placeholder="Label"
                        />
                        <button
                          onClick={() => removeOption(i)}
                          className="text-muted-foreground/40 hover:text-destructive transition-colors opacity-0 group-hover:opacity-100"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Template */}
                <div className="space-y-1.5">
                  <Label className="text-[10px] text-muted-foreground font-mono uppercase">Template</Label>
                  <div className="space-y-1">
                    {templateOptions.map(t => (
                      <button
                        key={t}
                        onClick={() => updateDraft({ template: t })}
                        className={`w-full text-left p-2 rounded-lg text-[11px] transition-all border ${
                          draft.template === t
                            ? 'bg-primary/10 border-primary/30 text-primary'
                            : 'bg-accent/30 border-border/50 text-muted-foreground hover:bg-accent/50'
                        }`}
                      >
                        {templateLabels[t]}
                      </button>
                    ))}
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="typography" className="mt-2 space-y-3">
                {/* Font Size */}
                <div className="space-y-1.5">
                  <Label className="text-[10px] text-muted-foreground font-mono uppercase">Question Size</Label>
                  <div className="flex items-center gap-2">
                    <Slider value={[draft.fontSize]} onValueChange={([v]) => updateDraft({ fontSize: v })} min={14} max={48} step={1} className="flex-1" />
                    <span className="text-[10px] text-muted-foreground font-mono w-8">{draft.fontSize}px</span>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label className="text-[10px] text-muted-foreground font-mono uppercase">Answer Size</Label>
                  <div className="flex items-center gap-2">
                    <Slider value={[draft.answerFontSize]} onValueChange={([v]) => updateDraft({ answerFontSize: v })} min={10} max={32} step={1} className="flex-1" />
                    <span className="text-[10px] text-muted-foreground font-mono w-8">{draft.answerFontSize}px</span>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label className="text-[10px] text-muted-foreground font-mono uppercase">Percent Size</Label>
                  <div className="flex items-center gap-2">
                    <Slider value={[draft.percentFontSize]} onValueChange={([v]) => updateDraft({ percentFontSize: v })} min={10} max={36} step={1} className="flex-1" />
                    <span className="text-[10px] text-muted-foreground font-mono w-8">{draft.percentFontSize}px</span>
                  </div>
                </div>

                {/* Weight / Style / Transform */}
                <div className="space-y-1.5">
                  <Label className="text-[10px] text-muted-foreground font-mono uppercase">Style</Label>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => updateDraft({ fontWeight: draft.fontWeight === 'bold' ? 'normal' : 'bold' })}
                      className={`w-8 h-8 rounded-md flex items-center justify-center transition-colors border ${
                        draft.fontWeight === 'bold' ? 'bg-primary/20 border-primary/30 text-primary' : 'bg-muted border-border text-muted-foreground'
                      }`}
                    >
                      <Bold className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => updateDraft({ fontStyle: draft.fontStyle === 'italic' ? 'normal' : 'italic' })}
                      className={`w-8 h-8 rounded-md flex items-center justify-center transition-colors border ${
                        draft.fontStyle === 'italic' ? 'bg-primary/20 border-primary/30 text-primary' : 'bg-muted border-border text-muted-foreground'
                      }`}
                    >
                      <Italic className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => updateDraft({ textTransform: draft.textTransform === 'uppercase' ? 'none' : 'uppercase' })}
                      className={`w-8 h-8 rounded-md flex items-center justify-center transition-colors border ${
                        draft.textTransform === 'uppercase' ? 'bg-primary/20 border-primary/30 text-primary' : 'bg-muted border-border text-muted-foreground'
                      }`}
                    >
                      <CaseSensitive className="w-3.5 h-3.5" />
                    </button>
                    <div className="w-px h-6 bg-border mx-1" />
                    <button
                      onClick={() => updateDraft({ textAlign: 'left' })}
                      className={`w-8 h-8 rounded-md flex items-center justify-center transition-colors border ${
                        draft.textAlign === 'left' ? 'bg-primary/20 border-primary/30 text-primary' : 'bg-muted border-border text-muted-foreground'
                      }`}
                    >
                      <AlignLeft className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => updateDraft({ textAlign: 'center' })}
                      className={`w-8 h-8 rounded-md flex items-center justify-center transition-colors border ${
                        draft.textAlign === 'center' ? 'bg-primary/20 border-primary/30 text-primary' : 'bg-muted border-border text-muted-foreground'
                      }`}
                    >
                      <AlignCenter className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => updateDraft({ textAlign: 'right' })}
                      className={`w-8 h-8 rounded-md flex items-center justify-center transition-colors border ${
                        draft.textAlign === 'right' ? 'bg-primary/20 border-primary/30 text-primary' : 'bg-muted border-border text-muted-foreground'
                      }`}
                    >
                      <AlignRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {/* Letter Spacing */}
                <div className="space-y-1.5">
                  <Label className="text-[10px] text-muted-foreground font-mono uppercase">Letter Spacing</Label>
                  <div className="flex items-center gap-2">
                    <Slider value={[draft.letterSpacing]} onValueChange={([v]) => updateDraft({ letterSpacing: v })} min={-2} max={8} step={0.5} className="flex-1" />
                    <span className="text-[10px] text-muted-foreground font-mono w-8">{draft.letterSpacing}px</span>
                  </div>
                </div>

                {/* Line Height */}
                <div className="space-y-1.5">
                  <Label className="text-[10px] text-muted-foreground font-mono uppercase">Line Height</Label>
                  <div className="flex items-center gap-2">
                    <Slider value={[draft.lineHeight * 10]} onValueChange={([v]) => updateDraft({ lineHeight: v / 10 })} min={8} max={24} step={1} className="flex-1" />
                    <span className="text-[10px] text-muted-foreground font-mono w-8">{draft.lineHeight.toFixed(1)}</span>
                  </div>
                </div>
              </TabsContent>
            </Tabs>
          </div>
        </ResizablePanel>

        <ResizableHandle withHandle />

        {/* Center — Draft / Program Preview */}
        <ResizablePanel defaultSize={52} minSize={35}>
          <div className="h-full overflow-auto p-3 space-y-3">
            {/* Draft / Program toggle + Apply */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1 bg-muted/50 rounded-lg p-0.5">
                <button
                  onClick={() => setViewMode('draft')}
                  className={`px-3 py-1.5 rounded-md text-[11px] font-medium transition-colors ${
                    viewMode === 'draft' ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  Draft
                </button>
                <button
                  onClick={() => setViewMode('program')}
                  className={`px-3 py-1.5 rounded-md text-[11px] font-medium transition-colors ${
                    viewMode === 'program' ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  Program
                </button>
              </div>
              <div className="flex items-center gap-2">
                {isDirty && (
                  <span className="text-[10px] text-[hsl(var(--mako-warning))] font-mono animate-pulse">
                    UNSAVED CHANGES
                  </span>
                )}
                <Button variant="outline" size="sm" className="gap-1.5 text-xs h-7" onClick={() => { setDraft({ ...draft, question: poll.question, options: [...poll.options] }); setIsDirty(false); }}>
                  <Save className="w-3 h-3" /> Reset
                </Button>
                <Button size="sm" className="gap-1.5 text-xs h-7" onClick={handleApply} disabled={!isDirty}>
                  <Send className="w-3 h-3" /> Apply to Program
                </Button>
              </div>
            </div>

            {/* Preview Frame */}
            <BroadcastPreviewFrame showLabel>
              {renderScene()}
            </BroadcastPreviewFrame>

            {/* Asset Controls */}
            <div className="mako-panel p-3">
              <p className="text-[10px] text-muted-foreground font-mono uppercase mb-2">Output Assets</p>
              <AssetControls
                qrSize={qrSize}
                qrPosition={qrPosition}
                showBranding={showBranding}
                brandingPosition={brandingPosition}
                onQrSizeChange={onQrSizeChange}
                onQrPositionChange={onQrPositionChange}
                onShowBrandingChange={onShowBrandingChange}
                onBrandingPositionChange={onBrandingPositionChange}
              />
            </div>
          </div>
        </ResizablePanel>

        <ResizableHandle withHandle />

        {/* Right Panel — Style + Layout */}
        <ResizablePanel defaultSize={24} minSize={16} maxSize={32} className="p-3">
          <div className="h-full overflow-auto space-y-1">
            <Tabs defaultValue="style" className="w-full">
              <TabsList className="w-full h-8 bg-muted/50">
                <TabsTrigger value="style" className="text-[10px] flex-1">Style</TabsTrigger>
                <TabsTrigger value="layout" className="text-[10px] flex-1">Layout</TabsTrigger>
              </TabsList>

              <TabsContent value="style" className="mt-2 space-y-3">
                {/* Theme Presets */}
                <div className="space-y-1.5">
                  <Label className="text-[10px] text-muted-foreground font-mono uppercase">Theme</Label>
                  <div className="space-y-1">
                    {themePresets.map(theme => (
                      <button
                        key={theme.id}
                        onClick={() => { setSelectedTheme(theme); setIsDirty(true); }}
                        className={`w-full text-left p-2 rounded-lg text-[11px] transition-all border ${
                          selectedTheme.id === theme.id
                            ? 'bg-primary/10 border-primary/30 text-primary'
                            : 'bg-accent/30 border-border/50 text-muted-foreground hover:bg-accent/50'
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <div className="w-3.5 h-3.5 rounded-full border border-border/50" style={{ background: theme.chartColorA }} />
                          {theme.name}
                        </div>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Colors */}
                <div className="space-y-1.5">
                  <Label className="text-[10px] text-muted-foreground font-mono uppercase">Colors</Label>
                  <div className="grid grid-cols-2 gap-2">
                    {[
                      { label: 'Chart A', color: selectedTheme.chartColorA },
                      { label: 'Chart B', color: selectedTheme.chartColorB },
                      { label: 'Chart C', color: selectedTheme.chartColorC },
                      { label: 'Chart D', color: selectedTheme.chartColorD },
                      { label: 'Text', color: selectedTheme.textPrimary },
                      { label: 'Panel', color: selectedTheme.panelFill },
                    ].map(c => (
                      <div key={c.label} className="flex items-center gap-1.5">
                        <div className="w-4 h-4 rounded-md border border-border/50" style={{ background: c.color }} />
                        <span className="text-[10px] text-muted-foreground">{c.label}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Overlay / Blur */}
                <div className="space-y-1.5">
                  <Label className="text-[10px] text-muted-foreground font-mono uppercase">Overlay Opacity</Label>
                  <Slider value={[selectedTheme.overlayOpacity * 100]} max={100} step={1} className="w-full" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-[10px] text-muted-foreground font-mono uppercase">Blur</Label>
                  <Slider value={[selectedTheme.blurAmount]} max={20} step={1} className="w-full" />
                </div>

                {/* Animation */}
                <div className="space-y-2">
                  <Label className="text-[10px] text-muted-foreground font-mono uppercase">Animation</Label>
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] text-muted-foreground">Smoothing</span>
                    <Switch checked={selectedTheme.smoothing} />
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] text-muted-foreground">Count-up</span>
                    <Switch checked={selectedTheme.countUpNumbers} />
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="layout" className="mt-2 space-y-3">
                {/* QR Controls */}
                <div className="space-y-1.5">
                  <Label className="text-[10px] text-muted-foreground font-mono uppercase">QR Code</Label>
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] text-muted-foreground w-8">Size</span>
                      <Slider value={[qrSize]} onValueChange={([v]) => onQrSizeChange(v)} min={60} max={200} step={5} className="flex-1" />
                      <span className="text-[10px] text-muted-foreground font-mono w-10">{qrSize}px</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <span className="text-[10px] text-muted-foreground mr-1">Pos</span>
                      {(['top-left', 'top-right', 'bottom-left', 'bottom-right'] as QRPosition[]).map(pos => (
                        <button
                          key={pos}
                          onClick={() => onQrPositionChange(pos)}
                          className={`px-2 py-1 rounded text-[9px] font-mono transition-colors ${
                            qrPosition === pos ? 'bg-primary/20 text-primary' : 'bg-muted text-muted-foreground hover:bg-accent'
                          }`}
                        >
                          {pos.split('-').map(w => w[0].toUpperCase()).join('')}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Branding Controls */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <Label className="text-[10px] text-muted-foreground font-mono uppercase">Branding Bug</Label>
                    <Switch checked={showBranding} onCheckedChange={onShowBrandingChange} />
                  </div>
                  {showBranding && (
                    <div className="flex items-center gap-1">
                      <span className="text-[10px] text-muted-foreground mr-1">Pos</span>
                      {(['top-left', 'top-right', 'bottom-left', 'bottom-right'] as QRPosition[]).map(pos => (
                        <button
                          key={pos}
                          onClick={() => onBrandingPositionChange(pos)}
                          className={`px-2 py-1 rounded text-[9px] font-mono transition-colors ${
                            brandingPosition === pos ? 'bg-primary/20 text-primary' : 'bg-muted text-muted-foreground hover:bg-accent'
                          }`}
                        >
                          {pos.split('-').map(w => w[0].toUpperCase()).join('')}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {/* Safe Areas */}
                <div className="space-y-2">
                  <Label className="text-[10px] text-muted-foreground font-mono uppercase">Safe Areas</Label>
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] text-muted-foreground">Title Safe</span>
                    <Switch />
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] text-muted-foreground">Action Safe</span>
                    <Switch />
                  </div>
                </div>

                {/* Output Info */}
                <div className="space-y-1.5 pt-2 border-t border-border">
                  <Label className="text-[10px] text-muted-foreground font-mono uppercase">Output</Label>
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] text-muted-foreground">Resolution</span>
                    <span className="mako-chip bg-muted text-muted-foreground text-[9px]">1920×1080</span>
                  </div>
                </div>
              </TabsContent>
            </Tabs>
          </div>
        </ResizablePanel>
      </ResizablePanelGroup>
    </div>
  );
}
