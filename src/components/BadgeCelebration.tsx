import React, { useEffect, useState } from 'react';
import { EmojiImage } from './Avatar';

export function BadgeCelebration() {
  const [show, setShow] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => setShow(false), 3000);
    return () => clearTimeout(timer);
  }, []);

  if (!show) return null;

  return (
    <div className="fixed inset-0 pointer-events-none z-50 flex items-center justify-center overflow-hidden">
      <div className="absolute w-1 h-1">
        {[...Array(12)].map((_, i) => (
          <div
            key={i}
            className="absolute animate-explode"
            style={{
              '--tx': `${Math.cos(i * 30 * Math.PI / 180) * 150}px`,
              '--ty': `${Math.sin(i * 30 * Math.PI / 180) * 150}px`,
              animationDelay: `${i * 0.05}s`,
            } as React.CSSProperties}
          >
            <EmojiImage emoji={['🎉', '✨', '🎢', '🚀', '🌟'][i % 5]} className="w-6 h-6 object-contain" />
          </div>
        ))}
      </div>
      <style>{`
        @keyframes explode {
          0% { transform: scale(0) translate(0, 0); opacity: 1; }
          100% { transform: scale(1.5) translate(var(--tx, 100px), var(--ty, -100px)); opacity: 0; }
        }
        .animate-explode {
          animation: explode 1s ease-out forwards;
        }
      `}</style>
    </div>
  );
}
