import { useState, useMemo } from 'react';
import { OperatorLayout } from '@/components/layout/OperatorLayout';
import { PollStatusChip } from '@/components/broadcast/PollStatusChip';
import { QRPreviewCard } from '@/components/broadcast/QRPreviewCard';
import { BroadcastPreviewFrame } from '@/components/broadcast/BroadcastPreviewFrame';
import { FullscreenScene } from '@/components/broadcast/scenes/FullscreenScene';
import { LowerThirdScene } from '@/components/broadcast/scenes/LowerThirdScene';
import { ResultsScene } from '@/components/broadcast/scenes/ResultsScene';
import { HorizontalBarChart } from '@/components/charts/HorizontalBarChart';
import { VerticalBarChart } from '@/components/charts/VerticalBarChart';
import { DonutChart } from '@/components/charts/DonutChart';
import { PuckSlider } from '@/components/charts/PuckSlider';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { templateLabels } from '@/lib/mock-data';
import { themePresets } from '@/lib/themes';
import { TemplateName, PollOption } from '@/lib/types';
import { PlusCircle, GripVertical, Trash2, Save } from 'lucide-react';

const templateOptions: TemplateName[] = [
  'horizontal-bar', 'vertical-bar', 'pie-donut', 'progress-bar',
  'puck-slider', 'fullscreen-hero', 'lower-third',
];

