import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { PlusCircle, GripVertical, Trash2, HelpCircle } from 'lucide-react';

export type AnswerType = 'yes-no' | 'multiple-choice' | 'custom';
export type MCLabelStyle = 'letters' | 'numbers' | 'custom';
export type PreviewDataMode = 'test' | 'real';

interface AnswerItem {
  id: string;
  text: string;
  shortLabel: string;
  testVotes?: number;
}

interface ContentPanelProps {
  internalName: string;
  setInternalName: (v: string) => void;
  question: string;
  setQuestion: (v: string) => void;
  subheadline: string;
  setSubheadline: (v: string) => void;
  slug: string;
  setSlug: (v: string) => void;
  answerType: AnswerType;
  setAnswerType: (v: AnswerType) => void;
  mcLabelStyle: MCLabelStyle;
  setMcLabelStyle: (v: MCLabelStyle) => void;
  answers: AnswerItem[];
  setAnswers: (v: AnswerItem[]) => void;
  showLiveResults: boolean;
  setShowLiveResults: (v: boolean) => void;
  autoClose: string;
  setAutoClose: (v: string) => void;
  showThankYou: boolean;
  setShowThankYou: (v: boolean) => void;
  showFinalResults: boolean;
  setShowFinalResults: (v: boolean) => void;
  previewDataMode: PreviewDataMode;
  setPreviewDataMode: (v: PreviewDataMode) => void;
}

const answerTypes: { value: AnswerType; label: string }[] = [
  { value: 'yes-no', label: 'Yes / No' },
  { value: 'multiple-choice', label: 'Multiple Choice' },
  { value: 'custom', label: 'Custom Text' },
];

const mcLabelStyles: { value: MCLabelStyle; label: string }[] = [
  { value: 'letters', label: 'A / B / C' },
  { value: 'numbers', label: '1 / 2 / 3' },
  { value: 'custom', label: 'Custom' },
];

export function getMCLabel(index: number, style: MCLabelStyle, customLabel?: string): string {
  if (style === 'letters') return String.fromCharCode(65 + index);
  if (style === 'numbers') return String(index + 1);
  return customLabel || String.fromCharCode(65 + index);
}

