import { useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { OperatorLayout } from '@/components/layout/OperatorLayout';
import { BroadcastPreviewFrame } from '@/components/broadcast/BroadcastPreviewFrame';
import { OutputStatusChip } from '@/components/broadcast/OutputStatusChip';
import { HorizontalBarChart } from '@/components/charts/HorizontalBarChart';
import { VerticalBarChart } from '@/components/charts/VerticalBarChart';
import { DonutChart } from '@/components/charts/DonutChart';
import { PuckSlider } from '@/components/charts/PuckSlider';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { mockPolls, templateLabels } from '@/lib/mock-data';
import { themePresets } from '@/lib/themes';
import { TemplateName } from '@/lib/types';
import {
  Monitor, RefreshCw, ChevronDown, Upload, Image as ImageIcon, QrCode
} from 'lucide-react';

const templateIcons: TemplateName[] = [
  'horizontal-bar', 'vertical-bar', 'pie-donut', 'progress-bar',
  'puck-slider', 'fullscreen-hero', 'lower-third',
];

export default function GraphicsEditor() {
  const poll = mockPolls[0];
  const [selectedTemplate, setSelectedTemplate] = useState<TemplateName>('horizontal-bar');
  const [selectedTheme, setSelectedTheme] = useState(themePresets[0]);
  const [showTitleSafe, setShowTitleSafe] = useState(false);
  const [showActionSafe, setShowActionSafe] = useState(false);
  const [overlayOpacity, setOverlayOpacity] = useState([70]);
  const [blurAmount, setBlurAmount] = useState([0]);
  const [smoothing, setSmoothing] = useState(true);
  const [countUp, setCountUp] = useState(true);
  // QR placement preview controls — let the operator verify QR visibility,
  // URL-label visibility, and corner placement before going live.
  const [showQR, setShowQR] = useState(true);
  const [showQRUrl, setShowQRUrl] = useState(false);
  const [qrCorner, setQrCorner] = useState<'top-left' | 'top-right' | 'bottom-left' | 'bottom-right'>('bottom-right');
  const qrUrl = `https://makovote.app/vote/${poll.slug}`;
  const cornerClass = {
    'top-left': 'top-3 left-3',
    'top-right': 'top-3 right-3',
    'bottom-left': 'bottom-3 left-3',
    'bottom-right': 'bottom-3 right-3',
  }[qrCorner];

  const renderChart = () => {
    const colors = [selectedTheme.chartColorA, selectedTheme.chartColorB, selectedTheme.chartColorC, selectedTheme.chartColorD];
    switch (selectedTemplate) {
      case 'horizontal-bar':
      case 'fullscreen-hero':
      case 'lower-third':
      case 'progress-bar':
        return <HorizontalBarChart options={poll.options} totalVotes={poll.totalVotes} colors={colors} />;
      case 'vertical-bar':
        return <VerticalBarChart options={poll.options} totalVotes={poll.totalVotes} colors={colors} />;
      case 'pie-donut':
        return <DonutChart options={poll.options} totalVotes={poll.totalVotes} colors={colors} size={180} />;
      case 'puck-slider':
        return <PuckSlider options={poll.options} totalVotes={poll.totalVotes} colors={colors} />;
      default:
        return <HorizontalBarChart options={poll.options} totalVotes={poll.totalVotes} colors={colors} />;
    }
  };

  return (
    <OperatorLayout>
      <header className="h-14 border-b border-border flex items-center justify-between px-4 bg-card/50">
        <div className="flex items-center gap-3">
          <span className="text-sm font-semibold text-foreground">Graphics Editor</span>
          <span className="mako-chip bg-muted text-muted-foreground">{templateLabels[selectedTemplate]}</span>
          <OutputStatusChip state="live_output" />
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" className="gap-1.5 text-xs">
            <Monitor className="w-3.5 h-3.5" /> Open Output
          </Button>
          <Button variant="outline" size="sm" className="gap-1.5 text-xs">
            <RefreshCw className="w-3.5 h-3.5" /> Refresh
          </Button>
        </div>
      </header>

      <div className="flex h-[calc(100vh-3.5rem)] overflow-hidden">
        {/* Left rail — Templates */}
        <div className="w-48 border-r border-border p-3 overflow-y-auto shrink-0 space-y-2">
          <p className="text-[10px] text-muted-foreground font-mono uppercase mb-2">Templates</p>
          {templateIcons.map((t) => (
            <button
              key={t}
              onClick={() => setSelectedTemplate(t)}
              className={`w-full text-left p-3 rounded-xl text-xs transition-all border ${
                selectedTemplate === t
                  ? 'bg-primary/10 border-primary/30 text-primary'
                  : 'bg-accent/30 border-border/50 text-muted-foreground hover:bg-accent/50'
              }`}
            >
              {templateLabels[t]}
            </button>
          ))}
        </div>

        {/* Center — Preview */}
        <div className="flex-1 flex items-center justify-center p-6" style={{ background: 'hsl(220, 20%, 6%)' }}>
          <div className="w-full max-w-3xl">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setShowTitleSafe(!showTitleSafe)}
                  className={`mako-chip cursor-pointer text-[10px] ${showTitleSafe ? 'bg-primary/20 text-primary' : 'bg-muted text-muted-foreground'}`}
                >
                  Title Safe
                </button>
                <button
                  onClick={() => setShowActionSafe(!showActionSafe)}
                  className={`mako-chip cursor-pointer text-[10px] ${showActionSafe ? 'bg-primary/20 text-primary' : 'bg-muted text-muted-foreground'}`}
                >
                  Action Safe
                </button>
              </div>
              <span className="mako-chip bg-mako-success/20 text-mako-success text-[10px]">● Connected</span>
            </div>
            <BroadcastPreviewFrame showTitleSafe={showTitleSafe} showActionSafe={showActionSafe} showLabel>
              <div
                className="absolute inset-0 flex flex-col items-center justify-center p-12"
                style={{
                  background: `linear-gradient(135deg, ${selectedTheme.tintColor}, hsla(220, 20%, 8%, 0.95))`,
                }}
              >
                <div className="text-center mb-8" style={{ color: selectedTheme.textPrimary }}>
                  <h3 className="text-2xl font-bold">{poll.question}</h3>
                </div>
                <div className="w-full max-w-md">
                  {renderChart()}
                </div>
              </div>
            </BroadcastPreviewFrame>
          </div>
        </div>

        {/* Right rail — Theme Controls */}
        <div className="w-64 border-l border-border overflow-y-auto shrink-0">
          <div className="p-3 space-y-4">
            {/* Theme preset */}
            <div>
              <p className="text-[10px] text-muted-foreground font-mono uppercase mb-2">Theme Preset</p>
              <div className="space-y-1.5">
                {themePresets.map((theme) => (
                  <button
                    key={theme.id}
                    onClick={() => setSelectedTheme(theme)}
                    className={`w-full text-left p-2.5 rounded-lg text-xs transition-all border ${
                      selectedTheme.id === theme.id
                        ? 'bg-primary/10 border-primary/30 text-primary'
                        : 'bg-accent/30 border-border/50 text-muted-foreground hover:bg-accent/50'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <div
                        className="w-4 h-4 rounded-full border border-border/50"
                        style={{ background: theme.chartColorA }}
                      />
                      {theme.name}
                    </div>
                  </button>
                ))}
              </div>
            </div>

            <div className="border-t border-border pt-3">
              <p className="text-[10px] text-muted-foreground font-mono uppercase mb-2">Background</p>
              <Button variant="outline" size="sm" className="w-full gap-1.5 text-xs h-9">
                <Upload className="w-3.5 h-3.5" /> Upload Image
              </Button>
              <div className="mt-3 space-y-3">
                <div>
                  <Label className="text-[10px] text-muted-foreground">Overlay Opacity</Label>
                  <Slider value={overlayOpacity} onValueChange={setOverlayOpacity} max={100} step={1} className="mt-1.5" />
                </div>
                <div>
                  <Label className="text-[10px] text-muted-foreground">Blur</Label>
                  <Slider value={blurAmount} onValueChange={setBlurAmount} max={20} step={1} className="mt-1.5" />
                </div>
              </div>
            </div>

            <div className="border-t border-border pt-3">
              <p className="text-[10px] text-muted-foreground font-mono uppercase mb-2">Colors</p>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { label: 'Chart A', color: selectedTheme.chartColorA },
                  { label: 'Chart B', color: selectedTheme.chartColorB },
                  { label: 'Text', color: selectedTheme.textPrimary },
                  { label: 'Panel', color: selectedTheme.panelFill },
                ].map((c) => (
                  <div key={c.label} className="flex items-center gap-1.5">
                    <div className="w-5 h-5 rounded-md border border-border/50" style={{ background: c.color }} />
                    <span className="text-[10px] text-muted-foreground">{c.label}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="border-t border-border pt-3">
              <p className="text-[10px] text-muted-foreground font-mono uppercase mb-2">Animation</p>
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Label className="text-[10px] text-muted-foreground">Smoothing</Label>
                  <Switch checked={smoothing} onCheckedChange={setSmoothing} />
                </div>
                <div className="flex items-center justify-between">
                  <Label className="text-[10px] text-muted-foreground">Count-up</Label>
                  <Switch checked={countUp} onCheckedChange={setCountUp} />
                </div>
              </div>
            </div>

            <div className="border-t border-border pt-3">
              <p className="text-[10px] text-muted-foreground font-mono uppercase mb-2">Output</p>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] text-muted-foreground">Resolution</span>
                  <span className="mako-chip bg-muted text-muted-foreground text-[9px]">1920×1080</span>
                </div>
                <OutputStatusChip state="live_output" />
              </div>
            </div>
          </div>
        </div>
      </div>
    </OperatorLayout>
  );
}
