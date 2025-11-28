import ArrowCurve from '@/assets/stocks/arrow.png';

export default function Footer() {
  return (
    <footer className='w-full bg-white text-black overflow-x-hidden'>
      {/* Brands List */}
      <div className='w-full bg-black text-white'>
        <div
          className='
            mx-auto max-w-[1560px]
            px-4 md:px-8 py-8 md:py-14
            grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4
            gap-x-8 md:gap-x-10 gap-y-8 md:gap-y-10
            justify-items-center md:justify-items-start
          '
        >
          {/* NZProtein */}
          <div className='text-center md:text-left w-full max-w-[320px]'>
            <h4 className='text-xs sm:text-sm font-semibold tracking-wide text-violet-300'>
              <a
                href='https://www.nzprotein.co.nz/'
                target='_blank'
                rel='noreferrer'
                className='hover:opacity-80'
              >
                NZProtein
              </a>
            </h4>
            <ul className='mt-3 sm:mt-4 space-y-1.5 sm:space-y-2 text-base sm:text-lg md:text-xl font-semibold italic tracking-tight'>
              <li>
                <a
                  href='/protein?retailer=nzprotein&brand=NZProtein'
                  className='hover:underline hover:opacity-80'
                >
                  NZProtein
                </a>
              </li>
            </ul>
          </div>

          {/* NoWhey column */}
          <div className='text-center md:text-left w-full max-w-[320px]'>
            <h4 className='text-xs sm:text-sm font-semibold tracking-wide text-orange-300'>
              <a
                href='https://nowhey.co.nz/'
                target='_blank'
                rel='noreferrer'
                className='hover:opacity-80'
              >
                NoWhey
              </a>
            </h4>
            <ul className='mt-3 sm:mt-4 space-y-1.5 sm:space-y-2 text-base sm:text-lg md:text-xl font-semibold italic tracking-tight'>
              <li>
                <a
                  href='/protein?retailer=nowhey&brand=NoWhey'
                  className='hover:underline hover:opacity-80'
                >
                  NoWhey
                </a>
              </li>
            </ul>
          </div>

          {/* SprintFit */}
          <div className='text-center md:text-left w-full max-w-[320px]'>
            <h4 className='text-xs sm:text-sm font-semibold tracking-wide text-emerald-400'>
              <a
                href='https://www.sprintfit.co.nz/'
                target='_blank'
                rel='noreferrer'
                className='hover:opacity-80'
              >
                SprintFit
              </a>
            </h4>
            <ul className='mt-3 sm:mt-4 space-y-1.5 sm:space-y-2 text-base sm:text-lg md:text-xl font-semibold italic tracking-tight'>
              <li>
                <a
                  href='/protein?retailer=sprintfit&brand=Athena'
                  className='hover:underline hover:opacity-80'
                >
                  Athena
                </a>
              </li>
              <li>
                <a
                  href='/protein?retailer=sprintfit&brand=BSN'
                  className='hover:underline hover:opacity-80'
                >
                  BSN
                </a>
              </li>
              <li>
                <a
                  href='/protein?retailer=sprintfit&brand=Premium%20Nutrition'
                  className='hover:underline hover:opacity-80'
                >
                  Premium Nutrition
                </a>
              </li>
              <li>
                <a
                  href='/protein?retailer=sprintfit&brand=Optimum%20Nutrition'
                  className='hover:underline hover:opacity-80'
                >
                  Optimum Nutrition
                </a>
              </li>
            </ul>
          </div>

          {/* Xplosiv */}
          <div className='text-center md:text-left w-full max-w-[320px]'>
            <h4 className='text-xs sm:text-sm font-semibold tracking-wide text-cyan-300'>
              <a
                href='https://xplosiv.nz/'
                target='_blank'
                rel='noreferrer'
                className='hover:opacity-80'
              >
                Xplosiv
              </a>
            </h4>
            <ul className='mt-3 sm:mt-4 space-y-1.5 sm:space-y-2 text-base sm:text-lg md:text-xl font-semibold italic tracking-tight'>
              <li>
                <a
                  href='/protein?retailer=xplosiv&brand=Mutant'
                  className='hover:underline hover:opacity-80'
                >
                  Mutant
                </a>
              </li>
              <li>
                <a
                  href='/protein?retailer=xplosiv&brand=Nothing%20Naughty'
                  className='hover:underline hover:opacity-80'
                >
                  Nothing Naughty
                </a>
              </li>
              <li>
                <a
                  href='/protein?retailer=xplosiv&brand=Pack%20Nutrition'
                  className='hover:underline hover:opacity-80'
                >
                  Pack Nutrition
                </a>
              </li>
              <li>
                <a
                  href='/protein?retailer=xplosiv&brand=PVL'
                  className='hover:underline hover:opacity-80'
                >
                  PVL
                </a>
              </li>
            </ul>
          </div>
        </div>
      </div>

      {/* CTA + Connect */}
      <div className='py-12 md:py-24 mb-2 md:mb-20 mt-6 md:mt-8'>
        <div
          className='
            mx-auto max-w-[92%] md:max-w-[900px]
            px-4 md:px-8
            flex flex-col md:flex-row
            items-start md:items-center
            gap-y-10 md:gap-y-0 md:gap-x-12
          '
        >
          {/* CTA */}
          <div className='relative flex-1 flex items-center justify-center md:justify-start gap-3'>
            <p className='font-king text-[clamp(16px,2vw,22px)] leading-tight tracking-[-0.02em] text-center md:text-left'>
              Start saving today and reach out if you would like a store included
            </p>
            <img
              src={ArrowCurve}
              alt=''
              className='hidden lg:block w-[65px] h-auto translate-y-[26px] pointer-events-none select-none'
              draggable='false'
            />
          </div>

          {/* Connect block */}
          <div className='w-full md:w-auto flex flex-col items-center md:items-end text-center md:text-right'>
            <h5 className='text-[16px] sm:text-[18px] text-black'>Connect</h5>
            <ul className='mt-2 space-y-3 font-[Arial] font-bold text-[18px] sm:text-[20px] leading-[110%] tracking-[0]'>
              <li>
                <a
                  href='https://www.linkedin.com/in/samuel-sajch/'
                  target='_blank'
                  rel='noreferrer'
                  className='hover:opacity-80'
                >
                  LinkedIn
                </a>
              </li>
              <li>
                <a
                  href='https://github.com/sswez02'
                  target='_blank'
                  rel='noreferrer'
                  className='hover:opacity-80'
                >
                  GitHub
                </a>
              </li>
              <li>
                <a href='mailto:sw.samuel.10@gmail.com' className='hover:opacity-80'>
                  Email
                </a>
              </li>
            </ul>
          </div>
        </div>
      </div>
    </footer>
  );
}
