import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import makoIllustration from '@/assets/mako-illustration.png';
import heroCityscape from '@/assets/hero-cityscape.png';

export default function Login() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<'signin' | 'signup'>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    const { error } = mode === 'signin'
      ? await supabase.auth.signInWithPassword({ email, password })
      : await supabase.auth.signUp({
          email,
          password,
          options: { emailRedirectTo: `${window.location.origin}/polls/new?mode=output` },
        });

    if (error) {
      toast.error(error.message);
      setLoading(false);
      return;
    }

    toast.success(mode === 'signin' ? 'Signed in successfully' : 'Account created');
    navigate('/polls/new?mode=output');
  };

  return (
    <div className="flex min-h-screen relative" style={{ backgroundColor: '#F7F7F7' }}>
      {/* Top-left brand lockup — tightened */}
      <div className="absolute top-6 left-8 flex items-center z-20" style={{ gap: '6px' }}>
        <img
          src={makoIllustration}
          alt="MakoVote"
          style={{ width: '108px', height: 'auto' }}
        />
        <span style={{ fontSize: '64px', fontWeight: 600, lineHeight: 1, letterSpacing: '-1px' }}>
          <span style={{ color: '#111111' }}>Mako</span>
          <span style={{ color: '#E8743B' }}>Vote</span>
        </span>
      </div>

      {/* Version — bottom left */}
      <span className="absolute bottom-6 left-8 font-mono text-[11px] z-20" style={{ color: '#D1D5DB' }}>
        MakoVote v0.1
      </span>

      {/* LEFT — Hero illustration area */}
      <div className="hidden lg:flex flex-1 relative overflow-hidden" style={{ backgroundColor: 'rgb(249, 242, 222)' }}>
        <img
          src={heroCityscape}
          alt=""
          className="absolute inset-0 w-full h-full object-cover"
          style={{ opacity: 0.85, filter: 'blur(3px)' }}
        />
        {/* Overlay gradient: left transparent → right dark */}
        <div
          className="absolute inset-0 z-10 pointer-events-none"
          style={{
            background: 'linear-gradient(to right, transparent 30%, rgba(0,0,0,0.25) 100%)',
          }}
        />
      </div>

      {/* Divider */}
      <div
        className="hidden lg:block w-px self-stretch my-16 shrink-0"
        style={{ background: 'linear-gradient(to bottom, transparent, #E5E7EB, transparent)' }}
      />

      {/* RIGHT — Login Form */}
      <div className="flex-1 flex items-center justify-center px-8 lg:px-16 lg:max-w-[520px]">
        <div className="w-full max-w-sm">
          <div
            className="rounded-2xl p-8 border"
            style={{
              background: 'rgba(255, 255, 255, 0.75)',
              backdropFilter: 'blur(12px)',
              borderColor: 'rgba(0, 0, 0, 0.06)',
              boxShadow: '0 10px 40px -12px rgba(0, 0, 0, 0.08)',
            }}
          >
            <div className="mb-8">
              <h1 className="text-xl font-semibold tracking-tight" style={{ color: '#111111' }}>
                {mode === 'signin' ? 'Sign In' : 'Create Account'}
              </h1>
              <p className="text-[13px] mt-1" style={{ color: '#6B7280' }}>
                Broadcast polling control system
              </p>
            </div>

            <form onSubmit={handleSubmit} className="flex flex-col gap-4">
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-medium" style={{ color: '#9CA3AF' }}>Email</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="operator@makosystems.tv"
                  className="flex h-11 w-full rounded-lg px-3 py-2 text-sm outline-none transition-all"
                  style={{ border: '1px solid #E5E7EB', color: '#111111', background: 'rgba(255,255,255,0.6)' }}
                  onFocus={(e) => { e.target.style.borderColor = '#F97316'; e.target.style.boxShadow = '0 0 0 2px rgba(249,115,22,0.15)'; }}
                  onBlur={(e) => { e.target.style.borderColor = '#E5E7EB'; e.target.style.boxShadow = 'none'; }}
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-medium" style={{ color: '#9CA3AF' }}>Password</label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="flex h-11 w-full rounded-lg px-3 py-2 text-sm outline-none transition-all"
                  style={{ border: '1px solid #E5E7EB', color: '#111111', background: 'rgba(255,255,255,0.6)' }}
                  onFocus={(e) => { e.target.style.borderColor = '#F97316'; e.target.style.boxShadow = '0 0 0 2px rgba(249,115,22,0.15)'; }}
                  onBlur={(e) => { e.target.style.borderColor = '#E5E7EB'; e.target.style.boxShadow = 'none'; }}
                />
              </div>
              <button
                type="submit"
                disabled={loading}
                className="h-11 mt-2 rounded-lg font-medium text-sm transition-all active:scale-[0.98] disabled:opacity-60"
                style={{ background: '#F97316', color: '#FFFFFF' }}
                onMouseEnter={(e) => (e.currentTarget.style.background = '#EA580C')}
                onMouseLeave={(e) => (e.currentTarget.style.background = '#F97316')}
              >
                {loading
                  ? (mode === 'signin' ? 'Signing in…' : 'Creating account…')
                  : (mode === 'signin' ? 'Sign In' : 'Create Account')}
              </button>
              <button
                type="button"
                onClick={() => setMode(mode === 'signin' ? 'signup' : 'signin')}
                className="text-[12px] text-center mt-1"
                style={{ color: '#6B7280' }}
              >
                {mode === 'signin'
                  ? <>Don&rsquo;t have an account? <span style={{ color: '#F97316', fontWeight: 500 }}>Create one</span></>
                  : <>Already have an account? <span style={{ color: '#F97316', fontWeight: 500 }}>Sign in</span></>}
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
