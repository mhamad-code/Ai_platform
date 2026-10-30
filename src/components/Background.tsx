import { useEffect, useRef, useState } from 'react';

/**
 * Procedural landscape background inspired by the reference art direction:
 * a large central rock mass, a cloudy grey/blue sky, soft natural light and
 * translucent layers that never interfere with content readability.
 *
 * Everything is generated in SVG/CSS (no third-party image assets, no licence
 * questions) and reacts to the active theme.
 */
export type SceneVariant = 'ridge' | 'cliff' | 'mist';

interface Props {
  variant: SceneVariant;
  animate: boolean;
  light: boolean;
  reduced: boolean;
}

function Clouds({ light, animate }: { light: boolean; animate: boolean }) {
  const tone = light ? '#ffffff' : '#94a3b8';
  const opacity = light ? 0.75 : 0.35;
  return (
    <g style={animate ? { animation: 'cloudDrift 90s linear infinite' } : undefined}>
      {[
        [80, 120, 210, 42, 0.55],
        [340, 78, 260, 46, 0.45],
        [640, 140, 300, 52, 0.5],
        [980, 96, 240, 44, 0.4],
        [1180, 168, 280, 48, 0.35],
        [420, 210, 340, 56, 0.28],
      ].map(([x, y, w, h, o], i) => (
        <ellipse
          key={i}
          cx={x}
          cy={y}
          rx={w / 2}
          ry={h / 2}
          fill={tone}
          opacity={(o as number) * opacity}
          style={{ filter: 'blur(26px)' }}
        />
      ))}
    </g>
  );
}

export default function Background({ variant, animate, light, reduced }: Props) {
  const [mounted, setMounted] = useState(false);
  const raf = useRef(0);

  useEffect(() => {
    setMounted(true);
    return () => cancelAnimationFrame(raf.current);
  }, []);

  const skyTop = light ? '#b9c6d6' : '#3d4a5c';
  const skyMid = light ? '#d7dee7' : '#55647a';
  const skyLow = light ? '#e9edf2' : '#7b8798';
  const rockDark = light ? '#5b636e' : '#0f131a';
  const rockMid = light ? '#79828e' : '#1b212b';
  const rockLight = light ? '#9aa3ae' : '#2b333f';
  const haze = light ? '#eef1f5' : '#0b0e13';

  return (
    <div className="pointer-events-none fixed inset-0 -z-10 overflow-hidden" aria-hidden="true">
      <svg
        viewBox="0 0 1440 900"
        preserveAspectRatio="xMidYMid slice"
        className="h-full w-full"
        style={{
          transition: 'opacity .6s ease',
          opacity: mounted ? 1 : 0,
        }}
      >
        <defs>
          <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={skyTop} />
            <stop offset="55%" stopColor={skyMid} />
            <stop offset="100%" stopColor={skyLow} />
          </linearGradient>
          <linearGradient id="rock" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor={rockLight} />
            <stop offset="45%" stopColor={rockMid} />
            <stop offset="100%" stopColor={rockDark} />
          </linearGradient>
          <linearGradient id="ground" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={rockMid} />
            <stop offset="100%" stopColor={rockDark} />
          </linearGradient>
          <radialGradient id="glow" cx="30%" cy="18%" r="70%">
            <stop offset="0%" stopColor="#ffffff" stopOpacity={light ? 0.55 : 0.22} />
            <stop offset="100%" stopColor="#ffffff" stopOpacity="0" />
          </radialGradient>
          <filter id="grain">
            <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="3" seed="7" />
            <feColorMatrix type="saturate" values="0" />
            <feComponentTransfer>
              <feFuncA type="linear" slope="0.07" />
            </feComponentTransfer>
          </filter>
          <filter id="rockTex">
            <feTurbulence type="fractalNoise" baseFrequency="0.012 0.03" numOctaves="4" seed="12" />
            <feDisplacementMap in="SourceGraphic" scale="46" xChannelSelector="R" yChannelSelector="G" />
          </filter>
          <filter id="soft">
            <feGaussianBlur stdDeviation="8" />
          </filter>
        </defs>

        <rect width="1440" height="900" fill="url(#sky)" />
        <Clouds light={light} animate={animate && !reduced} />
        <rect width="1440" height="900" fill="url(#glow)" />

        {/* distant ridge */}
        <path
          d={
            variant === 'cliff'
              ? 'M0 640 L180 560 L360 620 L560 540 L760 610 L980 545 L1200 615 L1440 560 L1440 900 L0 900 Z'
              : variant === 'mist'
                ? 'M0 660 L220 610 L470 655 L720 600 L980 650 L1240 605 L1440 650 L1440 900 L0 900 Z'
                : 'M0 670 L240 620 L520 668 L780 612 L1060 665 L1300 620 L1440 660 L1440 900 L0 900 Z'
          }
          fill={rockMid}
          opacity="0.55"
          style={{ filter: 'blur(3px)' }}
        />

        {/* central rock mass */}
        <g filter="url(#rockTex)">
          <path
            d={
              variant === 'ridge'
                ? 'M470 900 C500 720 560 640 660 560 C720 512 780 470 840 470 C905 470 960 520 1010 585 C1070 660 1120 760 1140 900 Z'
                : variant === 'cliff'
                  ? 'M400 900 C430 700 470 560 560 470 C640 392 740 350 830 372 C930 396 990 480 1030 590 C1065 690 1090 790 1100 900 Z'
                  : 'M520 900 C545 760 600 670 690 600 C760 545 830 520 890 540 C960 563 1010 630 1050 720 C1080 790 1095 850 1100 900 Z'
            }
            fill="url(#rock)"
          />
        </g>

        {/* foreground ground plane */}
        <path
          d="M0 780 C260 748 520 776 760 780 C1010 784 1240 764 1440 780 L1440 900 L0 900 Z"
          fill="url(#ground)"
        />

        {/* atmospheric haze layers keep text readable over the scene */}
        <rect y="520" width="1440" height="380" fill={haze} opacity={light ? 0.35 : 0.45} />
        <rect width="1440" height="900" filter="url(#grain)" opacity="0.5" />
      </svg>

      {/* global readability scrim */}
      <div
        className="absolute inset-0"
        style={{
          background: light
            ? 'radial-gradient(120% 90% at 50% 0%, rgba(255,255,255,.35), rgba(238,241,245,.72))'
            : 'radial-gradient(120% 90% at 50% 0%, rgba(8,10,14,.15), rgba(8,10,14,.72))',
        }}
      />

      <style>{`
        @keyframes cloudDrift {
          0% { transform: translateX(0); }
          50% { transform: translateX(-60px); }
          100% { transform: translateX(0); }
        }
      `}</style>
    </div>
  );
}
