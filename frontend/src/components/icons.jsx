// icons.jsx — minimalist inline SVG icons (stroke, 1.5, fill none).
import React from 'react';

function Svg({ size = 14, className = '', children, ...rest }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
      {...rest}
    >
      {children}
    </svg>
  );
}

/** 4-point sparkle star — header motif. */
export function StarIcon(props) {
  return (
    <Svg {...props}>
      <path d="M12 3 L13.8 10.2 L21 12 L13.8 13.8 L12 21 L10.2 13.8 L3 12 L10.2 10.2 Z" />
    </Svg>
  );
}

/** `</>` code glyph — tech edge. */
export function CodeIcon(props) {
  return (
    <Svg {...props}>
      <path d="M8 7 L3 12 L8 17" />
      <path d="M16 7 L21 12 L16 17" />
      <path d="M13 5 L11 19" />
    </Svg>
  );
}

/** Sync / refresh arrows — sync toggle glyph. */
export function SyncIcon(props) {
  return (
    <Svg {...props}>
      <path d="M23 4v6h-6" />
      <path d="M1 20v-6h6" />
      <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10" />
      <path d="M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
    </Svg>
  );
}

/** Calendar — deadline row glyph. */
export function CalendarIcon(props) {
  return (
    <Svg {...props}>
      <rect x="3" y="4" width="18" height="18" rx="2" />
      <path d="M16 2v4M8 2v4M3 10h18" />
    </Svg>
  );
}

/** Check — checkbox glyph. */
export function CheckIcon(props) {
  return (
    <Svg {...props}>
      <path d="M4 12.5 L9.5 18 L20 6.5" />
    </Svg>
  );
}

/** Pin / thumbtack — always-on-top toggle. Rotates 45deg when pinned. */
export function PinIcon(props) {
  return (
    <Svg {...props}>
      <path d="M12 17v5" />
      <path d="M9 10.76a2 2 0 0 1-1.11 1.79l-1.78.9A2 2 0 0 0 5 15.24V16a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-.76a2 2 0 0 0-1.11-1.79l-1.78-.9A2 2 0 0 1 15 10.76V7a1 1 0 0 1 1-1 2 2 0 0 0 0-4H8a2 2 0 0 0 0 4 1 1 0 0 1 1 1z" />
    </Svg>
  );
}

/** Map pin — location line glyph. */
export function MapPinIcon(props) {
  return (
    <Svg {...props}>
      <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z" />
      <circle cx="12" cy="10" r="3" />
    </Svg>
  );
}

/** Priority star — outline (unstarred). */
export function StarOutlineIcon({ size = 15, ...rest }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...rest}>
      <path d="M12 4l2.5 5.2 5.5.8-4 3.9.9 5.6-4.9-2.6-4.9 2.6.9-5.6-4-3.9 5.5-.8z" />
    </svg>
  );
}

/** Priority star — filled (starred). */
export function StarFilledIcon({ size = 15, ...rest }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...rest}>
      <path d="M12 4l2.5 5.2 5.5.8-4 3.9.9 5.6-4.9-2.6-4.9 2.6.9-5.6-4-3.9 5.5-.8z" />
    </svg>
  );
}

/** Trash — finished-task cleanup glyph. */
export function TrashIcon({ size = 12, ...rest }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...rest}>
      <path d="M4 7h16M9 7V5h6v2M6 7l1 12h10l1-12M10 11v5M14 11v5" />
    </svg>
  );
}

/* ---- colored time-of-day marks (filled gradients). One instance, so gradient ids are safe. ---- */

function GradDefs({ id, from, to }) {
  return (
    <defs>
      <linearGradient id={id} x1="0" x2="0" y1="0" y2="1">
        <stop offset="0" stopColor={from} />
        <stop offset="1" stopColor={to} />
      </linearGradient>
    </defs>
  );
}

export function SunriseMark({ size = 13 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true">
      <GradDefs id="g-rise" from="#FFC780" to="#FF7E50" />
      <path d="M17 16a5 5 0 0 0-10 0Z" fill="url(#g-rise)" />
      <path d="M12 3.5v2.2M5 7l1.6 1.6M19 7l-1.6 1.6" stroke="url(#g-rise)" strokeWidth="1.6" strokeLinecap="round" />
      <path d="M3 19h18" stroke="url(#g-rise)" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

export function SunMark({ size = 13 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true">
      <GradDefs id="g-sun" from="#FFD98A" to="#FF9B45" />
      <circle cx="12" cy="12" r="5" fill="url(#g-sun)" />
      <g stroke="url(#g-sun)" strokeWidth="1.6" strokeLinecap="round">
        <path d="M12 2.5V5M12 19v2.5M2.5 12H5M19 12h2.5M5.3 5.3l1.7 1.7M17 17l1.7 1.7M18.7 5.3L17 7M7 17l-1.7 1.7" />
      </g>
    </svg>
  );
}

export function SunsetMark({ size = 13 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true">
      <GradDefs id="g-set" from="#FF8F66" to="#E2663F" />
      <path d="M17 16a5 5 0 0 0-10 0Z" fill="url(#g-set)" opacity="0.95" />
      <path d="M12 6V3.5M5 8.5L3.4 6.9M19 8.5l1.6-1.6" stroke="url(#g-set)" strokeWidth="1.6" strokeLinecap="round" />
      <path d="M3 19h18" stroke="url(#g-set)" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

export function MoonMark({ size = 13 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true">
      <GradDefs id="g-moon" from="#B8C6FF" to="#6C7CE8" />
      <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z" fill="url(#g-moon)" />
      <g stroke="#C9D4FF" strokeWidth="1.6" strokeLinecap="round">
        <path d="M6.5 7h.01M9 4.5h.01M4.5 10h.01" />
      </g>
    </svg>
  );
}

/** Returns the right time-of-day mark + class for a clock hour. */
export function timeStateForHour(h) {
  if (h >= 4 && h < 12) return { Mark: SunriseMark, cls: 'mr-sunrise', greet: 'Good morning' };
  if (h >= 12 && h < 16) return { Mark: SunMark, cls: 'mr-sun', greet: 'Good afternoon' };
  if (h >= 16 && h < 18) return { Mark: SunsetMark, cls: 'mr-sunset', greet: 'Good afternoon' };
  return { Mark: MoonMark, cls: 'mr-moon', greet: 'Good evening' };
}
