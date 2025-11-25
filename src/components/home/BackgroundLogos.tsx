import { useMemo, useRef, useState, useLayoutEffect } from 'react';
import { gsap } from 'gsap';
import { useGSAP } from '@gsap/react';
gsap.registerPlugin(useGSAP);

// Logo assets
import logoD from '@/assets/logos/logo_D.png';
import logoGH from '@/assets/logos/logo_GH.png';
import logoGN from '@/assets/logos/logo_GN.png';
import logoMP from '@/assets/logos/logo_MP.png';
import logoMT from '@/assets/logos/logo_MT.png';
import logoN from '@/assets/logos/logo_N.png';
import logoON from '@/assets/logos/logo_ON.png';
import logoPVL from '@/assets/logos/logo_PVL.png';
import logoR from '@/assets/logos/logo_R.png';
import logoR1 from '@/assets/logos/logo_R1.png';
import logoZL from '@/assets/logos/logo_ZL.png';

// Badge assets
import ObstacleBadge from '@/components/home/ObstacleBadge';
import labelInfinity from '@/assets/webpages/Store Infinity Supplements.png';
import baseInfinity from '@/assets/webpages/Infinity Supplements.png';
import labelNutrition from '@/assets/webpages/Store Nutrition Warehouse.png';
import baseNutrition from '@/assets/webpages/Nutrition Warehouse.png';
import labelSprintFit from '@/assets/webpages/Store SprintFit.png';
import baseSprintFit from '@/assets/webpages/SprintFit.png';

/* Types */

type RectPct = {
  left: number;
  right: number;
  top: number;
  bottom: number;
};

type LogoPosition = {
  x: number;
  y: number;
  size: number;
  scale?: number;
};

type BadgeConfig = {
  baseSrc: string;
  labelSrc: string;
  width: number;
  labelScale: number;
  labelOffset: number;
};

type BadgePosition = {
  x: number;
  y: number;
};

type Inset = {
  top: number;
  right: number;
  bottom: number | string;
  left: number;
};

type BackgroundLogosProps = {
  layout?: 'edge' | 'grid';
  pullDistance?: number;
  rounded?: number;
  bgLogoSizePct?: number;
  inset?: Inset;
  globalScale?: number;
};

type DriftingNode = HTMLElement & {
  _cx?: number;
  _cy?: number;
  _hw?: number;
  _hh?: number;
  _idleAmpPx?: number;
  _idle?: gsap.core.Tween;
};

type DriftLayer = HTMLDivElement & {
  _drift?: gsap.core.Tween;
};

/* Configuration constants */

// Logo list
const LOGO_FILES: string[] = [
  logoD,
  logoGH,
  logoGN,
  logoMP,
  logoMT,
  logoN,
  logoON,
  logoPVL,
  logoR,
  logoR1,
  logoZL,
];

// Drift limits
const DRIFT_MAX_PCT = 2; // +/- 2% screen size
const BOUNDARY_PX = 24; // min distance from edges
const DRIFT_MARGIN_MULT = 1.6; // multiplier for drift margin

// Responsive baseline
const DESIGN_WIDTH = 1280; // design width for scale calculations
const MIN_SCALE = 0.55; // minimum scale factor
const MAX_SCALE = 1; // maximum scale factor

// MOBILE (<640px)
const COMPACT = {
  keepFraction: 0.35, // fraction of logos to keep
  minDistFromCenterPct: 40, // min distance from center %
  sizeMultiplier: 0.86, // size multiplier
  badgeMultiplier: 0.8, // badge size multiplier
  drift: 1, // Drift % multiplier
  pullPx: 120,
};

// TABLET (640–1099px)
const TABLET = {
  keepFraction: 0.6,
  sizeMultiplier: 0.92,
  drift: 1.2,
  pullPx: 160,
  safeRects: [
    { left: 16, right: 84, top: 22, bottom: 70 },
    { left: 10, right: 90, top: 14, bottom: 22 },
  ] as RectPct[],
};

