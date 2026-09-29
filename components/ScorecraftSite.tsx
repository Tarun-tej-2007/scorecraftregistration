 "use client";

import { useState } from "react";
import Image from "next/image";
import RegistrationFlow from "@/components/RegistrationFlow";
import {
  ArrowRight,
  BookOpen,
  CalendarDays,
  Clock3,
  Lightbulb,
  MapPin,
  Menu,
  Pencil,
  Target,
  Users,
  X,
} from "lucide-react";

export default function ScorecraftSite() {
  const [menuOpen, setMenuOpen] = useState(false);

  function scrollTo(id: string) {
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth" });
    setMenuOpen(false);
  }

  return (
    <main>

      {/* ══════════════════════════════════════
          NAV
      ══════════════════════════════════════ */}
      <nav className="nav">
        <button className="brand" onClick={() => scrollTo("top")} aria-label="SCORECRAFT home">
          <Image
            src="/assets/scorecraft-logo.png"
            alt="SCORECRAFT club logo"
            width={36}
            height={36}
            className="nav-logo-img"
          />
          <span className="brand-name">SCORECRAFT</span>
        </button>

        <div className={`nav-links ${menuOpen ? "open" : ""}`}>
          <button onClick={() => scrollTo("about")}>Workshop</button>
          <button onClick={() => scrollTo("schedule")}>Schedule</button>
          <button onClick={() => scrollTo("registration")}>Register</button>
        </div>

        <button className="nav-register" onClick={() => scrollTo("registration")}>
          Register ₹250
        </button>
        <button className="menu-button" onClick={() => setMenuOpen(!menuOpen)} aria-label="Menu">
          {menuOpen ? <X /> : <Menu />}
        </button>
      </nav>

      {/* ══════════════════════════════════════
          HERO
      ══════════════════════════════════════ */}
      <section id="top" className="hero section-shell">
        {/* Decorative background scribbles */}
        <div className="scribble scribble-one" aria-hidden="true">✦</div>
        <div className="scribble scribble-two" aria-hidden="true">✦</div>

        {/* ── LEFT: copy ── */}
        <div className="hero-copy">

          {/* Club identity block */}
          <div className="hero-club-block">
            <Image
              src="/assets/scorecraft-logo.png"
              alt="SCORECRAFT club logo"
              width={64}
              height={64}
              className="hero-logo-img"
              priority
            />
            <div className="hero-club-text">
              <span className="hero-club-name">SCORECRAFT</span>
              <span className="hero-presents-label">PRESENTS</span>
            </div>
          </div>

          {/* Primary event title */}
          <h1 className="hero-event-title">
            PRODUCT DESIGN<br />
            <span className="hero-title-line2">AND MARKET DRIVEN</span><br />
            <span className="hero-title-accent">INNOVATION</span>
          </h1>

          {/* Workshop tag */}
          <div className="hero-workshop-tag">
            <span className="workshop-dash">—</span>
            A 2-DAY WORKSHOP ON PRODUCT THINKING
          </div>

          {/* Description */}
          <p className="hero-desc">
            A practical workshop focused on customer discovery, product
            thinking, problem solving and market-driven innovation.
          </p>

          {/* Date + Venue */}
          <div className="hero-meta">
            <div className="hero-meta-item">
              <CalendarDays size={16} />
              <span><b>03–04 OCTOBER 2026</b></span>
            </div>
            <div className="hero-meta-item">
              <MapPin size={16} />
              <span><b>ADMIN BLOCK</b> · SEMINAR HALL</span>
            </div>
          </div>

          {/* CTA */}
          <div className="hero-cta-row">
            <button className="primary-button" onClick={() => scrollTo("registration")}>
              REGISTER NOW <ArrowRight size={18} />
            </button>
            <span className="micro-note">Limited seats · ₹250/-</span>
          </div>
        </div>

        {/* ── RIGHT: creative visual composition ── */}
        <div className="hero-art" aria-hidden="true">
          <div className="art-canvas">

            {/* Large background shape */}
            <div className="art-bg-circle"></div>

            {/* Top card — idea */}
            <div className="art-card art-card-1">
              <Lightbulb size={22} className="art-icon-yellow" />
              <span>IDEATE</span>
            </div>

            {/* Middle card — design */}
            <div className="art-card art-card-2">
              <Pencil size={22} className="art-icon-red" />
              <span>DESIGN</span>
            </div>

            {/* Bottom card — validate */}
            <div className="art-card art-card-3">
              <Target size={22} className="art-icon-navy" />
              <span>VALIDATE</span>
            </div>

            {/* Floating sticker */}
            <div className="art-sticker">
              BUILD<br />TODAY.
            </div>

            {/* Decorative yellow brush */}
            <div className="art-brush-1"></div>
            <div className="art-brush-2"></div>

            {/* Hand-drawn arrow */}
            <div className="art-arrow-1">↘</div>
            <div className="art-arrow-2">→</div>

            {/* Notebook lines */}
            <div className="art-notebook">
              <div className="nb-line"></div>
              <div className="nb-line nb-line-short"></div>
              <div className="nb-line"></div>
              <div className="nb-line nb-line-short"></div>
              <div className="nb-line"></div>
            </div>

            {/* Stars / marks */}
            <div className="art-star art-star-1">✦</div>
            <div className="art-star art-star-2">✦</div>

            {/* Red underline shape */}
            <div className="art-underline"></div>

            {/* Grid dots */}
            <div className="art-dot-grid">
              {Array.from({ length: 12 }).map((_, i) => (
                <span key={i} className="art-dot"></span>
              ))}
            </div>

            {/* Caption */}
            <div className="art-caption">
              <span>PRODUCT</span>
              <span className="art-caption-bold">INNOVATION</span>
            </div>
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════
          WORKSHOP OVERVIEW
      ══════════════════════════════════════ */}
      <section id="about" className="section-shell section-paper">
        <div className="section-heading">
          <span className="brush-label">THE WORKSHOP</span>
          <h2>Learn to think like a<br /><em>product builder.</em></h2>
          <p>Two focused days of customer discovery, product thinking, problem solving and practical innovation — organised by SCORECRAFT, School of Computing, KARE.</p>
        </div>

        <div className="feature-grid">
          <Feature icon={<Target />} title="TARGET CUSTOMERS" text="Understand the people behind the problem and define a clear target user." />
          <Feature icon={<Lightbulb />} title="DEVELOPING" text="Move from rough ideas to a structured product concept that can be tested." />
          <Feature icon={<Pencil />} title="PROBLEM SOLVING" text="Break complex challenges into smaller, actionable design decisions." />
          <Feature icon={<Clock3 />} title="TIME MANAGEMENT" text="Prioritize ideas and manage your time while building a product." />
          <Feature icon={<BookOpen />} title="BREAKOUT FEATURES" text="Discover breakthrough opportunities that separate great products from ordinary ones." />
        </div>
      </section>

      {/* ══════════════════════════════════════
          WORKSHOP FLOW
      ══════════════════════════════════════ */}
      <section id="schedule" className="section-shell schedule-section">
        <div className="section-heading centered">
          <span className="brush-label">THE WORKSHOP FLOW</span>
          <h2>From <em>problem</em> to product.</h2>
        </div>

        <div className="timeline">
          <Timeline number="01" title="UNDERSTAND" text="Customer & problem discovery" />
          <Timeline number="02" title="IDEATE" text="Generate and frame opportunities" />
          <Timeline number="03" title="DESIGN" text="Shape the product experience" />
          <Timeline number="04" title="VALIDATE" text="Test assumptions & refine" />
          <Timeline number="05" title="PRESENT" text="Tell the product story" />
        </div>

        {/* Event details strip */}
        <div className="date-strip">
          <div><CalendarDays /><span><b>OCTOBER 3rd &amp; 4th, 2026</b><small>Two-day immersive workshop</small></span></div>
          <div><MapPin /><span><b>ADMIN BLOCK SEMINAR HALL</b><small>Kalasalingam Academy of Research and Education</small></span></div>
          <div><Users /><span><b>₹250/-</b><small>Registration fee</small></span></div>
        </div>

        {/* Participation / Credit information */}
        <div className="credit-card">
          <div className="credit-card-header">
            <span className="brush-label">PARTICIPATION / CREDIT</span>
          </div>
          <div className="credit-grid">
            <div className="credit-item">
              <span className="credit-value">1 PE</span>
              <span className="credit-dept">CSE DEPARTMENT</span>
            </div>
            <div className="credit-divider"></div>
            <div className="credit-item">
              <span className="credit-value">1 UE</span>
              <span className="credit-dept">OTHER DEPARTMENTS</span>
            </div>
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════
          REGISTRATION
      ══════════════════════════════════════ */}
      <section id="registration" className="section-shell registration-section">

        {/* Left: intro */}
        <div className="register-intro">
          <span className="brush-label">JOIN THE WORKSHOP</span>
          <h2>Reserve your<br /><em>seat.</em></h2>
          <p>Register for:</p>
          <div className="reg-event-title">
            PRODUCT DESIGN AND<br />MARKET DRIVEN INNOVATION
          </div>

          <div className="event-details-list">
            <div className="event-detail-row">
              <CalendarDays size={15} />
              <span><b>OCTOBER 3 &amp; 4, 2026</b></span>
            </div>
            <div className="event-detail-row">
              <MapPin size={15} />
              <span><b>ADMIN BLOCK · SEMINAR HALL</b></span>
            </div>
          </div>

          <div className="reg-fee-block">
            <span className="reg-fee-label">REGISTRATION FEE</span>
            <span className="reg-fee-amount">₹250/-</span>
          </div>

          {/* PE / UE eligibility — information only, NOT a form field */}
          <div className="eligibility-info">
            <div className="elig-header">1 PE FOR CSE DEPARTMENT</div>
            <div className="elig-separator"></div>
            <div className="elig-header">1 UE FOR OTHER DEPARTMENTS</div>
          </div>
        </div>

        {/* Right: multi-step registration flow (Form → Review → Payment → Confirmed) */}
        <RegistrationFlow />
      </section>

      {/* ══════════════════════════════════════
          ORGANIZERS
      ══════════════════════════════════════ */}
      <section className="organizers section-shell">
        <div className="section-heading centered">
          <span className="brush-label">ORGANIZED BY</span>
          <h2>SCORECRAFT</h2>
          <p>School of Computing · Department of Computer Science &amp; Engineering · KARE</p>
        </div>

        <div className="organizer-grid">
          <Org title="Conveners" names={["Dr. P. Deepalakshmi", "Dr. R. Raja Subramanian"]} />
          <Org title="Faculty Advisor" names={["Dr. Abhishek Tripathi"]} />
          <Org title="Faculty Coordinators" names={["Mrs. J. Benita", "Mrs. S. Sujitha", "Mr. S. Suresh Kumar", "Ms. K. Abinaya"]} />
          <Org title="Student Coordinators" names={["S Deo Haneesh · 7032362231", "M. Raghu · 7396064641", "D Dhanalakshmi · 9265285771"]} />
        </div>
      </section>

      {/* ══════════════════════════════════════
          FOOTER
      ══════════════════════════════════════ */}
      <footer>
        <div className="footer-inner">
          <Image
            src="/assets/scorecraft-logo.png"
            alt="SCORECRAFT"
            width={52}
            height={52}
            className="footer-logo"
          />
          <div className="footer-brand">SCORECRAFT <span>✦</span></div>
        </div>
        <p className="footer-event-name">PRODUCT DESIGN AND MARKET DRIVEN INNOVATION</p>
        <p>School of Computing · Department of Computer Science &amp; Engineering</p>
        <p>Kalasalingam Academy of Research and Education</p>
        <strong>BUILD TODAY, EARN TOMORROW.</strong>
      </footer>

    </main>
  );
}

/* ── Sub-components ── */

function Feature({ icon, title, text }: { icon: React.ReactNode; title: string; text: string }) {
  return (
    <article className="feature-card">
      <div className="feature-icon">{icon}</div>
      <h3>{title}</h3>
      <p>{text}</p>
    </article>
  );
}

function Timeline({ number, title, text }: { number: string; title: string; text: string }) {
  return (
    <article className="timeline-item">
      <span className="timeline-number">{number}</span>
      <div><h3>{title}</h3><p>{text}</p></div>
    </article>
  );
}

function Org({ title, names }: { title: string; names: string[] }) {
  return (
    <div className="org-card">
      <span className="brush-label">{title}</span>
      {names.map((n) => <p key={n}>{n}</p>)}
    </div>
  );
}

