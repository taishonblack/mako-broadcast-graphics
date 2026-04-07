import { useState } from 'react';
import { OperatorLayout } from '@/components/layout/OperatorLayout';
import { PollStatusChip } from '@/components/broadcast/PollStatusChip';
import { QRPreviewCard } from '@/components/broadcast/QRPreviewCard';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { PlusCircle, GripVertical, Trash2, Save } from 'lucide-react';

export default function PollCreate() {
  const [question, setQuestion] = useState('');
  const [internalName, setInternalName] = useState('');
  const [slug, setSlug] = useState('');
  const [subheadline, setSubheadline] = useState('');
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

      <div className="p-4">
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_300px] gap-4 max-w-5xl">
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
                    <Input
                      value={answer.text}
                      onChange={e => {
                        const next = [...answers];
                        next[i].text = e.target.value;
                        setAnswers(next);
                      }}
                      placeholder={`Answer ${i + 1}`}
                      className="bg-background/50 h-9 flex-1"
                    />
                    <Input
                      value={answer.shortLabel}
                      onChange={e => {
                        const next = [...answers];
                        next[i].shortLabel = e.target.value;
                        setAnswers(next);
                      }}
                      placeholder="Short"
                      className="bg-background/50 h-9 w-20"
                    />
                    <button
                      onClick={() => removeAnswer(answer.id)}
                      className="w-8 h-8 flex items-center justify-center text-muted-foreground hover:text-destructive transition-colors"
                      disabled={answers.length <= 2}
                    >
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

          {/* Right — Summary */}
          <div className="lg:sticky lg:top-4 self-start">
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
                  <span className="text-foreground">Horizontal Bar</span>
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
