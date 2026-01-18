'use client';

import { useEffect, useRef } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { Playfair_Display, DM_Sans } from 'next/font/google';
import styles from './landing-page.module.css';

const playfair = Playfair_Display({
  subsets: ['latin'],
  variable: '--font-playfair',
  display: 'swap',
});

const dmSans = DM_Sans({
  subsets: ['latin'],
  variable: '--font-dm-sans',
  display: 'swap',
});

const qualities = [
  {
    title: 'AI Native',
    desc: 'Built with Claude Code, v0, and cutting-edge AI tools from day one.',
  },
  {
    title: 'Side Projects',
    desc: 'Shipped 3 products in the last 6 months. Building is my default state.',
  },
  {
    title: 'High Agency',
    desc: 'I don\'t wait for permission. I prototype, test, and iterate fast.',
  },
  {
    title: 'Future Founder',
    desc: 'Learning the full stack of building—product, growth, and operations.',
  },
];

export default function LandingPage() {
  const section2Ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const section = section2Ref.current;
    if (!section) return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add(styles.fadeUpVisible);
          }
        });
      },
      { threshold: 0.1, rootMargin: '0px 0px -50px 0px' }
    );

    const fadeElements = section.querySelectorAll(`.${styles.fadeUp}`);
    fadeElements.forEach((el) => observer.observe(el));

    return () => observer.disconnect();
  }, []);

  return (
    <main className={`${playfair.variable} ${dmSans.variable}`}>
      {/* Hero Section */}
      <section
        className={styles.hero}
        style={{ backgroundImage: 'url(/hero.jpeg)' }}
      >
        <div className={styles.heroOverlay} />

        {/* Navigation */}
        <nav className={styles.nav}>
          <span className={styles.navLeft}>Adam @voqo</span>
          <span className={styles.navBrand}>VOQO AI</span>
          <span className={styles.navName}>Varun Prasad</span>
        </nav>

        {/* Hero Content */}
        <div className={styles.heroContent}>
          <h1 className={styles.heroTitle}>
            Your Next Growth Intern<br /><em>Already Shipped</em>
          </h1>
          <p className={styles.heroSubtitle}>
            AI that talks like a human. Handles millions of calls.
            I built a working prototype that finds agencies, generates personalized demos,
            and makes real phone calls—all autonomously.
          </p>
          <Link href="/product" className={styles.heroCta}>
            See It Live <span aria-hidden="true">→</span>
          </Link>
        </div>

        {/* Scroll down button */}
        <button
          className={styles.scrollDown}
          onClick={() => section2Ref.current?.scrollIntoView({ behavior: 'smooth' })}
          aria-label="Scroll to next section"
        >
          <span aria-hidden="true">↓</span>
        </button>
      </section>

      {/* Section 2 - Why I'm Here */}
      <section className={styles.section2} ref={section2Ref}>
        <div className={styles.section2Inner}>
          <h2 className={styles.section2Title}>Why I&apos;m Here</h2>

          <p className={styles.section2Text}>
            I didn&apos;t apply with a resume. I applied with a product.
            This demo engine finds real estate agencies, generates branded landing pages,
            and initiates AI phone calls—exactly what Voqo needs to scale outreach.
          </p>

          <Image
            src="/second_section.jpeg"
            alt="Watercolor illustration of a phone booth in a garden"
            width={700}
            height={490}
            className={styles.illustration}
            priority={false}
          />

          {/* Marquee */}
          <div className={styles.marqueeContainer}>
            <div className={styles.marqueeTrack}>
              {[...qualities, ...qualities].map((q, i) => (
                <span key={`${q.title}-${i}`} className={styles.marqueeItem}>
                  <strong>{q.title}</strong> {q.desc}
                </span>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Section 3 - Statement + Signature */}
      <section className={styles.section3}>
        <div className={styles.section3Inner}>
          <div>
            <p className={styles.quote}>
              I want to build the future of voice AI with people who move fast
              and ship things that matter. Voqo is doing exactly that—and I want in.
            </p>
            <a href="mailto:varun@example.com" className={styles.emailLink}>
              varun@example.com
            </a>
          </div>

          <div className={styles.signatureBlock}>
            <Image
              src="/signature.png"
              alt="Varun Prasad signature"
              width={220}
              height={80}
              className={styles.signature}
            />
            <div className={styles.signatureName}>Varun Prasad, UNSW</div>
            <div className={styles.signatureTitle}>Jr. Agentic Engineer</div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className={styles.footer}>
        <p className={styles.footerText}>Built with AI agents · Sydney, Australia</p>
        <a href="mailto:adam@voqo.ai" className={styles.footerLink}>
          adam@voqo.ai
        </a>
      </footer>
    </main>
  );
}
