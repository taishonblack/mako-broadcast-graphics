import { useState, useMemo } from 'react';
import { OperatorLayout } from '@/components/layout/OperatorLayout';
import { PollStatusChip } from '@/components/broadcast/PollStatusChip';
import { ContentPanel, AnswerType } from '@/components/poll-create/ContentPanel';
import { BuildControlsPanel } from '@/components/poll-create/BuildControlsPanel';
import { DraftPreviewMonitor } from '@/components/poll-create/DraftPreviewMonitor';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { ResizablePanelGroup, ResizablePanel, ResizableHandle } from '@/components/ui/resizable';
import { themePresets } from '@/lib/themes';
import { TemplateName, PollOption } from '@/lib/types';
import { Save, Rocket } from 'lucide-react';

export default function PollCreate() {
  const [question, setQuestion] = useState('');
  const [internalName, setInternalName] = useState('');
  const [slug, setSlug] = useState('');
  const [subheadline, setSubheadline] = useState('');
  const [selectedTemplate, setSelectedTemplate] = useState<TemplateName>('horizontal-bar');
  const [answerType, setAnswerType] = useState<AnswerType>('multiple-choice');
  const [answers, setAnswers] = useState([
    { id: '1', text: '', shortLabel: '' },
    { id: '2', text: '', shortLabel: '' },
  ]);
  const [showLiveResults, setShowLiveResults] = useState(true);
  const [showThankYou, setShowThankYou] = useState(true);
  const [showFinalResults, setShowFinalResults] = useState(true);
  const [autoClose, setAutoClose] = useState('');
  const [bgColor, setBgColor] = useState('');

  const theme = themePresets[0];
  const previewColors = [theme.chartColorA, theme.chartColorB, theme.chartColorC, theme.chartColorD];

  const previewOptions: PollOption[] = useMemo(() =>
    answers.map((a, i) => ({
      id: a.id,
      text: a.text || `Answer ${i + 1}`,
      shortLabel: a.shortLabel || undefined,
      votes: [720, 540, 380, 260][i] || 300,
      order: i,
    })), [answers]
  );
  const previewTotal = previewOptions.reduce((sum, o) => sum + o.votes, 0);
  const previewQuestion = question || 'Your question here?';
  const hasContent = question.length > 0 || answers.some(a => a.text.length > 0);

  return (
    <OperatorLayout>
      {/* Header */}
      <header className="h-11 border-b border-border flex items-center justify-between px-4 bg-card/50 shrink-0">
        <div className="flex items-center gap-2">
          <span className="text-[10px] text-muted-foreground">Polls</span>
          <span className="text-muted-foreground/40">/</span>
          <span className="text-xs font-semibold text-foreground">Draft Workspace</span>
          <PollStatusChip state="draft" />
        </div>
        <div className="flex items-center gap-1.5">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="outline" size="sm" className="gap-1 text-[10px] h-7">
                <Save className="w-3 h-3" /> Save Draft
              </Button>
            </TooltipTrigger>
            <TooltipContent>Save current work without publishing</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="outline" size="sm" className="text-[10px] h-7">Save Ready</Button>
            </TooltipTrigger>
            <TooltipContent>Mark poll as ready for the dashboard queue</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button size="sm" className="text-[10px] h-7 gap-1">
                <Rocket className="w-3 h-3" /> Go Live
              </Button>
            </TooltipTrigger>
            <TooltipContent>Send this poll directly to air</TooltipContent>
          </Tooltip>
        </div>
      </header>

      {/* 3-column resizable workspace */}
      <div className="flex-1 min-h-0">
        <ResizablePanelGroup direction="horizontal" className="h-full">
          {/* LEFT — Content & Answers */}
          <ResizablePanel defaultSize={25} minSize={18} maxSize={35}>
            <ContentPanel
              internalName={internalName} setInternalName={setInternalName}
              question={question} setQuestion={setQuestion}
              subheadline={subheadline} setSubheadline={setSubheadline}
              slug={slug} setSlug={setSlug}
              answerType={answerType} setAnswerType={setAnswerType}
              answers={answers} setAnswers={setAnswers}
              showLiveResults={showLiveResults} setShowLiveResults={setShowLiveResults}
              autoClose={autoClose} setAutoClose={setAutoClose}
              showThankYou={showThankYou} setShowThankYou={setShowThankYou}
              showFinalResults={showFinalResults} setShowFinalResults={setShowFinalResults}
            />
          </ResizablePanel>

          <ResizableHandle withHandle />

          {/* CENTER — Preview Monitor (dominant) */}
          <ResizablePanel defaultSize={55} minSize={35}>
            <DraftPreviewMonitor
              question={previewQuestion}
              options={previewOptions}
              totalVotes={previewTotal}
              colors={previewColors}
              template={selectedTemplate}
              theme={theme}
              hasContent={hasContent}
            />
          </ResizablePanel>

          <ResizableHandle withHandle />

          {/* RIGHT — Build Controls */}
          <ResizablePanel defaultSize={20} minSize={15} maxSize={30}>
            <BuildControlsPanel
              selectedTemplate={selectedTemplate}
              setSelectedTemplate={setSelectedTemplate}
              bgColor={bgColor}
              setBgColor={setBgColor}
            />
          </ResizablePanel>
        </ResizablePanelGroup>
      </div>
    </OperatorLayout>
  );
}
