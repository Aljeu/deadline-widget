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
