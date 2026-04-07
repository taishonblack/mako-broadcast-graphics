import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import makoIllustration from '@/assets/mako-illustration.png';

export default function Login() {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    navigate('/dashboard');
  };

  return (
    <div className="flex min-h-screen" style={{ background: 'hsl(220, 20%, 7%)' }}>
      {/* Left — Illustration */}
      <div className="hidden lg:flex flex-1 items-center justify-center relative overflow-hidden">
        <div
          className="absolute inset-0"
          style={{
            background: 'linear-gradient(135deg, hsla(220, 20%, 10%, 1) 0%, hsla(220, 20%, 7%, 0.8) 100%)',
          }}
        />
        <img
          src={makoIllustration}
          alt="MakoVote"
          className="relative z-10 w-[60%] max-w-[480px] opacity-80"
          style={{ filter: 'drop-shadow(0 0 40px hsla(24, 95%, 53%, 0.15))' }}
        />
        {/* Version label */}
        <span className="absolute bottom-6 left-6 z-10 font-mono text-[11px] text-muted-foreground/40">
          MakoVote v0.1
        </span>
      </div>

      {/* Divider */}
      <div className="hidden lg:block w-px self-stretch my-12" style={{ background: 'linear-gradient(to bottom, transparent, hsla(220, 14%, 25%, 0.4), transparent)' }} />

      {/* Right — Login Form */}
      <div className="flex-1 flex flex-col items-center justify-center px-8 lg:max-w-lg">
        {/* System identity */}
        <span className="absolute top-6 right-6 lg:top-6 lg:left-auto font-mono text-[12px] text-muted-foreground/40 tracking-wider">
          MAKO SYSTEMS
        </span>

        <div className="w-full max-w-sm">
          {/* Glass panel */}
          <div
            className="rounded-2xl p-8 border"
            style={{
              background: 'hsla(220, 18%, 13%, 0.75)',
              backdropFilter: 'blur(12px)',
              borderColor: 'hsla(220, 14%, 25%, 0.3)',
              boxShadow: '0 8px 32px -8px hsla(0, 0%, 0%, 0.5)',
            }}
          >
            <div className="mb-8">
              <h1 className="text-xl font-semibold text-foreground tracking-tight">MakoVote</h1>
              <p className="text-sm text-muted-foreground mt-1">Broadcast polling control system</p>
            </div>

            <form onSubmit={handleLogin} className="flex flex-col gap-4">
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-medium text-muted-foreground">Email</label>
                <Input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="operator@makosystems.tv"
                  className="bg-background/50 border-border/50 focus:border-primary focus:ring-primary/15 h-11"
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-medium text-muted-foreground">Password</label>
                <Input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="bg-background/50 border-border/50 focus:border-primary focus:ring-primary/15 h-11"
                />
              </div>
              <Button type="submit" className="h-11 mt-2 font-medium">
                Sign In
              </Button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
