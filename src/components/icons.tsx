// Small 16px line icons used across the studio and gallery. Decorative: always aria-hidden.
const P = { viewBox: "0 0 16 16", "aria-hidden": true as const, focusable: "false" as const };

export const Chevron = ({ className = "chev" }: { className?: string }) => (
  <svg className={className} {...P}><path d="M4 6l4 4 4-4" fill="none" stroke="currentColor" strokeWidth="1.5" /></svg>
);
export const Search = () => (
  <svg {...P}><circle cx="7" cy="7" r="4.5" fill="none" stroke="currentColor" strokeWidth="1.5" /><path d="M10.5 10.5L14 14" stroke="currentColor" strokeWidth="1.5" /></svg>
);
export const Check = () => (
  <svg {...P}><path d="M3.5 8.5l3 3 6-7" fill="none" stroke="currentColor" strokeWidth="1.75" /></svg>
);
export const Download = () => (
  <svg {...P}><path d="M8 2v8M4.5 6.5L8 10l3.5-3.5M3 13h10" fill="none" stroke="currentColor" strokeWidth="1.5" /></svg>
);
export const Warn = () => (
  <svg {...P}><path d="M8 2l6.5 11.5h-13z" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" /><path d="M8 6.5v3.5M8 11.6v.4" stroke="currentColor" strokeWidth="1.5" /></svg>
);
export const ErrorIcon = () => (
  <svg {...P}><circle cx="8" cy="8" r="6.2" fill="none" stroke="currentColor" strokeWidth="1.4" /><path d="M8 4.8v4M8 10.8v.5" stroke="currentColor" strokeWidth="1.5" /></svg>
);
export const Ok = () => (
  <svg {...P}><circle cx="8" cy="8" r="6.2" fill="none" stroke="currentColor" strokeWidth="1.4" /><path d="M5.2 8.2l2 2 3.6-4" fill="none" stroke="currentColor" strokeWidth="1.5" /></svg>
);
export const Info = ({ size }: { size?: number }) => (
  <svg {...P} width={size} height={size}><circle cx="8" cy="8" r="6.2" fill="none" stroke="currentColor" strokeWidth="1.4" /><path d="M8 7v4.5M8 4.6v.5" stroke="currentColor" strokeWidth="1.5" /></svg>
);
export const Close = () => (
  <svg {...P}><path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" strokeWidth="1.5" /></svg>
);
export const Loupe = () => (
  <svg {...P}><circle cx="7" cy="7" r="4.5" fill="none" stroke="currentColor" strokeWidth="1.5" /><path d="M10.5 10.5L14 14M5 7h4M7 5v4" stroke="currentColor" strokeWidth="1.5" /></svg>
);
export const ChevronRight = () => (
  <svg {...P}><path d="M6 3.5L10.5 8 6 12.5" fill="none" stroke="currentColor" strokeWidth="1.5" /></svg>
);
export const Shield = () => (
  <svg {...P}><path d="M8 1.8l5 2v4c0 3-2.2 5.2-5 6.4C5.2 13 3 10.8 3 7.8v-4z" fill="none" stroke="currentColor" strokeWidth="1.3" /></svg>
);
