import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { CheckCircle, Clock, XCircle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

type ViewerStatus = 'loading' | 'not_found' | 'not_open' | 'open' | 'closed';

interface ViewerAnswer {
  id: string;
  label: string;
  short_label: string;
  sort_order: number;
}

interface ViewerPoll {
  id: string;
  project_id: string | null;
  question: string;
  subheadline: string;
  bg_color: string;
  bg_image: string | null;
  show_live_results: boolean;
  show_thank_you: boolean;
  show_final_results: boolean;
  slate_text: string;
  slate_subline_text: string;
}

export default function ViewerVote() {
  const { slug = '' } = useParams<{ slug: string }>();
  const [status, setStatus] = useState<ViewerStatus>('loading');
  const [poll, setPoll] = useState<ViewerPoll | null>(null);
  const [answers, setAnswers] = useState<ViewerAnswer[]>([]);
  const [hasVoted, setHasVoted] = useState(false);
  const [, setSelectedOption] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      if (!slug) { setStatus('not_found'); return; }
      const { data: pollRow } = await supabase
        .from('polls')
        .select('id, project_id, question, subheadline, bg_color, bg_image, show_live_results, show_thank_you, show_final_results, slate_text, slate_subline_text')
        .eq('viewer_slug', slug)
        .maybeSingle();
      if (cancelled) return;
      if (!pollRow) { setStatus('not_found'); return; }
      setPoll(pollRow as ViewerPoll);

      const [{ data: answerRows }, liveStateRes] = await Promise.all([
        supabase
          .from('poll_answers')
          .select('id, label, short_label, sort_order')
          .eq('poll_id', pollRow.id)
          .order('sort_order', { ascending: true }),
        pollRow.project_id
          ? supabase
              .from('project_live_state')
              .select('voting_state, active_poll_id')
              .eq('project_id', pollRow.project_id)
              .maybeSingle()
          : Promise.resolve({ data: null } as { data: null }),
      ]);
      if (cancelled) return;

      setAnswers((answerRows ?? []) as ViewerAnswer[]);

      const live = (liveStateRes as { data: { voting_state?: string; active_poll_id?: string | null } | null }).data;
      const votingState = live?.voting_state ?? 'not_open';
      const isThisPollLive = !live || live.active_poll_id === pollRow.id;

      if (votingState === 'open' && isThisPollLive) setStatus('open');
      else if (votingState === 'closed' && isThisPollLive) setStatus('closed');
      else setStatus('not_open');
    };
    load();
    return () => { cancelled = true; };
  }, [slug]);

  const handleVote = (optionId: string) => {
    setSelectedOption(optionId);
    setTimeout(() => setHasVoted(true), 300);
  };

  const bgStyle: React.CSSProperties = poll?.bg_image
    ? { backgroundImage: `url(${poll.bg_image})`, backgroundSize: 'cover', backgroundPosition: 'center' }
    : { background: poll?.bg_color || 'hsl(220, 20%, 7%)' };

  // ---- Loading ----
  if (status === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center px-6 animate-fade-in" style={{ background: 'hsl(220, 20%, 7%)' }}>
        <MakoVoteSlate sublabel="Loading…" />
      </div>
    );
  }

  // ---- Slug not found OR not open: show MakoVote slate ----
  if (status === 'not_found' || status === 'not_open') {
    return (
      <div className="min-h-screen flex items-center justify-center px-6 animate-fade-in" style={bgStyle}>
        <div className="text-center space-y-4 bg-background/40 backdrop-blur-md rounded-2xl px-8 py-10 border border-white/10">
          {status === 'not_open' && (
            <div className="w-16 h-16 rounded-full bg-muted/30 flex items-center justify-center mx-auto">
              <Clock className="w-8 h-8 text-muted-foreground" />
            </div>
          )}
          <MakoVoteSlate sublabel={status === 'not_open' ? (poll?.slate_text || 'Polling will open soon') : undefined} />
          {status === 'not_open' && poll?.slate_subline_text && (
            <p className="text-sm text-muted-foreground">{poll.slate_subline_text}</p>
          )}
        </div>
      </div>
    );
  }

  // ---- Closed ----
  if (status === 'closed') {
    return (
      <div className="min-h-screen flex items-center justify-center px-6 animate-fade-in" style={bgStyle}>
        <div className="text-center space-y-4 bg-background/40 backdrop-blur-md rounded-2xl px-8 py-10 border border-white/10">
          <div className="w-16 h-16 rounded-full bg-mako-warning/20 flex items-center justify-center mx-auto">
            <XCircle className="w-8 h-8 text-mako-warning" />
          </div>
          <h1 className="text-xl font-bold text-foreground">Polling is Closed</h1>
          <p className="text-sm text-muted-foreground">Thanks for participating!</p>
          <BrandBug />
        </div>
      </div>
    );
  }

  // ---- Vote received ----
  if (hasVoted) {
    return (
      <div className="min-h-screen flex items-center justify-center px-6 animate-fade-in" style={bgStyle}>
        <div className="text-center space-y-4 bg-background/40 backdrop-blur-md rounded-2xl px-8 py-10 border border-white/10">
          <div className="w-16 h-16 rounded-full bg-mako-success/20 flex items-center justify-center mx-auto">
            <CheckCircle className="w-8 h-8 text-mako-success" />
          </div>
          <h1 className="text-xl font-bold text-foreground">Vote Received</h1>
          <p className="text-sm text-muted-foreground">Your vote has been counted</p>
          <BrandBug />
        </div>
      </div>
    );
  }

  // ---- Active voting ----
  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-6 py-12 animate-fade-in" style={bgStyle}>
      <div className="w-full max-w-sm space-y-8 bg-background/40 backdrop-blur-md rounded-2xl p-6 border border-white/10">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-foreground leading-tight">{poll?.question || 'Cast your vote'}</h1>
          {poll?.subheadline && <p className="text-sm text-muted-foreground mt-2">{poll.subheadline}</p>}
        </div>
        <div className="space-y-3">
          {answers.map((option) => (
            <button
              key={option.id}
              onClick={() => handleVote(option.id)}
              className="w-full p-4 rounded-2xl text-left font-medium text-foreground transition-all active:scale-[0.98] border border-border/50 hover:border-primary/50 hover:bg-primary/5"
              style={{ background: 'hsla(220, 18%, 13%, 0.8)' }}
            >
              <span className="text-base">{option.label}</span>
            </button>
          ))}
        </div>
        <BrandBug />
      </div>
    </div>
  );
}

function MakoVoteSlate({ sublabel }: { sublabel?: string }) {
  return (
    <div className="space-y-2">
      <div className="flex items-baseline justify-center font-bold leading-none select-none text-4xl">
        <span className="text-foreground/90">Mako</span>
        <span className="text-primary">Vote</span>
      </div>
      {sublabel && <p className="text-xs font-mono uppercase tracking-wider text-muted-foreground/80 pt-1">{sublabel}</p>}
    </div>
  );
}

function BrandBug() {
  return (
    <div className="flex items-center justify-center gap-2 pt-4 opacity-30">
      <div className="w-4 h-4 rounded bg-primary flex items-center justify-center">
        <span className="text-primary-foreground font-bold text-[8px]">M</span>
      </div>
      <span className="font-mono text-[10px] text-muted-foreground">MakoVote</span>
    </div>
  );
}