// SMALL DESKTOP (≈ 1100–1366px incl. 1280px)
const SMALL_DESKTOP = {
  keepFraction: 0.7,
  sizeMultiplier: 0.96,
  drift: 1.6,
  pullPx: 180,
  badgeScale: 0.9,
  safeRects: [{ left: 18, right: 82, top: 28, bottom: 64 }] as RectPct[],
};

// Fixed logo positions
const LOGO_POSITIONS: LogoPosition[] = [
  { x: 6, y: 45, size: 84, scale: 1.5 },
  { x: 8, y: 75, size: 100, scale: 1 },
  { x: 18, y: 30, size: 88, scale: 2 },
  { x: 20, y: 70, size: 96 },
  { x: 96, y: 18, size: 108 },
  { x: 94, y: 45, size: 96, scale: 0.5 },
  { x: 92, y: 72, size: 104 },
  { x: 12, y: 24, size: 96, scale: 1.5 },
  { x: 80, y: 70, size: 92, scale: 2 },
  { x: 12, y: 10, size: 88 },
  { x: 88, y: 90, size: 96, scale: 1.5 },
];

// Badge positions
const BADGE_CONFIGS: BadgeConfig[] = [
  {
    baseSrc: baseInfinity, // badge base image
    labelSrc: labelInfinity, // badge label image
    width: 220, // badge width
    labelScale: 0.55, // label scale
    labelOffset: -20, // label vertical offset
  },
  {
    baseSrc: baseNutrition,
    labelSrc: labelNutrition,
    width: 220,
    labelScale: 0.55,
    labelOffset: -20,
  },
  {
    baseSrc: baseSprintFit,
    labelSrc: labelSprintFit,
    width: 220,
    labelScale: 0.25,
    labelOffset: -20,
  },
];

// Badge positions (as % of container)
const BADGE_POSITIONS: BadgePosition[] = [
  { x: 25, y: 5 },
  { x: 80, y: 14 },
  { x: 68, y: 54 },
];

/* Utility helpers */

// Fisher-Yates shuffle
const shuffle = <T,>(arr: T[]): T[] => {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
};

// Cycle array to length n
// eg: cycleToLength(['A', 'B'], 5);
// // ['A', 'B', 'A', 'B', 'A']
const cycleToLength = <T,>(arr: T[], n: number): T[] => {
  if (arr.length === 0) {
    return Array(n).fill(undefined as T);
  }
  const out: T[] = [];
  for (let i = 0; i < n; i++) out.push(arr[i % arr.length]);
  return out;
};

// Restrict number between min and max range
// eg: rangeNum(5, 1, 10) => 5
// eg: rangeNum(-2, 0, 8) => 0
// eg: rangeNum(12, 0, 10) => 10
const rangeNum = (v: number, min: number, max: number): number => Math.min(Math.max(v, min), max);

// Check if point is inside rectangle
// eg: isInsideRect({x:50,y:50}, {left:20,right:80,top:20,bottom:80}) => true
// eg: isInsideRect({x:10,y:50}, {left:20,right:80,top:20,bottom:80}) => false
const isInsideRect = (p: { x: number; y: number }, r: RectPct): boolean =>
  p.x >= r.left && p.x <= r.right && p.y >= r.top && p.y <= r.bottom;

// Check if point is outside all rectangles
// eg: outsideAll({x:10,y:50}, [{left:20,right:80,top:20,bottom:80}, {left:0,right:5,top:0,bottom:5}]) => true
// eg: outsideAll({x:30,y:50}, [{left:20,right:80,top:20,bottom:80}, {left:0,right:5,top:0,bottom:5}]) => false
const outsideAll = (p: { x: number; y: number }, rects: RectPct[]): boolean =>
  rects.every((r) => !isInsideRect(p, r));

