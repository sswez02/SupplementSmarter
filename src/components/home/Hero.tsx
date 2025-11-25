import { useRef, useLayoutEffect, useState } from 'react';
import { gsap } from 'gsap';
import { useGSAP } from '@gsap/react';

import BackgroundLogos from '@/components/home/BackgroundLogos';
import CTA from '@/components/home/CTA';

import musashiLogo from '@/assets/logos_grey/musashi.png';
import hydraLogo from '@/assets/logos_grey/hydra_labs.png';
import xplosivLogo from '@/assets/logos_grey/xplosiv.png';
import nzproteinLogo from '@/assets/logos_grey/nz_protein.png';
import cellucorLogo from '@/assets/logos_grey/cellucor.png';
import nowheyLogo from '@/assets/logos_grey/no_whey.png';
import muscleNationLogo from '@/assets/logos_grey/muscle_nation.png';

import grid from '@/assets/stocks/grid.png';
import logosMobile from '@/assets/stocks/logos_mobile.png';

gsap.registerPlugin(useGSAP);

// Grey logos in the strip at the bottom
const LOGOS = [
  { src: musashiLogo, alt: 'Musashi', scale: 0.9 },
  { src: hydraLogo, alt: 'Hydra Labs', scale: 0.9, dy: 1 },
  { src: xplosivLogo, alt: 'Xplosiv', scale: 0.85 },
  { src: nzproteinLogo, alt: 'NZ Protein', scale: 0.95 },
  { src: cellucorLogo, alt: 'Cellucor', scale: 0.78 },
  { src: nowheyLogo, alt: 'No Whey', scale: 0.58 },
  { src: muscleNationLogo, alt: 'Muscle Nation', scale: 0.8, maxW: 140 },
];

/* Utility helpers */

// Restrict number between min and max range
//  eg: rangeNum(5, 1, 10) => 5
//  eg: rangeNum(-2, 0, 8) => 0
//  eg: rangeNum(12, 0, 10) => 10
const rangeNum = (v: number, min: number, max: number): number => Math.min(Math.max(v, min), max);

// Linear scale between a and b by t (0 to 1)
//  eg: linearScale(10, 20, 0);   10  (0% of the way from 10 to 20)
//  eg: linearScale(10, 20, 0.5); 15  (50% of the way)
//  eg: linearScale(10, 20, 1);   20  (100% of the way)
const linearScale = (a: number, b: number, t: number): number => a + (b - a) * t;

