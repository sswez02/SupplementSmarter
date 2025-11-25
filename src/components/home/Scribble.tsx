import { useRef, useEffect } from 'react';
import { gsap } from 'gsap';
import { DrawSVGPlugin } from 'gsap/DrawSVGPlugin';
import { claimNextPath } from '@/lib/scribblePool';
import { claimNextColor } from '@/lib/colourPool';

gsap.registerPlugin(DrawSVGPlugin);

/**
 * Inputs:
 * - colors: array of color strings (length 4 preferred, but any length >= 1 works)
 * - strokeWidth: number
 * - className: string
 *
 * Usage example:
 * <Scribble
 *   colors={['#FF5C5C', '#FFC23D', '#6AE3E3', '#7B61FF']}
 *   strokeWidth={6}
 * />
 */

type ScribbleProps = {
  colors?: string[] | null; // provide 4 colors here (optional)
  strokeWidth?: number;
  className?: string;
  color?: string; // fallback if no colors provided
};

export default function Scribble({
  colors = null,
  strokeWidth = 12,
  className = '',
  color = 'black',
}: ScribbleProps) {
  const pathRef = useRef<SVGPathElement | null>(null);
  const svgRef = useRef<SVGSVGElement | null>(null);

  useEffect(() => {
    const path = pathRef.current; // the animated path
    const svg = svgRef.current; // the svg element

    // if refs aren't ready yet, bail out
    if (!path || !svg) return;

    const container = svg.closest('.scribble-container'); // the parent container

    // Slower durations on mobile for better visibility
    const isMobile =
      (typeof window !== 'undefined' &&
        (window.matchMedia?.('(hover: none)')?.matches ||
          window.matchMedia?.('(pointer: coarse)')?.matches)) ||
      (typeof window !== 'undefined' && window.innerWidth < 640);

    const enterDuration = isMobile ? 0.6 : 0.25; // slower on mobile
    const leaveDuration = isMobile ? 0.35 : 0.18; // slower on mobile

    const onEnter = () => {
      const d = claimNextPath(container);
      path.setAttribute('d', d);

      // Pick next stroke color from palette
      const stroke = claimNextColor(container, colors) ?? color;

      gsap.set(path, { drawSVG: '0%', stroke });
      gsap.to(path, { duration: enterDuration, drawSVG: '100%', ease: 'none' });
    };

    const onLeave = () => {
      gsap.to(path, { duration: leaveDuration, drawSVG: '100% 100%', ease: 'none' });
    };

    container?.addEventListener('mouseenter', onEnter);
    container?.addEventListener('mouseleave', onLeave);
    return () => {
      container?.removeEventListener('mouseenter', onEnter);
      container?.removeEventListener('mouseleave', onLeave);
    };
  }, [colors, color]);

  return (
    <svg
      ref={svgRef}
      className={`absolute left-0 bottom-0 w-full h-16px pointer-events-none -z-10 ${className}`}
      viewBox='0 0 310 41'
      fill='none'
      xmlns='http://www.w3.org/2000/svg'
      preserveAspectRatio='none'
    >
      <path ref={pathRef} strokeWidth={strokeWidth} strokeLinecap='round' />
    </svg>
  );
}
