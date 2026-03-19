'use client';

/**
 * Inline SVG flag icons for language picker.
 * These render consistently across all browsers/platforms
 * without depending on emoji font support.
 */

export function FlagES({ className = 'w-5 h-4' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 640 480" xmlns="http://www.w3.org/2000/svg">
      <rect width="640" height="480" fill="#c60b1e" />
      <rect width="640" height="240" y="120" fill="#ffc400" />
    </svg>
  );
}

export function FlagUS({ className = 'w-5 h-4' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 640 480" xmlns="http://www.w3.org/2000/svg">
      <rect width="640" height="480" fill="#fff" />
      {[0, 1, 2, 3, 4, 5, 6].map(i => (
        <rect key={i} width="640" height={37} y={i * 74} fill="#b22234" />
      ))}
      <rect width="256" height="259" fill="#3c3b6e" />
      {/* Simplified stars field */}
      <g fill="#fff" fontSize="14">
        {Array.from({ length: 50 }, (_, i) => {
          const row = Math.floor(i / 6);
          const col = i % 6;
          const offset = row % 2 === 0 ? 0 : 14;
          if (row > 8) return null;
          return <circle key={i} cx={22 + offset + col * 42} cy={18 + row * 28} r={6} />;
        })}
      </g>
    </svg>
  );
}

export function FlagFR({ className = 'w-5 h-4' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 640 480" xmlns="http://www.w3.org/2000/svg">
      <rect width="213" height="480" fill="#002395" />
      <rect width="213" height="480" x="213" fill="#fff" />
      <rect width="214" height="480" x="426" fill="#ed2939" />
    </svg>
  );
}

export function FlagCN({ className = 'w-5 h-4' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 640 480" xmlns="http://www.w3.org/2000/svg">
      <rect width="640" height="480" fill="#de2910" />
      <g fill="#ffde00">
        <polygon points="160,60 172,100 212,100 180,124 192,164 160,140 128,164 140,124 108,100 148,100" />
        <polygon points="264,36 269,52 286,52 272,62 277,78 264,68 251,78 256,62 242,52 259,52" />
        <polygon points="300,84 305,100 322,100 308,110 313,126 300,116 287,126 292,110 278,100 295,100" />
        <polygon points="300,156 305,172 322,172 308,182 313,198 300,188 287,198 292,182 278,172 295,172" />
        <polygon points="264,204 269,220 286,220 272,230 277,246 264,236 251,246 256,230 242,220 259,220" />
      </g>
    </svg>
  );
}

export function FlagRU({ className = 'w-5 h-4' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 640 480" xmlns="http://www.w3.org/2000/svg">
      <rect width="640" height="160" fill="#fff" />
      <rect width="640" height="160" y="160" fill="#0039a6" />
      <rect width="640" height="160" y="320" fill="#d52b1e" />
    </svg>
  );
}

/** Map of lang code → flag component. */
export const FLAG_COMPONENTS: Record<string, React.FC<{ className?: string }>> = {
  es: FlagES,
  en: FlagUS,
  fr: FlagFR,
  zh: FlagCN,
  ru: FlagRU,
};
