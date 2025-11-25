import { useLayoutEffect, useRef, type MouseEvent as ReactMouseEvent } from 'react';
import { gsap } from 'gsap';
import CustomEase from 'gsap/CustomEase';
import Scribble from '@/components/home/Scribble';
import { Link } from 'react-router-dom';

gsap.registerPlugin(CustomEase);

type CTAVariant = 'gray' | 'black';

type CTAProps = {
  variant?: CTAVariant;
};

export default function CTA({ variant = 'gray' }: CTAProps) {
  const hitboxRef = useRef<HTMLDivElement | null>(null); // outer clickable area
  const shellRef = useRef<HTMLDivElement | null>(null); // inner container holding everything
  const pillRef = useRef<HTMLDivElement | null>(null); // colored pill with “Start Saving”
  const startTextRef = useRef<HTMLSpanElement | null>(null); // “Start Saving” text
  const choicesRef = useRef<HTMLDivElement | null>(null); // container with the two choices
  const tlRef = useRef<gsap.core.Timeline | null>(null); // box to store the GSAP timeline object so we only create it once

  // Setup
  useLayoutEffect(() => {
    const hitbox = hitboxRef.current;
    const shell = shellRef.current;
    const pill = pillRef.current;
    const startText = startTextRef.current;
    const choices = choicesRef.current;

    if (!hitbox || !shell || !pill || !startText || !choices) return;
    if (tlRef.current) return;

    // Detect touch devices for hover handling
    const isTouch =
      window.matchMedia('(hover: none)').matches || window.matchMedia('(pointer: coarse)').matches;

    // Custom ease
    const easeOut = CustomEase.create('easeOut', '0.19,1,0.22,1');
    gsap.set(shell, { backgroundColor: 'transparent' }); // prevent bg color on load

    // Initial states
    // At rest, the pill is fully visible, and the choices are hidden
    const pillFull = 'circle(100% at 50% 50%)'; // clip-path to show the full pill
    const pillZero = 'circle(0% at 50% 50%)'; // clip-path to hide the pill
    gsap.set(pill, { clipPath: pillFull, WebkitClipPath: pillFull, willChange: 'clip-path' });
    gsap.set(startText, { opacity: 1, y: 0, letterSpacing: '0em' }); // ensure start text is visible
    gsap.set(choices, { opacity: 0, y: 10, pointerEvents: 'none' }); // hide choices

    // Timeline
    const timeline = gsap.timeline({
      paused: true, // start paused
      defaults: { ease: easeOut },
      // ⬇⬇ changed to block body so it returns void
      onReverseComplete: () => {
        gsap.set(choices, { pointerEvents: 'none' });
      },
    });

    timeline
      // Expand pill
      .to(pill, { duration: 0.6, clipPath: pillZero }, 0)
      // Hide start text
      .to(startText, { duration: 0.3, opacity: 0, y: -6, letterSpacing: '0.02em' }, 0.04)
      // Show choices
      .to(
        choices,
        {
          duration: 0.3,
          opacity: 1,
          y: 0,
          // ⬇⬇ changed to block body so it returns void
          onStart: () => {
            gsap.set(choices, { pointerEvents: 'auto' });
          },
        },
        0.34
      );

    // Reset choices and pill visibility on reverse complete
    timeline.eventCallback('onReverseComplete', () => {
      gsap.set(choices, {
        opacity: 0,
        y: 6,
        pointerEvents: 'none',
        willChange: 'opacity, transform',
      });
      gsap.set(pill, { visibility: 'visible' });
    });

    // Animate choice buttons
    const buttons = choices.querySelectorAll<HTMLButtonElement>('button');
    if (buttons.length) {
      timeline.from(
        buttons,
        {
          duration: 0.18,
          y: 6,
          rotate: 0.2,
          ease: 'back.out(1.4)',
          force3D: true,
          clearProps: 'transform',
          stagger: 0.04,
        },
        0.1
      );

      // Prevent clicks on choice buttons from toggling the pill
      buttons.forEach((btn) =>
        btn.addEventListener('click', (e: MouseEvent) => {
          e.stopPropagation();
        })
      );
    }

    // Event handlers for hover
    const onEnter = () => timeline.play(); // hover = open choices
    const onLeave = () => timeline.reverse(); // unhover = close choices

    // Click handler to toggle
    const toggle = (e: MouseEvent) => {
      if (choices.contains(e.target as Node)) return; // don't toggle if clicking on choices
      e.preventDefault();
      if (timeline.reversed() || timeline.progress() === 0) timeline.play();
      else timeline.reverse();
    };

    // No hover on touch devices
    if (!isTouch) {
      hitbox.addEventListener('mouseenter', onEnter);
      hitbox.addEventListener('mouseleave', onLeave);
    }

    hitbox.addEventListener('click', toggle);

    tlRef.current = timeline;

    // Cleanup
    return () => {
      if (!isTouch) {
        hitbox.removeEventListener('mouseenter', onEnter);
        hitbox.removeEventListener('mouseleave', onLeave);
      }
      hitbox.removeEventListener('click', toggle);
      timeline.kill();
      tlRef.current = null;
    };
  }, []);

  // Determine styles based on variant
  const isBlack = variant === 'black';

  return (
    <div
      ref={hitboxRef}
      className='relative inline-block p-24 -m-24'
      role='button'
      tabIndex={0}
      style={{ touchAction: 'manipulation', cursor: 'pointer' }}
      aria-label='Start saving'
    >
      <div ref={shellRef} className='relative rounded-full px-2 py-2 bg-transparent'>
        {/* Sizing */}
        <div className='invisible flex items-center justify-center gap-2'>
          <span className='px-6 py-3 text-base font-medium'>Protein</span>
          <span className='px-6 py-3 text-base font-medium'>Creatine</span>
        </div>

        {/* Pill */}
        <div className='absolute inset-0 z-10 flex items-center justify-center pointer-events-none'>
          <div
            ref={pillRef}
            className={`rounded-full px-6 py-3 ${isBlack ? 'bg-black' : 'bg-primary-light'}`}
            style={{ willChange: 'clip-path' }}
          >
            <span
              ref={startTextRef}
              className={`text-base font-medium ${isBlack ? 'text-white' : 'text-black'}`}
            >
              Start Saving
            </span>
          </div>
        </div>

        {/* Choices */}
        <div
          ref={choicesRef}
          className='absolute inset-0 flex items-center justify-center gap-2 translate-y-2'
          style={{ zIndex: 1000, isolation: 'isolate', opacity: 0, pointerEvents: 'none' }}
        >
          <div className='relative isolate scribble-container'>
            <Link
              to='/protein'
              className='scribble-target relative z-10 inline-flex items-center justify-center
              rounded-full px-6 py-3 text-base font-medium bg-transparent text-black'
              onClick={(e: ReactMouseEvent<HTMLAnchorElement>) => e.stopPropagation()}
            >
              Protein
            </Link>
            <Scribble colors={['#f48bf4', '#efc44a', '#a0f085', '#8ae6e6']} strokeWidth={10} />
          </div>

          <div className='relative isolate scribble-container'>
            <Link
              to='/creatine'
              className='scribble-target relative z-10 inline-flex items-center justify-center
              rounded-full px-6 py-3 text-base font-medium bg-transparent text-black'
              onClick={(e: ReactMouseEvent<HTMLAnchorElement>) => e.stopPropagation()}
            >
              Creatine
            </Link>
            <Scribble colors={['#f48bf4', '#efc44a', '#a0f085', '#8ae6e6']} strokeWidth={10} />
          </div>
        </div>
      </div>
    </div>
  );
}
