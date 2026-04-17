import { useState } from 'react';
import { BroadcastPreviewFrame } from '@/components/broadcast/BroadcastPreviewFrame';
import { FullscreenScene } from '@/components/broadcast/scenes/FullscreenScene';
import { LowerThirdScene } from '@/components/broadcast/scenes/LowerThirdScene';
import { QRScene } from '@/components/broadcast/scenes/QRScene';
import { ResultsScene } from '@/components/broadcast/scenes/ResultsScene';
import { LayerPanel } from '@/components/broadcast/layers/LayerPanel';
import { LayerInspector } from '@/components/broadcast/layers/LayerInspector';
import { LayerPreviewOverlay } from '@/components/broadcast/layers/LayerPreviewOverlay';
import { ApplyDraftDialog } from '@/components/broadcast/ApplyDraftDialog';
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
import { GraphicLayer, LayerType, cloneLayers } from '@/lib/layers';
import {
  Type, AlignLeft, AlignCenter, AlignRight, Bold, Italic,
  CaseSensitive, Save, Send, GripVertical, Plus, Trash2
} from 'lucide-react';

interface GraphicsWorkspaceProps {
  poll: Poll;
  appliedLayers: GraphicLayer[];
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
  layers?: GraphicLayer[];
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
  appliedLayers,
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
  const [layers, setLayers] = useState<GraphicLayer[]>(() => cloneLayers(appliedLayers));
  const [selectedLayerId, setSelectedLayerId] = useState<LayerType | null>(null);
  const [showApplyDialog, setShowApplyDialog] = useState(false);

