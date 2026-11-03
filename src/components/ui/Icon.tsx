import type { SVGProps } from 'react';

const paths = {
  search: <><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></>,
  plus: <path d="M12 5v14M5 12h14" />,
  x: <path d="M18 6 6 18M6 6l12 12" />,
  play: <path d="M8 5.5v13l11-6.5z" fill="currentColor" stroke="none" />,
  clock: <><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></>,
  users: <><circle cx="9" cy="8" r="3.5" /><path d="M2.5 20a6.5 6.5 0 0 1 13 0" /><path d="M16 4.5a3.5 3.5 0 0 1 0 7M21.5 20a6.5 6.5 0 0 0-4-6" /></>,
  external: <><path d="M14 4h6v6" /><path d="M20 4 10 14" /><path d="M19 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1h5" /></>,
  check: <path d="m5 12.5 4.5 4.5L19 7.5" />,
  star: <path d="m12 3.5 2.6 5.3 5.9.9-4.3 4.1 1 5.8-5.2-2.7-5.2 2.7 1-5.8-4.3-4.1 5.9-.9z" />,
  alert: <><circle cx="12" cy="12" r="9" /><path d="M12 7.5v5.5M12 16.5v.01" /></>,
  sun: <><circle cx="12" cy="12" r="4" /><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" /></>,
  moon: <path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5z" />,
  monitor: <><rect x="3" y="4" width="18" height="12" rx="2" /><path d="M8 20h8M12 16v4" /></>,
  book: <><path d="M4 5a2 2 0 0 1 2-2h13v16H6a2 2 0 0 0-2 2z" /><path d="M4 21V5M19 19v2H6" /></>,
  grid: <><rect x="3.5" y="3.5" width="7" height="7" rx="1.5" /><rect x="13.5" y="3.5" width="7" height="7" rx="1.5" /><rect x="3.5" y="13.5" width="7" height="7" rx="1.5" /><rect x="13.5" y="13.5" width="7" height="7" rx="1.5" /></>,
  fridge: <><rect x="5" y="2.5" width="14" height="19" rx="2" /><path d="M5 10h14M8.5 6v1.5M8.5 13v3" /></>,
  link: <><path d="M10 14a4.5 4.5 0 0 0 6.4 0l3-3a4.5 4.5 0 0 0-6.4-6.4l-1 1" /><path d="M14 10a4.5 4.5 0 0 0-6.4 0l-3 3a4.5 4.5 0 0 0 6.4 6.4l1-1" /></>,
  arrowLeft: <path d="M19 12H5M11 6l-6 6 6 6" />,
  sparkle: <path d="M12 3.5 13.8 9a2 2 0 0 0 1.2 1.2l5.5 1.8-5.5 1.8a2 2 0 0 0-1.2 1.2L12 20.5 10.2 15A2 2 0 0 0 9 13.8L3.5 12 9 10.2A2 2 0 0 0 10.2 9z" />,
  trash: <><path d="M4 7h16M10 11v6M14 11v6" /><path d="M6 7l1 13h10l1-13M9 7V4h6v3" /></>,
  edit: <><path d="M4 20h4L19 9l-4-4L4 16z" /><path d="m13.5 6.5 4 4" /></>,
  chef: <><path d="M7 14.5V20h10v-5.5" /><path d="M7 14.5a4 4 0 0 1-1.5-7.5 4.5 4.5 0 0 1 8.5-2 4 4 0 0 1 4.5 6 3.5 3.5 0 0 1-1.5 3.5" /><path d="M7 17h10" /></>,
  refresh: <><path d="M20 11a8 8 0 0 0-14.5-4.5L4 8" /><path d="M4 4v4h4" /><path d="M4 13a8 8 0 0 0 14.5 4.5L20 16" /><path d="M20 20v-4h-4" /></>,
  cloud: <path d="M7 18.5h10.5a4 4 0 0 0 .6-7.95A6 6 0 0 0 6.5 9.6 4.5 4.5 0 0 0 7 18.5z" />,
  cloudCheck: <><path d="M7 18.5h10.5a4 4 0 0 0 .6-7.95A6 6 0 0 0 6.5 9.6 4.5 4.5 0 0 0 7 18.5z" /><path d="m9.5 13.5 2 2 3.5-3.5" /></>,
  logout: <><path d="M15 4h3a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-3" /><path d="M10 16l-4-4 4-4M6 12h10" /></>,
  pin: <><path d="M9 4h6l-1 6 3.5 3.5V15h-11v-1.5L10 10z" /><path d="M12 15v5.5" /></>,
  note: <><path d="M6 3h9l4 4v14H6z" /><path d="M14.5 3v4.5H19M9 12h7M9 16h5" /></>,
} as const;

export type IconName = keyof typeof paths;

interface IconProps extends Omit<SVGProps<SVGSVGElement>, 'name'> {
  name: IconName;
  size?: number;
  /** 지정하면 스크린리더에 읽히고, 없으면 장식용으로 숨긴다 */
  label?: string;
}

export function Icon({ name, size = 20, label, ...rest }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden={label ? undefined : true}
      role={label ? 'img' : undefined}
      aria-label={label}
      focusable="false"
      {...rest}
    >
      {paths[name]}
    </svg>
  );
}
