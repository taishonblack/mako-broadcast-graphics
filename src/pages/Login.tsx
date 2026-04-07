import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import makoIllustration from '@/assets/mako-illustration.png';
import heroCityscape from '@/assets/hero-cityscape.png';

export default function Login() {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    navigate('/dashboard');
  };

  return (
    <div className="flex min-h-screen relative" style={{ backgroundColor: '#F7F7F7' }}>
      {/* Top-left brand lockup */}
      <div className="absolute top-6 left-8 flex items-center z-20" style={{ gap: '12px' }}>
        <img
          src={makoIllustration}
          alt="MakoVote"
          style={{ width: '120px', height: 'auto' }}
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
          style={{ opacity: 0.85 }}
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
                Sign In
              </h1>
              <p className="text-[13px] mt-1" style={{ color: '#6B7280' }}>
                Broadcast polling control system
              </p>
            </div>

            <form onSubmit={handleLogin} className="flex flex-col gap-4">
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
                className="h-11 mt-2 rounded-lg font-medium text-sm transition-all active:scale-[0.98]"
                style={{ background: '#F97316', color: '#FFFFFF' }}
                onMouseEnter={(e) => (e.currentTarget.style.background = '#EA580C')}
                onMouseLeave={(e) => (e.currentTarget.style.background = '#F97316')}
              >
                Sign In
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