export default function Hero() {
  const root = useRef<HTMLElement | null>(null);
  const stripRef = useRef<HTMLDivElement | null>(null); // ref to the grey logo strip

  // Detect mobile screen size
  const [isMobile, setIsMobile] = useState(false);
  useLayoutEffect(() => {
    const mq = window.matchMedia('(max-width: 639px)');
    const update = () => setIsMobile(mq.matches);
    update();
    mq.addEventListener('change', update);
    return () => mq.removeEventListener('change', update);
  }, []);

  // Smooth background-logo scale based on viewport width (desktop only)
  const [bgScale, setBgScale] = useState(1.8);
  useLayoutEffect(() => {
    const calc = () => {
      const w = window.innerWidth || 1280;
      const t = rangeNum((w - 320) / (1440 - 320), 0, 1);
      setBgScale(linearScale(1.35, 2.1, t));
    };
    calc();
    window.addEventListener('resize', calc);
    return () => window.removeEventListener('resize', calc);
  }, []);

  // GSAP intro animation
  useGSAP(
    () => {
      const q = gsap.utils.selector(root);
      if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
        gsap.set(q('.hero-title, .hero-sub, .tag, .pill'), { clearProps: 'all' });
        return;
      }
      const timeline = gsap.timeline({ defaults: { ease: 'power2.out' } });
      // Each line of the title animates from below with slight rotation & blur
      const titleLines = q('.hero-title > span');
      gsap.set(titleLines, {
        display: 'block',
        transformPerspective: 400,
        transformOrigin: '50% 80%',
        willChange: 'transform,opacity,filter',
      });
      // Fade in and slide
      timeline.from(q('.tag'), { y: -12, opacity: 0, duration: 0.5, stagger: 0.05 });
      timeline.from(
        titleLines,
        { y: 30, opacity: 0, rotateX: 12, filter: 'blur(8px)', duration: 0.9, stagger: 0.06 },
        '-=0.10'
      );
      // Subtitle slides up + fade
      timeline.from(
        q('.hero-sub'),
        { y: 16, opacity: 0, filter: 'blur(6px)', duration: 0.6 },
        '-=0.35'
      );
      // Pops in the CTA pill
      timeline.from(
        q('.pill'),
        { y: 12, opacity: 0, scale: 0.96, duration: 0.55, ease: 'back.out(1.7)' },
        '-=0.20'
      );
    },
    { scope: root }
  );

  // Calculate safe bottom space for background logos to avoid overlapping the grey logo strip
  useLayoutEffect(() => {
    const rootEl = root.current;
    const stripEl = stripRef.current;
    if (!rootEl || !stripEl) return;

    // Function to calculate & set safe bottom space
    const setSafeBottom = () => {
      const strip = stripEl.getBoundingClientRect();
      const section = rootEl.getBoundingClientRect();
      const safeBottom = Math.max(0, section.bottom - strip.top) + 12;
      rootEl.style.setProperty('--bg-safe-bottom', `${safeBottom}px`);
    };

    setSafeBottom();
    // Observe resize of the strip and window
    const ro = new ResizeObserver(setSafeBottom);
    ro.observe(stripEl);
    window.addEventListener('resize', setSafeBottom);

    return () => {
      ro.disconnect();
      window.removeEventListener('resize', setSafeBottom);
    };
  }, []);

  // Choose background image based on device
  const bgImage = isMobile ? logosMobile : grid;

  return (
    <section
      // Background section
      ref={root}
      className='relative isolate w-full overflow-x-hidden pt-20 md:pt-[216px] pb-16 md:pb-24 text-center'
      style={{
        backgroundImage: `url(${bgImage})`,
        backgroundSize: isMobile ? '105% auto' : 'cover',
        backgroundPosition: 'center',
        backgroundRepeat: 'no-repeat',
      }}
    >
      {/* Only render BackgroundLogos on tablet/desktop */}
      {!isMobile && (
        <BackgroundLogos
          layout='edge'
          inset={{ top: 0, right: 0, bottom: 'var(--bg-safe-bottom, 200px)', left: 0 }}
          globalScale={bgScale}
        />
      )}

      {/* White bottom gradient */}
      <div className='pointer-events-none absolute inset-x-0 bottom-0 h-24 md:h-44 `bg-linear-to-b` from-transparent to-white z-1' />

      {/* Tags */}
      <div
        className='
          mb-4 md:mb-6 flex items-center justify-center gap-2 md:gap-3 flex-wrap
          scale-100 md:scale-[1.34375]
        '
        style={{ transformOrigin: 'center' }}
      >
        <span
          className='tag inline-flex items-center gap-1 rounded-full px-3 py-1 text-[10px] md:text-[11px] font-normal tracking-[-0.03em] font-sans'
          style={{ fontFamily: 'Arial, sans-serif', backgroundColor: '#D6F1E2', color: '#35D758' }}
        >
          Protein <span className='ml-3 md:ml-4 text-[#4B8966]'>• Whey • Isolate • Casein</span>
        </span>

        <span
          className='tag inline-flex items-center gap-1 rounded-full px-3 py-1 text-[10px] md:text-[11px] font-normal tracking-[-0.03em] font-sans'
          style={{ fontFamily: 'Arial, sans-serif', backgroundColor: '#EAE8FA', color: '#464CEA' }}
        >
          Creatine <span className='ml-3 md:ml-4 text-[#6D728E]'>• Monohydrate • HCL</span>
        </span>
      </div>

      {/* Title */}
      <h1
        className='
          hero-title text-[clamp(34px,8.5vw,86px)]
          leading-tight md:leading-[1.1]
          tracking-[-0.05em] text-black text-center text-stroke
          px-3
        '
      >
        <span className='block font-king'>
          Supplement Smarter<span className='font-kings'>,</span>
        </span>
        <span className='block font-king'>Save More</span>
      </h1>

      {/* Subtitle */}
      <p className='hero-sub mt-4 md:mt-5 text-[clamp(11px,1.25vw,18px)] leading-[1.35] text-primary-dark px-4'>
        Built to help you find the lowest supplement prices in seconds
      </p>

      {/* CTA */}
      <div className='mt-8 md:mt-14 pill px-4'>
        <CTA />
      </div>

      {/* Grey logo strip */}
      <div
        ref={stripRef}
        className='
          relative z-2000 mt-16 md:mt-36
          mx-auto max-w-[1560px] px-4
          flex flex-wrap justify-center items-center
          gap-x-6 md:gap-x-8 gap-y-4 md:gap-y-6
          opacity-70
          min-h-11 md:min-h-16
        '
      >
        {LOGOS.map((logo) => (
          <div key={logo.alt} className='h-6 md:h-7 flex items-center justify-center'>
            <img
              src={logo.src}
              alt={logo.alt}
              className='max-h-full w-auto object-contain transition will-change-transform'
              style={{
                transform: `scale(${logo.scale ?? 1}) translateY(${logo.dy ?? 0}px)`,
                maxWidth: logo.maxW ? `${logo.maxW}px` : undefined,
              }}
              loading='eager'
              decoding='sync'
              fetchPriority='high'
              draggable='false'
            />
          </div>
        ))}
      </div>
    </section>
  );
}
