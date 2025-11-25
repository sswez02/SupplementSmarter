import { forwardRef } from 'react';

type ObstacleBadgeProps = {
  baseSrc: string; // base card image source
  labelSrc: string; // label image source
  width?: number; // total width of the badge
  labelScale?: number; // label width as fraction of base width
  labelOffset?: number; // label vertical offset in px
};

// Scales: base card width, label width (as fraction of base), label vertical offset
const ObstacleBadge = forwardRef<HTMLDivElement, ObstacleBadgeProps>(
  ({ baseSrc, labelSrc, width = 300, labelScale = 0.7, labelOffset = -6 }, ref) => {
    const height = width * 0.66;

    return (
      <div ref={ref} className='absolute pointer-events-none select-none' style={{ width, height }}>
        {/* Base card */}
        <img
          src={baseSrc}
          alt=''
          className='absolute inset-0 w-full h-full object-contain rounded-24px'
          draggable='false'
        />

        {/* Label (fixed relative to base) */}
        <div
          className='absolute left-1/2 -translate-x-1/2'
          style={{ top: labelOffset, width: width * labelScale }}
        >
          <img src={labelSrc} alt='' className='w-full h-auto drop-shadow' draggable='false' />
        </div>
      </div>
    );
  }
);

export default ObstacleBadge;