  const appliedTheme = themePresets.find(t => t.id === poll.themeId) || themePresets[0];
  const selectedLayer = layers.find(l => l.id === selectedLayerId) || null;

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
    setShowApplyDialog(true);
  };

  const handleConfirmApply = () => {
    onApplyToProgram({ ...draft, themeId: selectedTheme.id, layers: cloneLayers(layers) });
    setIsDirty(false);
    setShowApplyDialog(false);
  };

  const toggleVisibility = (id: LayerType) => {
    setLayers(prev => prev.map(l => l.id === id ? { ...l, visible: !l.visible } : l));
  };

  const toggleLock = (id: LayerType) => {
    setLayers(prev => prev.map(l => l.id === id ? { ...l, locked: !l.locked } : l));
  };

  const updateLayer = (id: LayerType, changes: Partial<GraphicLayer>) => {
    setLayers(prev => prev.map(l => l.id === id ? { ...l, ...changes } : l));
    setIsDirty(true);
  };

  const renderScene = () => {
    const displayQuestion = viewMode === 'draft' ? draft.question : poll.question;
    const displayOptions = viewMode === 'draft' ? draft.options : poll.options;
    const displayTemplate = viewMode === 'draft' ? draft.template : poll.template;
    const displayTheme = viewMode === 'draft' ? selectedTheme : appliedTheme;
    const colors = [displayTheme.chartColorA, displayTheme.chartColorB, displayTheme.chartColorC, displayTheme.chartColorD];
    const totalVotes = displayOptions.reduce((sum, o) => sum + o.votes, 0);
    const sceneLayers = viewMode === 'draft' ? layers : appliedLayers;

    const sharedAssets = { slug: poll.slug, qrSize, qrPosition, showBranding, brandingPosition };
    const baseProps = {
      question: displayQuestion, options: displayOptions, totalVotes,
      colors, theme: displayTheme, template: displayTemplate, ...sharedAssets,
    };

    switch (previewScene) {
      case 'lowerThird':
        return <LowerThirdScene {...baseProps} />;
      case 'qr':
        return <QRScene slug={poll.slug} theme={displayTheme} />;
      case 'results':
        return <ResultsScene {...baseProps} />;
      default:
        return <FullscreenScene {...baseProps} layers={sceneLayers} />;
    }
  };

  return (
    <div className="h-[calc(100vh-3.5rem)] overflow-hidden">
      <ResizablePanelGroup direction="horizontal" className="h-full">
        {/* Left Column — Layers (top) + Content (bottom), stacked panes */}
        <ResizablePanel defaultSize={18} minSize={14} maxSize={28}>
          <ResizablePanelGroup direction="vertical" className="h-full">
            {/* Layers pane */}
            <ResizablePanel defaultSize={42} minSize={20}>
              <div className="h-full overflow-auto p-3">
                <LayerPanel
                  layers={layers}
                  selectedLayerId={selectedLayerId}
                  onSelectLayer={setSelectedLayerId}
                  onToggleVisibility={toggleVisibility}
                  onToggleLock={toggleLock}
                />
              </div>
            </ResizablePanel>

            <ResizableHandle withHandle />

            {/* Content pane */}
            <ResizablePanel defaultSize={58} minSize={25}>
              <div className="h-full overflow-auto p-3 space-y-3">
                <p className="text-[10px] text-muted-foreground font-mono uppercase px-1">Content</p>

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
              </div>
            </ResizablePanel>
          </ResizablePanelGroup>
        </ResizablePanel>

        <ResizableHandle withHandle />

        {/* Center — Preview with Layer Overlay */}
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
                <Button variant="outline" size="sm" className="gap-1.5 text-xs h-7" onClick={() => {
                  setDraft({ ...draft, question: poll.question, options: [...poll.options], template: poll.template, themeId: poll.themeId });
                  setSelectedTheme(appliedTheme);
                  setLayers(cloneLayers(appliedLayers));
                  setIsDirty(false);
                }}>
                  <Save className="w-3 h-3" /> Reset
                </Button>
                <Button size="sm" className="gap-1.5 text-xs h-7" onClick={handleApply} disabled={!isDirty}>
                  <Send className="w-3 h-3" /> Apply to Program
                </Button>
              </div>
            </div>

            {/* Preview Frame with Layer Overlay */}
            <div className="relative">
              <BroadcastPreviewFrame showLabel>
                {renderScene()}
              </BroadcastPreviewFrame>
              {viewMode === 'draft' && (
                <LayerPreviewOverlay
                  layers={layers}
                  selectedLayerId={selectedLayerId}
                  onSelectLayer={setSelectedLayerId}
                  onUpdateLayer={updateLayer}
                />
              )}
            </div>

            {/* Contextual Asset Bar */}
            <div className="mako-panel p-3">
              <p className="text-[10px] text-muted-foreground font-mono uppercase mb-2">
                {selectedLayer ? `${selectedLayer.label} Controls` : 'Output Assets'}
              </p>
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

        {/* Right Column — Inspector (top) + Style (bottom), stacked panes */}
        <ResizablePanel defaultSize={30} minSize={18} maxSize={38}>
          <ResizablePanelGroup direction="vertical" className="h-full">
            {/* Inspector pane */}
            <ResizablePanel defaultSize={55} minSize={25}>
              <div className="h-full overflow-auto p-3">
                <p className="text-[10px] text-muted-foreground font-mono uppercase mb-2 px-1">Inspector</p>
                <LayerInspector
                  layer={selectedLayer}
                  onUpdateLayer={updateLayer}
                />
              </div>
            </ResizablePanel>

            <ResizableHandle withHandle />

            {/* Style pane */}
            <ResizablePanel defaultSize={45} minSize={20}>
              <div className="h-full overflow-auto p-3 space-y-3">
                <p className="text-[10px] text-muted-foreground font-mono uppercase px-1">Style</p>

                {/* Theme Presets */}
                <div className="space-y-1.5">
                  <Label className="text-[10px] text-muted-foreground font-mono uppercase">Theme</Label>
                  <div className="space-y-1">
                    {themePresets.map(theme => (
                      <button
                        key={theme.id}
                         onClick={() => {
                           setSelectedTheme(theme);
                           updateDraft({ themeId: theme.id });
                         }}
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
              </div>
            </ResizablePanel>
          </ResizablePanelGroup>
        </ResizablePanel>
      </ResizablePanelGroup>

      <ApplyDraftDialog
        open={showApplyDialog}
        onOpenChange={setShowApplyDialog}
        poll={poll}
        draft={draft}
        currentLayers={appliedLayers}
        draftLayers={layers}
        onConfirm={handleConfirmApply}
      />
    </div>
  );
}