export function ContentPanel({
  internalName, setInternalName,
  question, setQuestion,
  subheadline, setSubheadline,
  slug, setSlug,
  answerType, setAnswerType,
  mcLabelStyle, setMcLabelStyle,
  answers, setAnswers,
  showLiveResults, setShowLiveResults,
  autoClose, setAutoClose,
  showThankYou, setShowThankYou,
  showFinalResults, setShowFinalResults,
  previewDataMode, setPreviewDataMode,
}: ContentPanelProps) {

  const handleAnswerTypeChange = (type: AnswerType) => {
    setAnswerType(type);
    if (type === 'yes-no') {
      setAnswers([
        { id: '1', text: 'Yes', shortLabel: 'Y', testVotes: 0 },
        { id: '2', text: 'No', shortLabel: 'N', testVotes: 0 },
      ]);
    } else if (type === 'multiple-choice') {
      setAnswers([
        { id: '1', text: '', shortLabel: '', testVotes: 0 },
        { id: '2', text: '', shortLabel: '', testVotes: 0 },
        { id: '3', text: '', shortLabel: '', testVotes: 0 },
      ]);
    }
  };

  const addAnswer = () => {
    if (answers.length < 4) {
      setAnswers([...answers, { id: String(Date.now()), text: '', shortLabel: '', testVotes: 0 }]);
    }
  };

  const removeAnswer = (id: string) => {
    if (answers.length > 2) {
      setAnswers(answers.filter(a => a.id !== id));
    }
  };

  const updateAnswer = (index: number, field: 'text' | 'shortLabel' | 'testVotes', value: string | number) => {
    const next = [...answers];
    next[index] = { ...next[index], [field]: value as never };
    setAnswers(next);
  };

  return (
    <div className="h-full overflow-y-auto space-y-3 p-3">
      {/* Poll Details */}
      <div className="mako-panel p-4 space-y-3">
        <h2 className="text-xs font-semibold text-foreground uppercase tracking-wider">Poll Details</h2>
        <div className="space-y-2.5">
          <div className="space-y-1">
            <Label className="text-[10px] text-muted-foreground">Internal Name</Label>
            <Input value={internalName} onChange={e => setInternalName(e.target.value)} placeholder="e.g. Penalty Call Q1" className="bg-background/50 h-8 text-xs" />
          </div>
          <div className="space-y-1">
            <Label className="text-[10px] text-muted-foreground">On-Air Question</Label>
            <Input value={question} onChange={e => setQuestion(e.target.value)} placeholder="e.g. Was that a penalty?" className="bg-background/50 h-8 text-xs" />
            <span className="text-[9px] text-muted-foreground font-mono">{question.length}/80</span>
          </div>
          <div className="space-y-1">
            <Label className="text-[10px] text-muted-foreground">Subheadline</Label>
            <Input value={subheadline} onChange={e => setSubheadline(e.target.value)} placeholder="Optional subtitle" className="bg-background/50 h-8 text-xs" />
          </div>
          <div className="space-y-1">
            <div className="flex items-center gap-1">
              <Label className="text-[10px] text-muted-foreground">Viewer Slug</Label>
              <Tooltip>
                <TooltipTrigger asChild>
                  <HelpCircle className="w-3 h-3 text-muted-foreground/50 cursor-help" />
                </TooltipTrigger>
                <TooltipContent className="max-w-xs">
                  This becomes the public URL viewers visit to vote.<br/>
                  The full link appears beneath the preview monitor.
                </TooltipContent>
              </Tooltip>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] text-muted-foreground font-mono shrink-0">/vote/</span>
              <Input value={slug} onChange={e => setSlug(e.target.value)} placeholder="penalty-call" className="bg-background/50 h-8 text-xs" />
            </div>
          </div>
        </div>
      </div>

      {/* Answer Type */}
      <div className="mako-panel p-4 space-y-3">
        <h2 className="text-xs font-semibold text-foreground uppercase tracking-wider">Answer Type / Viewer Mode</h2>
        <div className="grid grid-cols-3 gap-1">
          {answerTypes.map(t => (
            <button
              key={t.value}
              onClick={() => handleAnswerTypeChange(t.value)}
              className={`p-2 rounded-lg text-[10px] font-medium transition-all border ${
                answerType === t.value
                  ? 'bg-primary/10 border-primary/30 text-primary'
                  : 'bg-accent/30 border-border/50 text-muted-foreground hover:bg-accent/50'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
        {answerType === 'multiple-choice' && (
          <div className="space-y-1.5 pt-2 border-t border-border/40">
            <Label className="text-[10px] text-muted-foreground">Label Style</Label>
            <div className="grid grid-cols-3 gap-1">
              {mcLabelStyles.map(s => (
                <button
                  key={s.value}
                  onClick={() => setMcLabelStyle(s.value)}
                  className={`p-1.5 rounded-md text-[10px] font-medium transition-all border ${
                    mcLabelStyle === s.value
                      ? 'bg-primary/10 border-primary/30 text-primary'
                      : 'bg-accent/30 border-border/50 text-muted-foreground hover:bg-accent/50'
                  }`}
                >
                  {s.label}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Answer Setup */}
      <div className="mako-panel p-4 space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-xs font-semibold text-foreground uppercase tracking-wider">Answers</h2>
          <span className="text-[9px] text-muted-foreground font-mono">{answers.length}/4</span>
        </div>
        <div className="space-y-1.5">
          {answers.map((answer, i) => (
            <div key={answer.id} className="flex items-center gap-1.5 p-2 rounded-lg bg-accent/30 border border-border/50">
              <GripVertical className="w-3.5 h-3.5 text-muted-foreground/40 shrink-0 cursor-grab" />
              <Input
                value={answer.text}
                onChange={e => updateAnswer(i, 'text', e.target.value)}
                placeholder={`Answer ${i + 1}`}
                className="bg-background/50 h-7 text-xs flex-1"
                disabled={answerType === 'yes-no'}
              />
              <Input
                value={answer.shortLabel}
                onChange={e => updateAnswer(i, 'shortLabel', e.target.value)}
                placeholder="Short"
                className="bg-background/50 h-7 text-xs w-16"
                disabled={answerType === 'yes-no'}
              />
              <button
                onClick={() => removeAnswer(answer.id)}
                className="w-6 h-6 flex items-center justify-center text-muted-foreground hover:text-destructive transition-colors"
                disabled={answers.length <= 2 || answerType === 'yes-no'}
              >
                <Trash2 className="w-3 h-3" />
              </button>
            </div>
          ))}
        </div>
        {answerType !== 'yes-no' && answers.length < 4 && (
          <Button variant="outline" size="sm" onClick={addAnswer} className="gap-1 text-[10px] h-7">
            <PlusCircle className="w-3 h-3" /> Add Answer
          </Button>
        )}
      </div>

      {/* Voting Logic */}
      <div className="mako-panel p-4 space-y-3">
        <h2 className="text-xs font-semibold text-foreground uppercase tracking-wider">Voting Logic</h2>
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <Label className="text-[10px] text-muted-foreground">Show live results</Label>
            <Switch checked={showLiveResults} onCheckedChange={setShowLiveResults} />
          </div>
          <div className="flex items-center justify-between">
            <Label className="text-[10px] text-muted-foreground">Thank-you screen</Label>
            <Switch checked={showThankYou} onCheckedChange={setShowThankYou} />
          </div>
          <div className="flex items-center justify-between">
            <Label className="text-[10px] text-muted-foreground">Final results after close</Label>
            <Switch checked={showFinalResults} onCheckedChange={setShowFinalResults} />
          </div>
          <div className="space-y-1">
            <Label className="text-[10px] text-muted-foreground">Auto-close (seconds)</Label>
            <Input value={autoClose} onChange={e => setAutoClose(e.target.value)} placeholder="e.g. 120" className="bg-background/50 h-8 text-xs w-24" type="number" />
          </div>
        </div>
      </div>
    </div>
  );
}