export default function PollCreate() {
  const [question, setQuestion] = useState('');
  const [internalName, setInternalName] = useState('');
  const [slug, setSlug] = useState('');
  const [subheadline, setSubheadline] = useState('');
  const [selectedTemplate, setSelectedTemplate] = useState<TemplateName>('horizontal-bar');
  const [answers, setAnswers] = useState([
    { id: '1', text: '', shortLabel: '' },
    { id: '2', text: '', shortLabel: '' },
  ]);
  const [showLiveResults, setShowLiveResults] = useState(true);
  const [showThankYou, setShowThankYou] = useState(true);
  const [showFinalResults, setShowFinalResults] = useState(true);
  const [autoClose, setAutoClose] = useState('');

  const addAnswer = () => {
    if (answers.length < 4) {
      setAnswers([...answers, { id: String(Date.now()), text: '', shortLabel: '' }]);
    }
  };

  const removeAnswer = (id: string) => {
    if (answers.length > 2) {
      setAnswers(answers.filter(a => a.id !== id));
    }
  };

  const theme = themePresets[0];
  const previewColors = [theme.chartColorA, theme.chartColorB, theme.chartColorC, theme.chartColorD];

  const previewOptions: PollOption[] = useMemo(() =>
    answers.map((a, i) => ({
      id: a.id,
      text: a.text || `Answer ${i + 1}`,
      shortLabel: a.shortLabel || undefined,
      votes: Math.floor(Math.random() * 1000 + 500),
      order: i,
    })), [answers]
  );
  const previewTotal = previewOptions.reduce((sum, o) => sum + o.votes, 0);
  const previewQuestion = question || 'Your question here?';

  const renderPreviewChart = () => {
    switch (selectedTemplate) {
      case 'vertical-bar':
        return <VerticalBarChart options={previewOptions} totalVotes={previewTotal} colors={previewColors} />;
      case 'pie-donut':
        return <DonutChart options={previewOptions} totalVotes={previewTotal} colors={previewColors} size={140} />;
      case 'puck-slider':
        return <PuckSlider options={previewOptions} totalVotes={previewTotal} colors={previewColors} />;
      case 'fullscreen-hero':
        return <FullscreenScene question={previewQuestion} options={previewOptions} totalVotes={previewTotal} colors={previewColors} theme={theme} />;
      case 'lower-third':
        return <LowerThirdScene question={previewQuestion} options={previewOptions} totalVotes={previewTotal} colors={previewColors} theme={theme} />;
      default:
        return <HorizontalBarChart options={previewOptions} totalVotes={previewTotal} colors={previewColors} />;
    }
  };

  const isSceneTemplate = selectedTemplate === 'fullscreen-hero' || selectedTemplate === 'lower-third';

  return (
    <OperatorLayout>
      {/* Header */}
      <header className="h-14 border-b border-border flex items-center justify-between px-4 bg-card/50">
        <div className="flex items-center gap-3">
          <span className="text-xs text-muted-foreground">Polls</span>
          <span className="text-muted-foreground/40">/</span>
          <span className="text-sm font-semibold text-foreground">New Poll</span>
          <PollStatusChip state="draft" />
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" className="gap-1.5 text-xs">
            <Save className="w-3.5 h-3.5" /> Save Draft
          </Button>
          <Button variant="outline" size="sm" className="text-xs">Save Ready</Button>
          <Button size="sm" className="text-xs">Go Live</Button>
        </div>
      </header>

      <div className="p-4 h-[calc(100vh-3.5rem)] overflow-auto">
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_380px] gap-4 max-w-6xl">
          {/* Left — Form */}
          <div className="space-y-4">
            {/* Poll Details */}
            <div className="mako-panel p-5 space-y-4">
              <h2 className="text-sm font-semibold text-foreground">Poll Details</h2>
              <div className="grid gap-4">
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">Internal Name</Label>
                  <Input value={internalName} onChange={e => setInternalName(e.target.value)} placeholder="e.g. Penalty Call Q1" className="bg-background/50 h-10" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">On-Air Question</Label>
                  <Input value={question} onChange={e => setQuestion(e.target.value)} placeholder="e.g. Was that a penalty?" className="bg-background/50 h-10" />
                  <span className="text-[10px] text-muted-foreground font-mono">{question.length}/80 chars</span>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">Subheadline (optional)</Label>
                  <Input value={subheadline} onChange={e => setSubheadline(e.target.value)} placeholder="Optional subtitle" className="bg-background/50 h-10" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">Viewer Slug</Label>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground font-mono">/vote/</span>
                    <Input value={slug} onChange={e => setSlug(e.target.value)} placeholder="penalty-call" className="bg-background/50 h-10" />
                  </div>
                </div>
              </div>
            </div>

            {/* Answer Setup */}
            <div className="mako-panel p-5 space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-semibold text-foreground">Answer Setup</h2>
                <span className="text-[10px] text-muted-foreground font-mono">{answers.length}/4</span>
              </div>
              <div className="space-y-2">
                {answers.map((answer, i) => (
                  <div key={answer.id} className="flex items-center gap-2 p-3 rounded-xl bg-accent/30 border border-border/50">
                    <GripVertical className="w-4 h-4 text-muted-foreground/40 shrink-0 cursor-grab" />
                    <Input value={answer.text} onChange={e => { const next = [...answers]; next[i].text = e.target.value; setAnswers(next); }} placeholder={`Answer ${i + 1}`} className="bg-background/50 h-9 flex-1" />
                    <Input value={answer.shortLabel} onChange={e => { const next = [...answers]; next[i].shortLabel = e.target.value; setAnswers(next); }} placeholder="Short" className="bg-background/50 h-9 w-20" />
                    <button onClick={() => removeAnswer(answer.id)} className="w-8 h-8 flex items-center justify-center text-muted-foreground hover:text-destructive transition-colors" disabled={answers.length <= 2}>
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
              {answers.length < 4 && (
                <Button variant="outline" size="sm" onClick={addAnswer} className="gap-1.5 text-xs">
                  <PlusCircle className="w-3.5 h-3.5" /> Add Answer
                </Button>
              )}
            </div>

            {/* Template Selection */}
            <div className="mako-panel p-5 space-y-4">
              <h2 className="text-sm font-semibold text-foreground">Template</h2>
              <div className="grid grid-cols-2 gap-1.5">
                {templateOptions.map(t => (
                  <Tooltip key={t}>
                    <TooltipTrigger asChild>
                      <button
                        onClick={() => setSelectedTemplate(t)}
                        className={`text-left p-2.5 rounded-lg text-xs transition-all border ${
                          selectedTemplate === t
                            ? 'bg-primary/10 border-primary/30 text-primary'
                            : 'bg-accent/30 border-border/50 text-muted-foreground hover:bg-accent/50'
                        }`}
                      >
                        {templateLabels[t]}
                      </button>
                    </TooltipTrigger>
                    <TooltipContent>Select {templateLabels[t]} template for this poll</TooltipContent>
                  </Tooltip>
                ))}
              </div>
            </div>

            {/* Poll Logic */}
            <div className="mako-panel p-5 space-y-4">
              <h2 className="text-sm font-semibold text-foreground">Poll Logic</h2>
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <Label className="text-xs text-muted-foreground">Show live results to viewers</Label>
                  <Switch checked={showLiveResults} onCheckedChange={setShowLiveResults} />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">Auto-close duration (seconds)</Label>
                  <Input value={autoClose} onChange={e => setAutoClose(e.target.value)} placeholder="e.g. 120" className="bg-background/50 h-10 w-32" type="number" />
                </div>
              </div>
            </div>

            {/* Viewer Experience */}
            <div className="mako-panel p-5 space-y-4">
              <h2 className="text-sm font-semibold text-foreground">Viewer Experience</h2>
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <Label className="text-xs text-muted-foreground">Show thank-you screen</Label>
                  <Switch checked={showThankYou} onCheckedChange={setShowThankYou} />
                </div>
                <div className="flex items-center justify-between">
                  <Label className="text-xs text-muted-foreground">Show final results after close</Label>
                  <Switch checked={showFinalResults} onCheckedChange={setShowFinalResults} />
                </div>
              </div>
            </div>
          </div>

          {/* Right — Live Preview + Summary */}
          <div className="lg:sticky lg:top-4 self-start space-y-4">
            {/* Live Preview Monitor */}
            <div className="mako-panel p-4 space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-semibold text-foreground">Preview</h2>
                <span className="mako-chip bg-muted text-muted-foreground text-[9px]">{templateLabels[selectedTemplate]}</span>
              </div>
              {isSceneTemplate ? (
                <BroadcastPreviewFrame showLabel>
                  {renderPreviewChart()}
                </BroadcastPreviewFrame>
              ) : (
                <div className="mako-panel p-6 space-y-4" style={{ background: `linear-gradient(135deg, ${theme.tintColor}, hsla(220, 20%, 8%, 0.95))` }}>
                  <p className="text-sm font-bold text-center" style={{ color: theme.textPrimary }}>{previewQuestion}</p>
                  <div className="w-full">{renderPreviewChart()}</div>
                </div>
              )}
            </div>

            {/* Summary */}
            <div className="mako-panel p-4 space-y-4">
              <h2 className="text-sm font-semibold text-foreground">Summary</h2>
              <div className="space-y-3 text-xs">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Status</span>
                  <PollStatusChip state="draft" />
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Answers</span>
                  <span className="font-mono text-foreground">{answers.length}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Template</span>
                  <span className="text-foreground">{templateLabels[selectedTemplate]}</span>
                </div>
                {slug && (
                  <div className="pt-2 border-t border-border">
                    <p className="text-[10px] text-muted-foreground font-mono uppercase mb-2">Viewer URL</p>
                    <p className="font-mono text-xs text-primary break-all">/vote/{slug}</p>
                  </div>
                )}
              </div>
              {slug && (
                <div className="pt-3 border-t border-border flex justify-center">
                  <QRPreviewCard url={`https://makovote.tv/vote/${slug || 'preview'}`} size={90} />
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </OperatorLayout>
  );
}
