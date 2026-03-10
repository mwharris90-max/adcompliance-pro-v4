"use client";

import { useEffect, useRef } from "react";
import Link from "next/link";

function RadarIcon({ size = 44 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" fill="none">
      <circle cx="32" cy="32" r="28" stroke="#0e9488" strokeWidth="0.8" strokeOpacity="0.25" fill="none" />
      <circle cx="32" cy="32" r="20" stroke="#0e9488" strokeWidth="1" strokeOpacity="0.36" fill="none" />
      <circle cx="32" cy="32" r="12" stroke="#0e9488" strokeWidth="1.1" strokeOpacity="0.52" fill="none" />
      <line x1="32" y1="4" x2="32" y2="60" stroke="#0e9488" strokeWidth="0.5" strokeOpacity="0.14" />
      <line x1="4" y1="32" x2="60" y2="32" stroke="#0e9488" strokeWidth="0.5" strokeOpacity="0.14" />
      <g className="aug-sweep-group" style={{ transformOrigin: "32px 32px" }}>
        <line x1="32" y1="32" x2="32" y2="4" stroke="url(#ng)" strokeWidth="1.8" strokeLinecap="round" />
        <polygon points="32,32 27,4 37,4" fill="url(#nf)" opacity="0.2" />
      </g>
      <circle cx="46" cy="18" r="2.5" fill="#2dd4bf" opacity="0.9" />
      <circle cx="32" cy="32" r="3" fill="#2dd4bf" />
      <defs>
        <linearGradient id="ng" x1="32" y1="32" x2="32" y2="4" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#2dd4bf" stopOpacity="0.95" />
          <stop offset="100%" stopColor="#2dd4bf" stopOpacity="0" />
        </linearGradient>
        <linearGradient id="nf" x1="32" y1="4" x2="32" y2="32" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#2dd4bf" stopOpacity="0.38" />
          <stop offset="100%" stopColor="#0d9488" stopOpacity="0" />
        </linearGradient>
      </defs>
    </svg>
  );
}