// Main component
export default function BackgroundLogos({
  layout = 'edge', // edge layout for specific logo positions vs uniform grid layout
  pullDistance = 200, // distance for pointer pull effect
  rounded = 24, // border radius for logos
  bgLogoSizePct = 60, // background square logo size percentage
  inset = { top: 0, right: 0, bottom: 200, left: 0 }, // container inset
}: BackgroundLogosProps) {
  const root = useRef<HTMLDivElement | null>(null);
  const logoRefs = useRef<(HTMLElement | null)[]>([]);
  const badgeRefs = useRef<(HTMLElement | null)[]>([]);
  const logoLayerRef = useRef<HTMLDivElement | null>(null);
  const badgeLayerRef = useRef<HTMLDivElement | null>(null);

  // Responsive auto scale and modes
  const [autoScale, setAutoScale] = useState<number>(1); // responsive scale factor
  const [isCompact, setIsCompact] = useState<boolean>(false); // <640
  const [isTablet, setIsTablet] = useState<boolean>(false); // 640–1099
  const [isSmallDesktop, setIsSmallDesktop] = useState<boolean>(false); // 1100–1366

  // Compute responsive scale and modes
  useLayoutEffect(() => {
    if (!root.current) return;
    const element = root.current; // observe root element size

    // Update on resize
    const resize = new ResizeObserver(() => {
      const width = element.clientWidth || DESIGN_WIDTH;
      const scale = rangeNum(width / DESIGN_WIDTH, MIN_SCALE, MAX_SCALE);
      setAutoScale(scale);
      setIsCompact(width < 640);
      setIsTablet(width >= 640 && width < 1100);
      setIsSmallDesktop(width >= 1100 && width <= 1800);
    });

    resize.observe(element);
    return () => resize.disconnect();
  }, []);

  // Determine badge order once
  const badgeOrder = useMemo(() => shuffle([0, 1, 2]), []);

  // Choose active positions
  const filledPositions = useMemo(() => {
    // Select positions based on layout and mode
    if (isCompact) {
      const far = LOGO_POSITIONS.map((p) => ({
        p,
        d2: (p.x - 50) ** 2 + (p.y - 50) ** 2,
      })).sort((a, b) => b.d2 - a.d2);
      const keep = Math.max(4, Math.ceil(LOGO_POSITIONS.length * COMPACT.keepFraction));
      return far.slice(0, keep).map(({ p }) => p);
    }

    if (isTablet) {
      const filtered = LOGO_POSITIONS.filter((p) => outsideAll(p, TABLET.safeRects));
      const ranked = filtered
        .map((p) => ({ p, d2: (p.x - 50) ** 2 + (p.y - 50) ** 2 }))
        .sort((a, b) => b.d2 - a.d2);
      const keep = Math.max(6, Math.ceil(ranked.length * TABLET.keepFraction));
      return ranked.slice(0, keep).map(({ p }) => p);
    }

    if (isSmallDesktop) {
      const filtered = LOGO_POSITIONS.filter((p) => outsideAll(p, SMALL_DESKTOP.safeRects));
      const ranked = filtered
        .map((p) => ({ p, d2: (p.x - 50) ** 2 + (p.y - 50) ** 2 }))
        .sort((a, b) => b.d2 - a.d2);
      const keep = Math.max(7, Math.ceil(ranked.length * SMALL_DESKTOP.keepFraction));
      return ranked.slice(0, keep).map(({ p }) => p);
    }

    // Wide desktop
    return LOGO_POSITIONS;
  }, [layout, isCompact, isTablet, isSmallDesktop]);

  // Assign logos for edge layout
  const items = useMemo(() => {
    if (filledPositions.length === 0) return [];

    // Determine median size
    const baseSizes = filledPositions.map((p) => p.size * (p.scale ?? 1));
    const sorted = [...baseSizes].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    const median = sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;

    // Split into small and big groups using median
    const small: number[] = [];
    const big: number[] = [];
    filledPositions.forEach((_, i) => {
      (baseSizes[i] <= median ? small : big).push(i);
    });

    // Assign logos to each position
    const totalPositions = filledPositions.length;
    let list = shuffle(LOGO_FILES); // randomise logo list
    if (list.length < totalPositions) list = cycleToLength(list, totalPositions); // repeat to fit
    else if (list.length > totalPositions) list = list.slice(0, totalPositions); // trim to fit

    const assignedLogos: string[] = Array(totalPositions); // assigned logo sources
    let index = 0; // cursor in logo list
    small.forEach((pos) => (assignedLogos[pos] = list[index++])); // assign small logos first
    big.forEach((pos) => (assignedLogos[pos] = list[index++])); // then big logos

    // Build final items to render
    return filledPositions.map((pos, i) => ({ src: assignedLogos[i], ...pos }));
  }, [filledPositions]);

  // GSAP Animations
  useGSAP(
    () => {
      const rootElement = root.current;
      const logoLayer = logoLayerRef.current as DriftLayer | null;
      const logos = logoRefs.current.filter(Boolean) as DriftingNode[];
      const badges = badgeRefs.current.filter(Boolean) as DriftingNode[];
      const groupedElements: DriftingNode[] = [...logos, ...badges];

      if (!rootElement || !logoLayer || groupedElements.length === 0) return;

      function containerRect(): DOMRect {
        return rootElement!.getBoundingClientRect();
      }

      // Calculate drift margins based on current drift percentages
      function driftMargins(): { dy: number; dx: number } {
        const container = containerRect();
        const yPct = Math.abs(+gsap.getProperty(logoLayer, 'yPercent') || 0);
        const xPct = Math.abs(+gsap.getProperty(logoLayer, 'xPercent') || 0);
        return {
          dy: ((yPct * DRIFT_MARGIN_MULT) / 100) * container.height,
          dx: ((xPct * DRIFT_MARGIN_MULT) / 100) * container.width,
        };
      }

      // Update center positions of all elements
      function updateCenters(): void {
        groupedElements.forEach((n) => {
          const container = n.getBoundingClientRect();
          n._cx = (container.left + container.right) / 2; // Position of center x
          n._cy = (container.top + container.bottom) / 2; // Position of center y
          n._hw = container.width / 2; // Half width
          n._hh = container.height / 2; // Half height
        });
      }

      function limitsFor(n: DriftingNode) {
        const container = containerRect();
        const hw = n._hw ?? n.offsetWidth / 2;
        const hh = n._hh ?? n.offsetHeight / 2;
        const idleMarginY = n._idleAmpPx ?? 0; // Idle bobbing animation margin (on Y axis only)
        const { dy: driftMarginY, dx: driftMarginX } = driftMargins();
        const marginY = idleMarginY + driftMarginY + BOUNDARY_PX;
        const marginX = driftMarginX + BOUNDARY_PX;
        return {
          minX: container.left + hw + marginX - (n._cx ?? container.left),
          maxX: container.right - hw - marginX - (n._cx ?? container.right),
          minY: container.top + hh + marginY - (n._cy ?? container.top),
          maxY: container.bottom - hh - marginY - (n._cy ?? container.bottom),
        };
      }

      // Enforce boundary limits on all elements
      function enforceBounds(): void {
        updateCenters(); // Ensure centers are up to date
        groupedElements.forEach((n) => {
          const lim = limitsFor(n);
          const x = +gsap.getProperty(n, 'x') || 0; // current x
          const y = +gsap.getProperty(n, 'y') || 0; // current y
          const nx = rangeNum(x, lim.minX, lim.maxX); // new x within limits
          const ny = rangeNum(y, lim.minY, lim.maxY); // new y within limits
          if (nx !== x || ny !== y) gsap.set(n, { x: nx, y: ny });
        });
      }

      /* Idle bob for logos*/
      logos.forEach((node) => {
        const yAmpPct = gsap.utils.random(0.6, 1.2); // amplitude as percentage of height
        const ampPx = (yAmpPct / 100) * node.offsetHeight;
        node._idleAmpPx = ampPx;
        node._idle && node._idle.kill();
        node._idle = gsap.fromTo(
          node,
          { y: -ampPx },
          {
            y: ampPx, // bob between -ampPx to +ampPx
            rotation: gsap.utils.random(-0.5, 0.5), // slight rotation
            duration: gsap.utils.random(6, 10), // duration of one full cycle
            ease: 'sine.inOut', // smooth sine ease
            yoyo: true, // reverse on yoyo
            repeat: -1, // infinite
            delay: gsap.utils.random(0, 1.2), // random initial delay
            transformOrigin: '50% 50%', // center origin
            force3D: true, // force 3D for better performance
            onUpdate: enforceBounds, // enforce bounds on update
          }
        );
      });
      badges.forEach((node) => {
        node._idleAmpPx = 0;
      });

      /* Drift animation for logos */
      const drift = isCompact
        ? COMPACT.drift
        : isTablet
        ? TABLET.drift
        : isSmallDesktop
        ? SMALL_DESKTOP.drift
        : DRIFT_MAX_PCT;

      logoLayer._drift && logoLayer._drift.kill();
      logoLayer._drift = gsap.to(logoLayer, {
        // drift animation
        xPercent: gsap.utils.random(-drift, drift), // random xPercent drift
        yPercent: gsap.utils.random(-drift, drift), // random yPercent drift
        duration: 18, // duration of one full drift cycle
        ease: 'sine.inOut', // smooth sine ease
        yoyo: true, // reverse on yoyo
        repeat: -1, // infinite
        force3D: true, // force 3D for better performance
        onUpdate: enforceBounds, // enforce bounds on update
      });

      /*Pointer move pull effect*/
      const basePull = pullDistance || 200;
      const scaledPull =
        (isCompact
          ? COMPACT.pullPx
          : isTablet
          ? TABLET.pullPx
          : isSmallDesktop
          ? SMALL_DESKTOP.pullPx
          : basePull) * autoScale;

      const handleMove = (e: PointerEvent) => {
        updateCenters();
        const { clientX: x, clientY: y } = e;

        // Apply pull effect to each element
        groupedElements.forEach((n) => {
          const dx = x - (n._cx ?? x);
          const dy = y - (n._cy ?? y);
          const dist = Math.hypot(dx, dy);

          // Apply pull if cursor within scaledPull distance
          if (dist < scaledPull) {
            const t = dist / scaledPull;
            let tx = dx * t;
            let ty = dy * t;

            const lim = limitsFor(n);
            // Softening function near boundaries
            //  value = original value
            //  min = minimum limit
            //  max = maximum limit
            //  pad = padding distance from min/max to start softening
            const soften = (value: number, min: number, max: number, pad = 12): number => {
              const mmin = min + pad;
              const mmax = max - pad;
              if (value < mmin) {
                const d = mmin - value;
                return mmin - d / (1 + d * 0.12);
              }
              if (value > mmax) {
                const d = value - mmax;
                return mmax + d / (1 + d * 0.12);
              }
              return value;
            };
            tx = rangeNum(soften(tx, lim.minX, lim.maxX), lim.minX, lim.maxX);
            ty = rangeNum(soften(ty, lim.minY, lim.maxY), lim.minY, lim.maxY);

            // Apply the pull with a smooth animation
            gsap.to(n, { x: tx, y: ty, duration: 0.6, ease: 'sine.out', overwrite: 'auto' });
          } else {
            const lim = limitsFor(n);
            gsap.to(n, {
              x: rangeNum(0, lim.minX, lim.maxX),
              y: rangeNum(0, lim.minY, lim.maxY),
              duration: 1.2,
              ease: 'sine.inOut',
              overwrite: 'auto', // return to rest position
            });
          }
        });
      };

      // Handle pointer leaving window area
      const handleLeave = () => {
        updateCenters();
        // Return all elements to rest positions
        groupedElements.forEach((n) => {
          const lim = limitsFor(n);
          gsap.to(n, {
            x: rangeNum(0, lim.minX, lim.maxX),
            y: rangeNum(0, lim.minY, lim.maxY),
            duration: 1.0,
            ease: 'sine.inOut',
            overwrite: 'auto',
          });
        });
      };

      const handleWindowOut = (e: PointerEvent) => {
        if (!e.relatedTarget) handleLeave();
      };

      window.addEventListener('pointermove', handleMove, { passive: true });
      window.addEventListener('pointerout', handleWindowOut, { passive: true });
      window.addEventListener('resize', updateCenters);
      gsap.ticker.add(enforceBounds);
      updateCenters();

      return () => {
        window.removeEventListener('pointermove', handleMove);
        window.removeEventListener('pointerout', handleWindowOut);
        window.removeEventListener('resize', updateCenters);
        gsap.ticker.remove(enforceBounds);
        logos.forEach((n) => n._idle && n._idle.kill());
        logoLayer._drift && logoLayer._drift.kill();
      };
    },
    { scope: root, dependencies: [autoScale, isCompact, isTablet, isSmallDesktop] }
  );

  // Size multipliers from screen size
  const sizeMult = isCompact
    ? COMPACT.sizeMultiplier
    : isTablet
    ? TABLET.sizeMultiplier
    : isSmallDesktop
    ? SMALL_DESKTOP.sizeMultiplier
    : 1;

  const showBadges = !isCompact && !isTablet; // show on small/large desktop only for reduced mobile clutter
  const badgeScale = isSmallDesktop ? SMALL_DESKTOP.badgeScale : 1;

  return (
    <div
      ref={root}
      aria-hidden
      className='absolute inset-0 z-50 select-none pointer-events-none overflow-hidden'
      style={{
        top: inset.top,
        right: inset.right,
        bottom: inset.bottom,
        left: inset.left,
        width: '100%',
        maxWidth: '100%',
        contain: 'layout paint',
      }}
    >
      {/* Badges */}
      {showBadges && (
        <div ref={badgeLayerRef} className='absolute inset-0'>
          {BADGE_POSITIONS.map((pos, i) => {
            const def = BADGE_CONFIGS[badgeOrder[i]];
            return (
              <div
                key={i}
                ref={(el) => {
                  badgeRefs.current[i] = el;
                }}
                className='absolute'
                style={{
                  left: `${pos.x}%`,
                  top: `${pos.y}%`,
                  transform: 'translate(-50%, -50%)',
                }}
              >
                <ObstacleBadge
                  baseSrc={def.baseSrc}
                  labelSrc={def.labelSrc}
                  width={def.width * autoScale * badgeScale}
                  labelScale={def.labelScale}
                  labelOffset={def.labelOffset}
                />
              </div>
            );
          })}
        </div>
      )}

      {/* Logos */}
      <div ref={logoLayerRef} className='absolute inset-0'>
        {layout === 'edge' && (
          <div className='relative w-full h-full'>
            {items.map((it, i) => {
              const finalSize = it.size * (it.scale || 1) * 2 * autoScale * sizeMult;
              return (
                <span
                  key={i}
                  ref={(el) => {
                    logoRefs.current[i] = el;
                  }}
                  style={{
                    position: 'absolute',
                    left: `${it.x}%`,
                    top: `${it.y}%`,
                    transform: 'translate(-50%, -50%)',
                    width: finalSize,
                    height: finalSize,
                    background: 'transparent',
                    backgroundImage: `url(${it.src})`,
                    backgroundSize: `${bgLogoSizePct}% auto`,
                    backgroundRepeat: 'no-repeat',
                    backgroundPosition: 'center',
                    opacity: 1,
                    willChange: 'transform',
                    display: 'inline-block',
                    borderRadius: rounded,
                  }}
                />
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
