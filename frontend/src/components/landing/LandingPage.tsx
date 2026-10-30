import React, { useEffect, useRef, useState } from 'react';
import {
  ArrowRight,
  Boxes,
  Briefcase,
  CheckCircle2,
  Clock,
  FileSpreadsheet,
  FileText,
  Printer,
  Receipt,
  ShieldCheck,
  Users,
  Zap,
} from 'lucide-react';
import './landing.css';

const goTo = (hash: string) => {
  window.location.hash = hash;
};

/** Adds `is-visible` to [data-reveal] elements as they scroll into view. */
const useReveal = (root: React.RefObject<HTMLElement | null>) => {
  useEffect(() => {
    const els = root.current?.querySelectorAll<HTMLElement>('[data-reveal]');
    if (!els?.length) return;
    if (!('IntersectionObserver' in window)) {
      els.forEach((el) => el.classList.add('is-visible'));
      return;
    }
    const io = new IntersectionObserver(
      (entries) =>
        entries.forEach((e) => {
          if (e.isIntersecting) {
            e.target.classList.add('is-visible');
            io.unobserve(e.target);
          }
        }),
      { threshold: 0.15, rootMargin: '0px 0px -40px 0px' }
    );
    els.forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, [root]);
};

/** Counts from 0 to `target` once `start` turns true. */
const useCountUp = (target: number, start: boolean, duration = 1400) => {
  const [value, setValue] = useState(0);
  useEffect(() => {
    if (!start) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setValue(target);
      return;
    }
    let frame = 0;
    const t0 = performance.now();
    const tick = (now: number) => {
      const p = Math.min(1, (now - t0) / duration);
      setValue(Math.round(target * (1 - Math.pow(1 - p, 3))));
      if (p < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [target, start, duration]);
  return value;
};

const inr = (n: number) => `₹${n.toLocaleString('en-IN')}`;

const FEATURES: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  text: string;
  tone?: 'amber' | 'green';
}[] = [
  {
    icon: Briefcase,
    title: 'Work entries & daily work',
    text: 'Every job with its work code, stage, W/O and GST bill. Log each day: what was done, who worked, hours and site spend.',
  },
  {
    icon: Users,
    title: 'Labour & wages',
    text: 'Permanent and casual workers with hourly rates. Mark each wage Given or Pending, with the payment mode.',
    tone: 'green',
  },
  {
    icon: Receipt,
    title: 'Expense tracker',
    text: 'Income, money to get, site purchases and wages in one list, with filters and Received / To get / Pending totals.',
    tone: 'amber',
  },
  {
    icon: FileSpreadsheet,
    title: 'Quotations',
    text: 'Priced quotations with supply and labour split and GST, or write one freely on A4 pages like a Word document.',
  },
  {
    icon: Boxes,
    title: 'Polevar material reports',
    text: 'Materials issued, labour and items taken back per location, in the familiar Polevar sheet layout.',
    tone: 'amber',
  },
  {
    icon: Printer,
    title: 'Branded prints & PDFs',
    text: 'Your logo, GSTIN, PAN and contact details on every work report, statement and quotation.',
    tone: 'green',
  },
];

const BAR_HEIGHTS = [38, 62, 48, 80, 56, 92, 70];

export const LandingPage: React.FC = () => {
  const rootRef = useRef<HTMLDivElement>(null);
  const stripRef = useRef<HTMLDivElement>(null);
  const [scrolled, setScrolled] = useState(false);
  const [stripVisible, setStripVisible] = useState(false);

  useReveal(rootRef);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  useEffect(() => {
    const el = stripRef.current;
    if (!el || !('IntersectionObserver' in window)) {
      setStripVisible(true);
      return;
    }
    const io = new IntersectionObserver(([e]) => e.isIntersecting && setStripVisible(true), { threshold: 0.4 });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  // Demo figures for the product preview (sample data, not real accounts)
  const received = useCountUp(185000, true, 1600);
  const toGet = useCountUp(42500, true, 1600);
  const wages = useCountUp(31200, true, 1600);
  const modules = useCountUp(6, stripVisible, 900);
  const statuses = useCountUp(2, stripVisible, 900);

  const scrollTo = (id: string) => (e: React.MouseEvent) => {
    e.preventDefault();
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  /** Moves the hover glow on feature cards to follow the cursor */
  const trackGlow = (e: React.MouseEvent<HTMLDivElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    e.currentTarget.style.setProperty('--mx', `${e.clientX - r.left}px`);
    e.currentTarget.style.setProperty('--my', `${e.clientY - r.top}px`);
  };

  return (
    <div ref={rootRef} className="lp">
      {/* Nav */}
      <header className={`lp-nav ${scrolled ? 'is-scrolled' : ''}`}>
        <div className="lp-container lp-nav-inner">
          <a href="#/" className="lp-brand" onClick={scrollTo('top')}>
            <span className="lp-logo">
              <Zap className="h-5 w-5 fill-white text-white" />
            </span>
            VoltCRM
          </a>
          <nav className="lp-links">
            <a href="#features" onClick={scrollTo('features')}>Features</a>
            <a href="#how" onClick={scrollTo('how')}>How it works</a>
            <a href="#prints" onClick={scrollTo('prints')}>Prints & PDFs</a>
          </nav>
          <div className="lp-actions">
            <button type="button" className="lp-btn lp-btn-ghost" onClick={() => goTo('#/login')}>
              Sign in
            </button>
            <button type="button" className="lp-btn lp-btn-primary" onClick={() => goTo('#/signup')}>
              Get started
            </button>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section id="top" className="lp-hero">
        <div className="lp-hero-glow" />
        <div className="lp-grid-bg" />
        <div className="lp-container lp-hero-inner">
          <div>
            <span className="lp-pill" data-hero style={{ '--d': '0ms' } as React.CSSProperties}>
              <span className="lp-pill-dot">New</span>
              Write quotations like a Word document
            </span>
            <h1 className="lp-h1" data-hero style={{ '--d': '80ms' } as React.CSSProperties}>
              Run every electrical job <span className="lp-gradient-text">from one place.</span>
            </h1>
            <p className="lp-lead" data-hero style={{ '--d': '160ms' } as React.CSSProperties}>
              VoltCRM keeps your work orders, daily site work, labour wages, expenses, quotations and Polevar
              reports together, so you always know what's done, what's paid and what's still pending.
            </p>
            <div className="lp-cta-row" data-hero style={{ '--d': '240ms' } as React.CSSProperties}>
              <button type="button" className="lp-btn lp-btn-primary lp-btn-lg" onClick={() => goTo('#/signup')}>
                Get started
                <ArrowRight className="h-4 w-4" />
              </button>
              <button type="button" className="lp-btn lp-btn-ghost lp-btn-lg" onClick={() => goTo('#/login')}>
                Sign in to workspace
              </button>
            </div>
            <div className="lp-checks" data-hero style={{ '--d': '320ms' } as React.CSSProperties}>
              <span><CheckCircle2 className="h-4 w-4 text-emerald-400" /> Works on phone & desktop</span>
              <span><CheckCircle2 className="h-4 w-4 text-emerald-400" /> PDF reports in one click</span>
              <span><ShieldCheck className="h-4 w-4 text-emerald-400" /> Your data, your account</span>
            </div>
          </div>

          <div className="lp-visual" data-hero style={{ '--d': '200ms' } as React.CSSProperties} aria-hidden="true">
            {/* Power line with current running along the wires */}
            <svg className="lp-powerline" viewBox="0 0 640 220" preserveAspectRatio="none">
              {[40, 320, 600].map((x) => (
                <g key={x}>
                  <line className="lp-pole" x1={x} y1="30" x2={x} y2="220" />
                  <line className="lp-pole" x1={x - 26} y1="44" x2={x + 26} y2="44" />
                  <circle className="lp-insulator" cx={x - 22} cy="40" r="3" />
                  <circle className="lp-insulator" cx={x + 22} cy="40" r="3" style={{ animationDelay: '-1.3s' }} />
                </g>
              ))}
              <path className="lp-wire" d="M18 40 Q180 92 298 40 Q460 92 578 40" />
              <path className="lp-wire" d="M62 40 Q180 84 342 40 Q470 84 622 40" />
              <path className="lp-current" pathLength={100} d="M18 40 Q180 92 298 40 Q460 92 578 40" />
              <path className="lp-current c2" pathLength={100} d="M62 40 Q180 84 342 40 Q470 84 622 40" />
            </svg>

            {/* Product preview with sample figures */}
            <div className="lp-dash">
              <div className="lp-dash-top">
                <div className="lp-dots"><i /><i /><i /></div>
                <span className="lp-muted" style={{ fontSize: 11 }}>Sample dashboard</span>
              </div>
              <div className="lp-stats">
                <div className="lp-stat"><small>Received</small><b>{inr(received)}</b></div>
                <div className="lp-stat"><small>To get</small><b style={{ color: '#fbbf24' }}>{inr(toGet)}</b></div>
                <div className="lp-stat"><small>Wages paid</small><b>{inr(wages)}</b></div>
              </div>
              <div className="lp-bars">
                {BAR_HEIGHTS.map((h, i) => (
                  <span key={i} style={{ height: `${h}%`, animationDelay: `${400 + i * 90}ms` }} />
                ))}
              </div>
              <div className="lp-rows">
                <div className="lp-row"><span>WRK-2610 · 11kV feeder line</span><span className="lp-chip progress">In progress</span></div>
                <div className="lp-row"><span>Ramesh · 8h · ₹1,600</span><span className="lp-chip given">Given</span></div>
                <div className="lp-row"><span>Diesel & transport · ₹2,400</span><span className="lp-chip pending">Pending</span></div>
              </div>

              <div className="lp-toast">
                <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                Daily work saved · 6 workers
              </div>
              <div className="lp-toast t2">
                <Clock className="h-4 w-4 text-amber-400" />
                ₹42,500 still to get from client
              </div>
            </div>

          </div>
        </div>

        {/* Quick facts */}
        <div className="lp-container">
          <div ref={stripRef} className="lp-strip">
            <div className="lp-strip-item" data-reveal><b>{modules}</b><span>modules in one app</span></div>
            <div className="lp-strip-item" data-reveal style={{ '--d': '80ms' } as React.CSSProperties}>
              <b>{statuses}-tap</b><span>Given / Pending tracking</span>
            </div>
            <div className="lp-strip-item" data-reveal style={{ '--d': '160ms' } as React.CSSProperties}>
              <b>A4</b><span>print-ready PDFs</span>
            </div>
            <div className="lp-strip-item" data-reveal style={{ '--d': '240ms' } as React.CSSProperties}>
              <b>24/7</b><span>access from any device</span>
            </div>
          </div>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="lp-section">
        <div className="lp-container">
          <div className="lp-section-head" data-reveal>
            <span className="lp-eyebrow">Everything on site, sorted</span>
            <h2 className="lp-h2">Built for electrical contractors</h2>
            <p className="lp-muted">
              From the work order to the final bill: the records you keep in registers and spreadsheets, in one simple app.
            </p>
          </div>
          <div className="lp-features">
            {FEATURES.map((f, i) => (
              <div
                key={f.title}
                className={`lp-feature ${f.tone || ''}`}
                data-reveal
                style={{ '--d': `${(i % 3) * 90}ms` } as React.CSSProperties}
                onMouseMove={trackGlow}
              >
                <span className="lp-feature-icon">
                  <f.icon className="h-5 w-5" />
                </span>
                <h3>{f.title}</h3>
                <p>{f.text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How it works */}
      <section id="how" className="lp-section alt">
        <div className="lp-container">
          <div className="lp-section-head" data-reveal>
            <span className="lp-eyebrow">How it works</span>
            <h2 className="lp-h2">Three steps, every day</h2>
          </div>
          <div className="lp-steps" data-reveal>
            <div className="lp-steps-line" />
            {[
              ['1', 'Add the work', 'Enter the work code, site, stage and contract amount once.'],
              ['2', 'Log daily work', 'Pick the crew, hours and site expenses. Mark wages Given or Pending.'],
              ['3', 'Print & get paid', 'Share branded reports and quotations, and follow what is still to get.'],
            ].map(([n, t, d]) => (
              <div key={n} className="lp-step">
                <span className="lp-step-num">{n}</span>
                <h3>{t}</h3>
                <p>{d}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Prints */}
      <section id="prints" className="lp-section">
        <div className="lp-container lp-split">
          <div data-reveal>
            <span className="lp-eyebrow">Prints & PDFs</span>
            <h2 className="lp-h2">Professional documents with your name on them</h2>
            <p className="lp-muted">
              Set your company details once. Every print carries your logo and registration details.
            </p>
            <ul className="lp-list">
              {[
                'Quotations with supply & labour split, GST and your PAN',
                'Written quotations on A4 pages with bold, lists and tables',
                'Work reports with daily work, crew and site expenses',
                'Expense statements filtered by work, date or status',
              ].map((t) => (
                <li key={t}>
                  <CheckCircle2 className="h-5 w-5" />
                  {t}
                </li>
              ))}
            </ul>
          </div>
          <div data-reveal style={{ '--d': '120ms' } as React.CSSProperties}>
            <div className="lp-doc" aria-hidden="true">
              <div className="lp-doc-head">
                <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                  <span className="lp-logo" style={{ width: 30, height: 30 }}>
                    <Zap className="h-4 w-4 fill-white text-white" />
                  </span>
                  <div>
                    <div style={{ fontWeight: 800, fontSize: 13 }}>YOUR COMPANY NAME</div>
                    <div style={{ fontSize: 9, color: '#64748b' }}>GSTIN · PAN · Contact · Email</div>
                  </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <span className="lp-doc-tag">QUOTATION</span>
                  <div style={{ fontSize: 9, color: '#64748b', marginTop: 6 }}>Ref: QT-0001</div>
                </div>
              </div>
              <div style={{ fontSize: 9, fontWeight: 700, color: '#94a3b8', letterSpacing: '0.08em' }}>QUOTATION ISSUED TO</div>
              <div style={{ fontWeight: 700, fontSize: 13, marginTop: 2 }}>Client name</div>
              <table>
                <thead>
                  <tr><th>Item</th><th>Qty</th><th>Amount</th></tr>
                </thead>
                <tbody>
                  <tr><td>9M PSC pole erection</td><td>4</td><td>₹50,000</td></tr>
                  <tr><td>11kV XLPE cable laying</td><td>120 m</td><td>₹36,000</td></tr>
                  <tr><td>Earthing with pipe</td><td>2</td><td>₹8,400</td></tr>
                </tbody>
              </table>
              <div className="lp-doc-line" style={{ width: '70%', marginTop: 16 }} />
              <div className="lp-doc-line" style={{ width: '45%' }} />
              <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 12 }}>
                <div style={{ fontWeight: 800, fontSize: 13 }}>Total incl. GST: ₹1,11,392</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="lp-section" style={{ paddingTop: 24 }}>
        <div className="lp-container">
          <div className="lp-cta" data-reveal>
            <Zap className="lp-cta-bolt h-72 w-72 fill-current" />
            <span className="lp-eyebrow">Ready when you are</span>
            <h2 className="lp-h2">Put your next job in VoltCRM</h2>
            <p className="lp-muted" style={{ maxWidth: 520, margin: '0 auto' }}>
              Create your account in a minute and add your first work entry today.
            </p>
            <div className="lp-cta-row" style={{ justifyContent: 'center' }}>
              <button type="button" className="lp-btn lp-btn-primary lp-btn-lg" onClick={() => goTo('#/signup')}>
                Create account
                <ArrowRight className="h-4 w-4" />
              </button>
              <button type="button" className="lp-btn lp-btn-ghost lp-btn-lg" onClick={() => goTo('#/login')}>
                <FileText className="h-4 w-4" />
                I already have an account
              </button>
            </div>
          </div>
        </div>
      </section>

      <footer className="lp-footer">
        <div className="lp-container lp-footer-inner">
          <span className="lp-brand" style={{ fontSize: 15 }}>
            <span className="lp-logo" style={{ width: 26, height: 26, borderRadius: 8 }}>
              <Zap className="h-3.5 w-3.5 fill-white text-white" />
            </span>
            VoltCRM
          </span>
          <span>Electrical contracting & operations management · © {new Date().getFullYear()}</span>
        </div>
      </footer>
    </div>
  );
};