export default function LandingPage() {
  const navRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const nav = navRef.current;
    if (!nav) return;
    const onScroll = () => {
      nav.classList.toggle("scrolled", window.scrollY > 20);
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) {
            (e.target as HTMLElement).style.animation = "augFadeUp 0.7s ease forwards";
            observer.unobserve(e.target);
          }
        });
      },
      { threshold: 0.12 }
    );

    document.querySelectorAll(
      ".aug-problem-card,.aug-feature-row,.aug-audience-card,.aug-pricing-card,.aug-testi-card,.aug-policy-card,.aug-stat-card,.aug-step"
    ).forEach((el) => observer.observe(el));

    return () => observer.disconnect();
  }, []);

  const tickerItems = [
    { label: "Google Ads", desc: "Policy Compliance" },
    { label: "Meta / Facebook", desc: "Ad Rules" },
    { label: "Instagram", desc: "Content Policies" },
    { label: "Alcohol & Gambling", desc: "Regulations" },
    { label: "Financial Services", desc: "FCA / SEC" },
    { label: "Healthcare", desc: "Pharma Standards" },
    { label: "Geo-Targeting", desc: "Jurisdiction Checks" },
    { label: "Bulk CSV", desc: "Upload & Scan" },
  ];

  return (
    <div className="augur-landing">
      {/* NAV */}
      <nav ref={navRef} className="aug-nav">
        <Link href="/" className="aug-nav-logo">
          <RadarIcon />
          <span className="aug-nav-wordmark">Augur</span>
        </Link>
        <ul className="aug-nav-links">
          <li><a href="#how">How it works</a></li>
          <li><a href="#features">Features</a></li>
          <li><a href="#audience">Who it&apos;s for</a></li>
          <li><a href="#policy">Policy Library</a></li>
          <li><a href="#pricing">Pricing</a></li>
        </ul>
        <div className="aug-nav-right">
          <Link href="/login" className="aug-btn aug-btn-ghost">Sign in</Link>
          <Link href="/login" className="aug-btn aug-btn-teal">Start free trial</Link>
        </div>
      </nav>

      {/* HERO */}
      <section className="aug-hero">
        <div className="aug-hero-grid" />
        <div className="aug-hero-glow" />
        <div className="aug-hero-radar-bg">
          <svg width="900" height="900" viewBox="0 0 900 900" fill="none">
            <circle cx="450" cy="450" r="420" stroke="#2dd4bf" strokeWidth="1" />
            <circle cx="450" cy="450" r="310" stroke="#2dd4bf" strokeWidth="1" />
            <circle cx="450" cy="450" r="200" stroke="#2dd4bf" strokeWidth="1" />
            <circle cx="450" cy="450" r="100" stroke="#2dd4bf" strokeWidth="1" />
            <line x1="450" y1="0" x2="450" y2="900" stroke="#2dd4bf" strokeWidth="0.7" />
            <line x1="0" y1="450" x2="900" y2="450" stroke="#2dd4bf" strokeWidth="0.7" />
            <line x1="153" y1="153" x2="747" y2="747" stroke="#2dd4bf" strokeWidth="0.5" strokeOpacity="0.5" />
            <line x1="747" y1="153" x2="153" y2="747" stroke="#2dd4bf" strokeWidth="0.5" strokeOpacity="0.5" />
          </svg>
        </div>

        <div className="aug-hero-eyebrow">
          <div className="aug-eyebrow-dot" />
          AI-Powered &middot; Multi-Platform &middot; Multi-Jurisdiction
        </div>

        <h1>Ad compliance intelligence.<br /><em>Built for agencies that can&apos;t afford to get it wrong.</em></h1>

        <p className="aug-hero-sub">
          Augur checks your ads across Google, Meta, and Instagram against platform policies, geographic regulations, and industry-specific rules — before a single campaign goes live.
        </p>

        <div className="aug-hero-actions">
          <Link href="/login" className="aug-btn aug-btn-teal aug-btn-xl">Start for free &rarr;</Link>
          <a href="#how" className="aug-btn aug-btn-ghost aug-btn-lg">See how it works</a>
        </div>

        <div className="aug-hero-proof">
          <div className="aug-proof-stack">
            <div className="aug-proof-av" style={{ background: "#6366f1" }}>JM</div>
            <div className="aug-proof-av" style={{ background: "#0ea5e9" }}>SR</div>
            <div className="aug-proof-av" style={{ background: "#d97706" }}>AL</div>
            <div className="aug-proof-av" style={{ background: "#059669" }}>KP</div>
            <div className="aug-proof-av" style={{ background: "#7c3aed" }}>DH</div>
          </div>
          <p className="aug-proof-text"><strong>Agency teams &amp; SaaS companies</strong> run checks every day</p>
        </div>

        {/* Mock screen */}
        <div className="aug-hero-screen-wrap">
          <div className="aug-hero-screen">
            <div className="aug-screen-bar">
              <div className="aug-screen-dot" style={{ background: "#f87171" }} />
              <div className="aug-screen-dot" style={{ background: "#fbbf24" }} />
              <div className="aug-screen-dot" style={{ background: "#4ade80" }} />
              <div className="aug-screen-url">augurcompliance.com/app/dashboard</div>
            </div>
            <div className="aug-screen-body">
              <div className="aug-screen-card">
                <div className="aug-sc-label">Total Checks</div>
                <div className="aug-sc-value">2,847</div>
                <div className="aug-sc-sub aug-sc-teal">&uarr; 18% this month</div>
              </div>
              <div className="aug-screen-card">
                <div className="aug-sc-label">Issues Caught</div>
                <div className="aug-sc-value aug-sc-amber">364</div>
                <div className="aug-sc-sub">Before going live</div>
              </div>
              <div className="aug-screen-card">
                <div className="aug-sc-label">Accounts Safe</div>
                <div className="aug-sc-value aug-sc-teal">100%</div>
                <div className="aug-sc-sub">No suspensions</div>
              </div>
            </div>
            <div className="aug-screen-results">
              <div className="aug-result-row">
                <span className="aug-result-badge aug-badge-violation">Violation</span>
                <span className="aug-result-platform">Google Ads</span>
                <span className="aug-result-msg">Missing disclaimer — financial services UK</span>
              </div>
              <div className="aug-result-row">
                <span className="aug-result-badge aug-badge-pass">Pass</span>
                <span className="aug-result-platform">Meta / Instagram</span>
                <span className="aug-result-msg">Age gating verified — alcohol category</span>
              </div>
              <div className="aug-result-row">
                <span className="aug-result-badge aug-badge-warn">Warning</span>
                <span className="aug-result-platform">Facebook</span>
                <span className="aug-result-msg">Superlative language — gambling sector</span>
              </div>
              <div className="aug-result-row">
                <span className="aug-result-badge aug-badge-pass">Pass</span>
                <span className="aug-result-platform">Google Ads</span>
                <span className="aug-result-msg">Healthcare — all pharmaceutical checks clear</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* TICKER */}
      <div className="aug-ticker-wrap">
        <div className="aug-ticker-inner">
          {[...tickerItems, ...tickerItems].map((item, i) => (
            <div key={i} className="aug-ticker-item">
              <div className="aug-ticker-dot" />
              <strong>{item.label}</strong> {item.desc}
            </div>
          ))}
        </div>
      </div>

      {/* PROBLEM */}
      <section style={{ padding: "100px 0", background: "var(--aug-bg2)" }}>
        <div className="aug-container">
          <div style={{ textAlign: "center", maxWidth: 660, margin: "0 auto 60px" }}>
            <p className="aug-section-label">The problem</p>
            <h2 className="aug-section-h">One compliance failure can suspend an entire account</h2>
            <p className="aug-section-sub" style={{ margin: "0 auto" }}>
              For agencies managing multiple clients across regulated categories — and SaaS companies scaling paid acquisition globally — the cost of a compliance failure extends far beyond a rejected ad.
            </p>
          </div>
          <div className="aug-problem-grid">
            <div className="aug-problem-card">
              <div className="aug-problem-num aug-text-red">27,378</div>
              <h3>Ads amended or withdrawn after ASA enforcement in 2023</h3>
              <p>92% were identified through proactive regulatory monitoring — not complaints. Regulators are no longer waiting for the public to report violations.</p>
              <div style={{ marginTop: 16, fontSize: 11, color: "var(--aug-text-dim)", fontFamily: "'IBM Plex Mono', monospace" }}>Source: ASA &amp; CAP Annual Report 2023</div>
            </div>
            <div className="aug-problem-card">
              <div className="aug-problem-num aug-text-amber">28M</div>
              <h3>Online ads scanned by the ASA&apos;s AI system in 2024</h3>
              <p>Up from 3 million in 2023. The ASA is on track to reach 50 million scans per year by end of 2025 — expanding enforcement reach across every major ad channel.</p>
              <div style={{ marginTop: 16, fontSize: 11, color: "var(--aug-text-dim)", fontFamily: "'IBM Plex Mono', monospace" }}>Source: ASA Active Ad Monitoring Briefing Note, 2025</div>
            </div>
            <div className="aug-problem-card">
              <div className="aug-problem-num aug-text-teal">94%</div>
              <h3>Of withdrawn ads in 2024 identified by automated monitoring, not complaints</h3>
              <p>The shift from complaints-led to AI-led enforcement means no campaign is below the radar. Proactive detection is now the primary mechanism for regulatory action.</p>
              <div style={{ marginTop: 16, fontSize: 11, color: "var(--aug-text-dim)", fontFamily: "'IBM Plex Mono', monospace" }}>Source: ASA &amp; CAP Annual Report 2024</div>
            </div>
          </div>
        </div>
      </section>

      {/* HOW IT WORKS */}
      <section id="how">
        <div className="aug-container">
          <div style={{ textAlign: "center", maxWidth: 640, margin: "0 auto 60px" }}>
            <p className="aug-section-label">How it works</p>
            <h2 className="aug-section-h">From brief to <em>clear to launch</em> in six steps</h2>
            <p className="aug-section-sub" style={{ margin: "0 auto" }}>
              A structured compliance workflow that checks your ads against the exact rules that apply to your platforms, industry categories, and target markets.
            </p>
          </div>
          <div className="aug-how-steps">
            {[
              { num: "01", title: "Channels", desc: "Select Google Ads, Facebook, or Instagram", active: true },
              { num: "02", title: "Ad Copy", desc: "Paste headlines, descriptions & body text" },
              { num: "03", title: "Assets", desc: "Upload images and video creatives" },
              { num: "04", title: "Category", desc: "Tag industry -- alcohol, gambling, finance, health" },
              { num: "05", title: "Geo", desc: "Select target countries & jurisdictions" },
              { num: "06", title: "Review", desc: "AI returns violations, warnings & passes" },
            ].map((step) => (
              <div key={step.num} className="aug-step">
                <div className={`aug-step-num${step.active ? " active" : ""}`}>{step.num}</div>
                <h4>{step.title}</h4>
                <p>{step.desc}</p>
              </div>
            ))}
          </div>

          <div style={{ textAlign: "center", margin: "48px 0 32px", color: "var(--aug-text-dim)", fontSize: 13, letterSpacing: ".12em", textTransform: "uppercase" as const, fontFamily: "'IBM Plex Mono', monospace" }}>
            — or go even faster —
          </div>

          <div style={{ background: "var(--aug-surface)", border: "1px solid var(--aug-border2)", borderRadius: "var(--aug-radius)", padding: 44, display: "flex", alignItems: "center", gap: 44 }}>
            <div style={{ flex: 1 }}>
              <div className="aug-label" style={{ marginBottom: 12 }}>Bulk Upload</div>
              <h3 style={{ fontSize: 24, marginBottom: 12 }}>Bulk-check entire campaigns in a single upload</h3>
              <p style={{ fontSize: 15, color: "var(--aug-text-mid)", lineHeight: 1.7, marginBottom: 20 }}>
                Export directly from Google Ads Editor and drop your CSV into Augur. Every row is scanned against platform policies and jurisdiction rules, with a full violation report returned immediately.
              </p>
              <ul className="aug-feat-bullets">
                <li>Supports Google Ads Editor CSV format</li>
                <li>Up to 10MB / unlimited rows on Agency plans</li>
                <li>Results downloadable as compliance report</li>
              </ul>
            </div>
            <div style={{ flexShrink: 0, textAlign: "center", padding: "32px 40px", background: "var(--aug-bg3)", border: "2px dashed var(--aug-border2)", borderRadius: 12, minWidth: 220 }}>
              <div style={{ fontSize: 40, marginBottom: 12 }}>&#128196;</div>
              <div style={{ fontSize: 13, fontWeight: 600, color: "var(--aug-text)", marginBottom: 6 }}>Drop CSV here</div>
              <div style={{ fontSize: 12, color: "var(--aug-text-dim)" }}>or click to browse</div>
              <div style={{ marginTop: 16, fontSize: 11, color: "var(--aug-teal)", fontFamily: "'IBM Plex Mono', monospace" }}>.csv &middot; up to 10 MB</div>
            </div>
          </div>
        </div>
      </section>

      {/* FEATURES */}
      <section id="features" style={{ background: "var(--aug-bg2)" }}>
        <div className="aug-container">
          <div style={{ textAlign: "center", maxWidth: 620, margin: "0 auto 60px" }}>
            <p className="aug-section-label">Features</p>
            <h2 className="aug-section-h">A complete compliance toolkit for professional teams</h2>
          </div>
          <div className="aug-features-list">
            {/* Feature 1: Multi-platform */}
            <div className="aug-feature-row" style={{ borderRadius: "var(--aug-radius)" }}>
              <div className="aug-feat-text">
                <div className="aug-feat-icon">&#128225;</div>
                <h3>One check. Every platform. Simultaneously.</h3>
                <p>A single submission runs against the specific policies of every platform you&apos;ve selected — catching a Facebook age-gate requirement and a Google character limit breach in the same analysis pass.</p>
                <ul className="aug-feat-bullets">
                  <li>Google Ads (Search, Display, Shopping)</li>
                  <li>Facebook &amp; Instagram (Meta)</li>
                  <li>Character limits enforced per platform</li>
                  <li>Platform-specific prohibited content rules</li>
                </ul>
              </div>
              <div className="aug-feat-visual">
                <div>
                  <div style={{ fontSize: 11, fontFamily: "'IBM Plex Mono', monospace", color: "var(--aug-text-dim)", marginBottom: 14, letterSpacing: ".12em", textTransform: "uppercase" as const }}>Select platforms</div>
                  <div className="aug-platform-grid">
                    <div className="aug-platform-pill selected"><div className="aug-plat-icon" style={{ background: "#1877f2", color: "white" }}>f</div>Facebook</div>
                    <div className="aug-platform-pill selected"><div className="aug-plat-icon" style={{ background: "linear-gradient(45deg,#f09433,#e6683c,#dc2743,#cc2366,#bc1888)", color: "white" }}>IG</div>Instagram</div>
                    <div className="aug-platform-pill selected"><div className="aug-plat-icon" style={{ background: "#4285f4", color: "white" }}>G</div>Google Ads</div>
                  </div>
                  <div style={{ marginTop: 20, padding: 14, background: "var(--aug-bg3)", border: "1px solid var(--aug-border)", borderRadius: 8 }}>
                    <div style={{ fontSize: 11, color: "var(--aug-text-dim)", marginBottom: 8, fontFamily: "'IBM Plex Mono', monospace" }}>CHECKING...</div>
                    <div style={{ height: 4, background: "var(--aug-border)", borderRadius: 2, overflow: "hidden" }}>
                      <div style={{ height: "100%", width: "72%", background: "linear-gradient(90deg,var(--aug-teal-mid),var(--aug-teal))", borderRadius: 2 }} />
                    </div>
                    <div style={{ marginTop: 8, fontSize: 11, color: "var(--aug-teal)" }}>72% — Scanning geo rules</div>
                  </div>
                </div>
              </div>
            </div>

            {/* Feature 2: Violation reports */}
            <div className="aug-feature-row reverse" style={{ borderRadius: "var(--aug-radius)", marginTop: 2 }}>
              <div className="aug-feat-text">
                <div className="aug-feat-icon">&#127919;</div>
                <h3>Actionable violation reports, not just red flags</h3>
                <p>Every issue returned references the specific policy clause breached, identifies the exact copy or asset that triggered it, and provides clear remediation guidance — so your team can resolve issues without waiting on legal.</p>
                <ul className="aug-feat-bullets">
                  <li>References exact platform policy clauses</li>
                  <li>Flags specific headline or description text</li>
                  <li>Severity levels: Violation / Warning / Pass</li>
                  <li>Fixable before any media spend</li>
                </ul>
              </div>
              <div className="aug-feat-visual" style={{ borderLeft: "none", borderRight: "1px solid var(--aug-border)" }}>
                <div className="aug-violation-mock">
                  <div className="aug-vm-row">
                    <div className="aug-vm-top">
                      <span className="aug-result-badge aug-badge-violation">Violation</span>
                      <span className="aug-result-platform" style={{ fontSize: 11 }}>Google Ads &middot; UK</span>
                    </div>
                    <div className="aug-vm-detail"><strong>Missing disclaimer</strong> — Financial services ads must include FCA authorisation statement. Headline: &quot;Get a loan today — lowest rates guaranteed&quot;</div>
                  </div>
                  <div className="aug-vm-row">
                    <div className="aug-vm-top">
                      <span className="aug-result-badge aug-badge-warn">Warning</span>
                      <span className="aug-result-platform" style={{ fontSize: 11 }}>Facebook &middot; IE</span>
                    </div>
                    <div className="aug-vm-detail"><strong>Superlative language</strong> — &quot;Best casino bonuses&quot; requires substantiation under Irish gambling rules.</div>
                  </div>
                  <div className="aug-vm-row">
                    <div className="aug-vm-top">
                      <span className="aug-result-badge aug-badge-pass">Pass</span>
                      <span className="aug-result-platform" style={{ fontSize: 11 }}>Instagram &middot; US</span>
                    </div>
                    <div className="aug-vm-detail">Age targeting verified. Alcohol content warnings present. Creative asset meets dimension requirements.</div>
                  </div>
                </div>
              </div>
            </div>

            {/* Feature 3: Compliance Brief */}
            <div className="aug-feature-row" style={{ borderRadius: "var(--aug-radius)", marginTop: 2 }}>
              <div className="aug-feat-text">
                <div className="aug-feat-icon">&#128203;</div>
                <h3>Set the compliance parameters before the brief is written</h3>
                <p>The Compliance Brief generates a plain-language summary of the must, should, and must-not requirements for any combination of platform, ad category, and target country — structured for direct use in creative briefs.</p>
                <ul className="aug-feat-bullets">
                  <li>Select platforms + categories + countries</li>
                  <li>Plain English — no legal jargon</li>
                  <li>Must / Should / Must Not format</li>
                  <li>Share with creative teams as a brief doc</li>
                </ul>
              </div>
              <div className="aug-feat-visual">
                <div className="aug-brief-mock">
                  <div className="aug-brief-header">Compliance Brief &middot; Google Ads &middot; Gambling &middot; UK + IE</div>
                  <div className="aug-brief-rule"><div className="aug-rule-dot aug-rule-must" />Must include responsible gambling message (BeGambleAware or equivalent)</div>
                  <div className="aug-brief-rule"><div className="aug-rule-dot aug-rule-must" />Must not target under-18s — age gate required in targeting settings</div>
                  <div className="aug-brief-rule"><div className="aug-rule-dot aug-rule-must" />Requires valid UK Gambling Commission licence number</div>
                  <div className="aug-brief-rule"><div className="aug-rule-dot aug-rule-should" />Avoid language implying guaranteed wins or financial benefit</div>
                  <div className="aug-brief-rule"><div className="aug-rule-dot aug-rule-ok" />Bonus offers permitted if T&amp;Cs clearly visible</div>
                </div>
              </div>
            </div>

            {/* Feature 4: Geo checks */}
            <div className="aug-feature-row reverse" style={{ borderRadius: "var(--aug-radius)", marginTop: 2 }}>
              <div className="aug-feat-text">
                <div className="aug-feat-icon">&#127757;</div>
                <h3>Jurisdiction-level checks across every target market</h3>
                <p>Compliance requirements vary significantly by country. Augur cross-references your geo-targeting against jurisdiction-specific rules, flagging markets where your ad copy would require modification before serving.</p>
                <ul className="aug-feat-bullets">
                  <li>UK, EU, US, AU jurisdictions</li>
                  <li>FCA, ASA, FTC, ACCC regulatory frameworks</li>
                  <li>Country-specific category restrictions</li>
                  <li>Automatic multi-geo conflict detection</li>
                </ul>
              </div>
              <div className="aug-feat-visual" style={{ borderLeft: "none", borderRight: "1px solid var(--aug-border)" }}>
                <div className="aug-geo-mock">
                  {[
                    { flag: "\u{1F1EC}\u{1F1E7}", country: "United Kingdom", status: "CLEAR", cls: "aug-geo-ok" },
                    { flag: "\u{1F1E9}\u{1F1EA}", country: "Germany", status: "REVIEW", cls: "aug-geo-warn" },
                    { flag: "\u{1F1EB}\u{1F1F7}", country: "France", status: "BLOCKED", cls: "aug-geo-block" },
                    { flag: "\u{1F1FA}\u{1F1F8}", country: "United States", status: "CLEAR", cls: "aug-geo-ok" },
                    { flag: "\u{1F1E6}\u{1F1FA}", country: "Australia", status: "REVIEW", cls: "aug-geo-warn" },
                    { flag: "\u{1F1E8}\u{1F1E6}", country: "Canada", status: "CLEAR", cls: "aug-geo-ok" },
                  ].map((geo) => (
                    <div key={geo.country} className="aug-geo-row">
                      <span className="aug-geo-flag">{geo.flag}</span>
                      <span className="aug-geo-country">{geo.country}</span>
                      <span className={`aug-geo-status ${geo.cls}`}>{geo.status}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* STATS */}
      <section className="aug-stats-section">
        <div className="aug-container">
          <div className="aug-stats-grid">
            {[
              { num: "47+", label: "Policy categories covered", sub: "Alcohol, gambling, finance, health & more" },
              { num: "3", label: "Major ad platforms", sub: "Google, Facebook & Instagram" },
              { num: "15+", label: "Countries & jurisdictions", sub: "UK, EU, US, AU & growing" },
              { num: "6", label: "Step compliance workflow", sub: "From channels to clear-to-launch" },
            ].map((stat) => (
              <div key={stat.label} className="aug-stat-card">
                <div className="aug-stat-num">{stat.num}</div>
                <div className="aug-stat-label">{stat.label}</div>
                <div className="aug-stat-sub">{stat.sub}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* AUDIENCE */}
      <section id="audience">
        <div className="aug-container">
          <div style={{ textAlign: "center", maxWidth: 600, margin: "0 auto 60px" }}>
            <p className="aug-section-label">Who it&apos;s for</p>
            <h2 className="aug-section-h">Designed for teams managing <em>compliance at scale</em></h2>
          </div>
          <div className="aug-audience-grid">
            <div className="aug-audience-card">
              <div className="aug-audience-icon">&#127970;</div>
              <h3>Digital Marketing Agencies</h3>
              <p>Managing campaigns across multiple clients, platforms, and jurisdictions simultaneously means a single compliance failure doesn&apos;t affect one account — it affects your agency&apos;s entire platform standing and client relationships.</p>
              <ul className="aug-audience-bullets">
                <li>White-label compliance reports per client</li>
                <li>Bulk upload entire client campaign CSVs</li>
                <li>Geo checks for every market you operate in</li>
                <li>Policy Library for onboarding new account managers</li>
                <li>Compliance briefs as part of your creative briefing process</li>
              </ul>
            </div>
            <div className="aug-audience-card">
              <div className="aug-audience-icon">&#128640;</div>
              <h3>SaaS &amp; Tech Companies</h3>
              <p>Growth teams move fast. Legal teams can&apos;t review every ad variant. Augur gives your marketing function a robust compliance layer between copy creation and campaign launch — without adding bottlenecks to your workflow.</p>
              <ul className="aug-audience-bullets">
                <li>Integrate into your campaign launch workflow</li>
                <li>Catch issues before legal review is needed</li>
                <li>Geo-aware checks as you expand to new markets</li>
                <li>Compliance history for audit trails</li>
                <li>API-first architecture for SaaS product teams</li>
              </ul>
            </div>
          </div>
          <div style={{ marginTop: 2, background: "var(--aug-surface)", border: "1px solid var(--aug-border)", borderRadius: "var(--aug-radius)", padding: 44, display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 32 }}>
            <div>
              <div style={{ fontSize: 13, fontFamily: "'IBM Plex Mono', monospace", color: "var(--aug-teal)", letterSpacing: ".14em", textTransform: "uppercase" as const, marginBottom: 12 }}>Regulated Industries</div>
              <p style={{ fontSize: 14, color: "var(--aug-text-mid)", lineHeight: 1.7 }}>Finance, healthcare, gambling, alcohol, and pharma teams who face the highest compliance risk and regulatory scrutiny.</p>
            </div>
            <div>
              <div style={{ fontSize: 13, fontFamily: "'IBM Plex Mono', monospace", color: "var(--aug-amber)", letterSpacing: ".14em", textTransform: "uppercase" as const, marginBottom: 12 }}>In-house Marketing Teams</div>
              <p style={{ fontSize: 14, color: "var(--aug-text-mid)", lineHeight: 1.7 }}>Internal paid media and performance marketing teams who want to move fast without waiting on legal sign-off for every single ad variant.</p>
            </div>
            <div>
              <div style={{ fontSize: 13, fontFamily: "'IBM Plex Mono', monospace", color: "var(--aug-text-mid)", letterSpacing: ".14em", textTransform: "uppercase" as const, marginBottom: 12 }}>Freelance Consultants</div>
              <p style={{ fontSize: 14, color: "var(--aug-text-mid)", lineHeight: 1.7 }}>Independent PPC specialists and media buyers who want to deliver an extra layer of professional confidence to every campaign they manage.</p>
            </div>
          </div>
        </div>
      </section>

      {/* POLICY LIBRARY */}
      <section id="policy" style={{ background: "var(--aug-bg2)" }}>
        <div className="aug-container">
          <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", marginBottom: 48, flexWrap: "wrap" as const, gap: 20 }}>
            <div>
              <p className="aug-section-label">Policy Library</p>
              <h2 className="aug-section-h" style={{ marginBottom: 10 }}>The policy knowledge your team needs, <em>in plain language.</em></h2>
              <p style={{ fontSize: 16, color: "var(--aug-text-mid)", maxWidth: 520 }}>A curated library of compliance guides, video walkthroughs, and interactive assessments — covering every major advertising policy across platforms, industries, and jurisdictions.</p>
            </div>
            <Link href="/login" className="aug-btn aug-btn-outline aug-btn-lg">Browse all guides &rarr;</Link>
          </div>
          <div className="aug-policy-grid">
            {[
              { platform: "Facebook", category: "Alcohol -- Wine", video: true, title: "Meta Alcohol Advertising Policy", desc: "Age targeting, content restrictions, and regional differences for advertising alcohol products on Facebook and Instagram." },
              { platform: "Google Ads", category: "Mental Health", video: true, title: "Google Ads Healthcare & Medicines Policy", desc: "A comprehensive guide to Google's advertising rules for healthcare products, pharmaceuticals, and medical services." },
              { platform: "Multi-platform", category: "Gambling", video: true, title: "Gambling Advertising Regulations", desc: "How to advertise gambling and betting compliantly across Meta, Google, and Instagram -- including licensing requirements." },
              { platform: "Multi-platform", category: "Financial Services", video: true, title: "Financial Services Advertising Rules", desc: "Loans, credit cards, investments, and crypto -- navigate the complex rules around advertising financial products across digital platforms." },
              { platform: "Multi-platform", category: "Creative Assets", video: false, title: "Image & Creative Asset Guidelines", desc: "Technical requirements and content rules for ad images and videos -- dimensions, file sizes, text ratios, and prohibited content." },
            ].map((card) => (
              <div key={card.title} className="aug-policy-card">
                <div className="aug-policy-tags">
                  <span className="aug-policy-tag platform">{card.platform}</span>
                  <span className="aug-policy-tag">{card.category}</span>
                  {card.video && <span className="aug-policy-video-badge">&#9654; Video</span>}
                </div>
                <h4>{card.title}</h4>
                <p>{card.desc}</p>
              </div>
            ))}
            <div className="aug-policy-card" style={{ background: "var(--aug-teal-dark)", borderColor: "rgba(45,212,191,.2)" }}>
              <div style={{ fontSize: 32, marginBottom: 16 }}>&#129504;</div>
              <h4 style={{ marginBottom: 10 }}>Test Your Knowledge</h4>
              <p style={{ color: "var(--aug-text-mid)", marginBottom: 20 }}>Take interactive quizzes to identify non-compliant ad copy. Track your team&apos;s compliance confidence over time.</p>
              <Link href="/login" className="aug-btn aug-btn-teal">Take a quiz &rarr;</Link>
            </div>
          </div>
        </div>
      </section>

      {/* INTEGRATIONS */}
      <section>
        <div className="aug-container" style={{ textAlign: "center" }}>
          <p className="aug-section-label">Integrations</p>
          <h2 className="aug-section-h" style={{ marginBottom: 14 }}>Connects to where your ads live</h2>
          <p style={{ fontSize: 16, color: "var(--aug-text-mid)", maxWidth: 500, margin: "0 auto 48px" }}>Pull your live ads directly from connected platform accounts for automatic compliance scanning — no copy-pasting required.</p>
          <div className="aug-int-grid">
            <div className="aug-int-pill"><div className="aug-int-logo" style={{ background: "#4285f4", color: "white", fontSize: 13 }}>G</div>Google Ads</div>
            <div className="aug-int-pill"><div className="aug-int-logo" style={{ background: "#1877f2", color: "white", fontSize: 12 }}>f</div>Facebook Ads</div>
            <div className="aug-int-pill"><div className="aug-int-logo" style={{ background: "linear-gradient(45deg,#f09433,#e6683c,#dc2743,#cc2366,#bc1888)", color: "white", fontSize: 9 }}>IG</div>Instagram</div>
            <div className="aug-int-pill" style={{ borderStyle: "dashed", opacity: .5 }}><div className="aug-int-logo" style={{ background: "var(--aug-border2)" }}>+</div>More coming</div>
          </div>
          <div style={{ background: "var(--aug-surface)", border: "1px solid var(--aug-border)", borderRadius: "var(--aug-radius)", padding: 36, maxWidth: 640, margin: "0 auto", textAlign: "left" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
              <div className="aug-pulse-ring" style={{ width: 8, height: 8, background: "var(--aug-green)", borderRadius: "50%" }} />
              <span style={{ fontSize: 13, color: "var(--aug-green)", fontFamily: "'IBM Plex Mono', monospace" }}>Connected &middot; Google Ads</span>
            </div>
            <div style={{ fontSize: 15, color: "var(--aug-text)", marginBottom: 6 }}>Integrated Ads — live sync enabled</div>
            <div style={{ fontSize: 13, color: "var(--aug-text-dim)" }}>Connect your Meta or Google Ads account to automatically pull live ad copy for compliance scanning. No manual uploads required.</div>
          </div>
        </div>
      </section>

      {/* PRICING */}
      <section id="pricing" style={{ background: "var(--aug-bg2)" }}>
        <div className="aug-container">
          <div style={{ textAlign: "center", maxWidth: 580, margin: "0 auto 56px" }}>
            <p className="aug-section-label">Pricing</p>
            <h2 className="aug-section-h">Transparent pricing for teams of every size</h2>
            <p style={{ fontSize: 16, color: "var(--aug-text-mid)" }}>All plans run on <strong style={{ color: "var(--aug-teal)" }}>Checkdits</strong> — our usage credits. Each compliance check costs one Checkdit. No surprises.</p>
          </div>
          <div className="aug-pricing-grid">
            <div className="aug-pricing-card">
              <div className="aug-plan-name">Starter</div>
              <div className="aug-plan-price"><span>&pound;</span>29</div>
              <div className="aug-plan-cadence">per month</div>
              <div className="aug-plan-checkdits">&#9889; 150 Checkdits / month</div>
              <ul className="aug-plan-features">
                <li>Single user</li>
                <li>Google Ads, Facebook, Instagram</li>
                <li>Compliance Brief generation</li>
                <li>Policy Library access</li>
                <li>Bulk CSV upload (up to 1MB)</li>
                <li className="dim">Compliance History</li>
                <li className="dim">Team members</li>
                <li className="dim">API access</li>
              </ul>
              <Link href="/login" className="aug-btn aug-btn-ghost" style={{ width: "100%", justifyContent: "center" }}>Get started</Link>
            </div>
            <div className="aug-pricing-card featured">
              <div className="aug-plan-name">Agency</div>
              <div className="aug-plan-price"><span>&pound;</span>99</div>
              <div className="aug-plan-cadence">per month</div>
              <div className="aug-plan-checkdits">&#9889; 500 Checkdits / month</div>
              <ul className="aug-plan-features">
                <li>Up to 5 team members</li>
                <li>All platforms included</li>
                <li>Unlimited Compliance Briefs</li>
                <li>Full Policy Library + quizzes</li>
                <li>Bulk CSV (up to 10MB)</li>
                <li>Compliance History &amp; audit trail</li>
                <li>Google Ads &amp; Meta integration</li>
                <li className="dim">API access</li>
              </ul>
              <Link href="/login" className="aug-btn aug-btn-teal" style={{ width: "100%", justifyContent: "center" }}>Start free trial</Link>
            </div>
            <div className="aug-pricing-card">
              <div className="aug-plan-name">Enterprise</div>
              <div className="aug-plan-price" style={{ fontSize: 36 }}>Custom</div>
              <div className="aug-plan-cadence">volume pricing</div>
              <div className="aug-plan-checkdits">&#9889; Unlimited Checkdits</div>
              <ul className="aug-plan-features">
                <li>Unlimited team members</li>
                <li>All platforms included</li>
                <li>Custom compliance rule sets</li>
                <li>White-label client reports</li>
                <li>Dedicated onboarding</li>
                <li>SLA &amp; priority support</li>
                <li>Full API access</li>
                <li>SSO &amp; admin controls</li>
              </ul>
              <Link href="/login" className="aug-btn aug-btn-outline" style={{ width: "100%", justifyContent: "center" }}>Talk to sales</Link>
            </div>
          </div>
          <p style={{ textAlign: "center", fontSize: 13, color: "var(--aug-text-dim)", marginTop: 24 }}>All plans include a 14-day free trial. No credit card required. Cancel any time.</p>
        </div>
      </section>

      {/* TESTIMONIALS */}
      <section>
        <div className="aug-container">
          <div style={{ textAlign: "center", maxWidth: 560, margin: "0 auto 52px" }}>
            <p className="aug-section-label">Social proof</p>
            <h2 className="aug-section-h">Trusted by agency and in-house teams</h2>
          </div>
          <div className="aug-testi-grid">
            {[
              { quote: "We manage Google Ads for 34 clients across finance and healthcare. Augur has become part of our pre-launch checklist -- it's already caught three violations that would have got accounts suspended.", initials: "SC", name: "Sarah C.", role: "Head of Paid Media -- London Agency", color: "#6366f1" },
              { quote: "The Compliance Brief feature is incredible. We brief our copywriters with it before they write a single word. The number of back-and-forth rounds with legal has dropped by half.", initials: "MR", name: "Marcus R.", role: "VP Marketing -- FinTech SaaS", color: "#0ea5e9" },
              { quote: "Running campaigns in 11 countries simultaneously. The geo-aware checks mean we know before launch which markets have issues. It's saved us from some seriously embarrassing regulatory situations.", initials: "AK", name: "Alicia K.", role: "Performance Marketing Lead -- iGaming", color: "#d97706" },
            ].map((t) => (
              <div key={t.initials} className="aug-testi-card">
                <div className="aug-stars">&#9733;&#9733;&#9733;&#9733;&#9733;</div>
                <p className="aug-testi-quote">&quot;{t.quote}&quot;</p>
                <div className="aug-testi-author">
                  <div className="aug-testi-av" style={{ background: t.color }}>{t.initials}</div>
                  <div>
                    <div className="aug-testi-name">{t.name}</div>
                    <div className="aug-testi-role">{t.role}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="aug-cta-section">
        <div className="aug-cta-radar">
          <svg width="700" height="700" viewBox="0 0 700 700" fill="none">
            <circle cx="350" cy="350" r="320" stroke="#2dd4bf" strokeWidth="1" />
            <circle cx="350" cy="350" r="240" stroke="#2dd4bf" strokeWidth="1" />
            <circle cx="350" cy="350" r="160" stroke="#2dd4bf" strokeWidth="1" />
            <circle cx="350" cy="350" r="80" stroke="#2dd4bf" strokeWidth="1" />
            <line x1="350" y1="30" x2="350" y2="670" stroke="#2dd4bf" strokeWidth="0.8" />
            <line x1="30" y1="350" x2="670" y2="350" stroke="#2dd4bf" strokeWidth="0.8" />
            <g style={{ transformOrigin: "350px 350px", animation: "augSweep 5s linear infinite" }}>
              <line x1="350" y1="350" x2="350" y2="30" stroke="url(#ctag)" strokeWidth="2" />
              <polygon points="350,350 336,30 364,30" fill="url(#ctaf)" opacity="0.3" />
            </g>
            <defs>
              <linearGradient id="ctag" x1="350" y1="350" x2="350" y2="30" gradientUnits="userSpaceOnUse">
                <stop offset="0%" stopColor="#2dd4bf" stopOpacity="0.9" />
                <stop offset="100%" stopColor="#2dd4bf" stopOpacity="0" />
              </linearGradient>
              <linearGradient id="ctaf" x1="350" y1="30" x2="350" y2="350" gradientUnits="userSpaceOnUse">
                <stop offset="0%" stopColor="#2dd4bf" stopOpacity="0.4" />
                <stop offset="100%" stopColor="#2dd4bf" stopOpacity="0" />
              </linearGradient>
            </defs>
          </svg>
        </div>
        <div style={{ position: "relative", zIndex: 1 }}>
          <p className="aug-section-label" style={{ textAlign: "center", marginBottom: 20 }}>Start your trial</p>
          <h2>Compliance confidence,<br /><em>at campaign scale.</em></h2>
          <p>Augur gives agencies and in-house teams a structured, AI-powered compliance workflow — covering every platform, category, and jurisdiction you operate in.</p>
          <div className="aug-cta-actions">
            <Link href="/login" className="aug-btn aug-btn-teal aug-btn-xl">Start your free trial &rarr;</Link>
            <Link href="/login" className="aug-btn aug-btn-ghost aug-btn-lg">Book a demo</Link>
          </div>
          <p className="aug-cta-fine">Free trial includes 50 Checkdits &middot; All features unlocked &middot; No credit card needed</p>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="aug-footer">
        <div className="aug-container">
          <div className="aug-footer-grid">
            <div className="aug-footer-brand">
              <Link href="/" className="aug-nav-logo" style={{ marginBottom: 8 }}>
                <RadarIcon size={28} />
                <span className="aug-nav-wordmark">Augur</span>
              </Link>
              <p>AI-powered ad compliance intelligence for SaaS companies and digital marketing agencies.</p>
            </div>
            <div className="aug-footer-col">
              <h5>Product</h5>
              <a href="#how">How it works</a>
              <a href="#features">Features</a>
              <a href="#pricing">Pricing</a>
              <Link href="/login">Policy Library</Link>
              <Link href="/login">Integrations</Link>
            </div>
            <div className="aug-footer-col">
              <h5>Use cases</h5>
              <a href="#audience">Agencies</a>
              <a href="#audience">SaaS companies</a>
              <a href="#audience">Financial services</a>
              <a href="#audience">iGaming &amp; gambling</a>
              <a href="#audience">Healthcare &amp; pharma</a>
            </div>
            <div className="aug-footer-col">
              <h5>Company</h5>
              <Link href="/login">Sign in</Link>
              <Link href="/login">Start free trial</Link>
              <Link href="/login">Book a demo</Link>
              <a href="#">Privacy policy</a>
              <a href="#">Terms of service</a>
            </div>
          </div>
          <div className="aug-footer-bottom">
            <p>&copy; 2026 Augur. All rights reserved.</p>
            <div className="aug-footer-legal">
              <a href="#">Privacy</a>
              <a href="#">Terms</a>
              <a href="#">Cookies</a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
