import { useMemo } from 'react';
import { useApp } from '../state/AppContext';

/** Camada de partículas flutuantes e neve opcional. Leve e puramente decorativa. */
export default function Effects() {
  const { prefs } = useApp();

  const count = prefs.intensity === 'high' ? 42 : prefs.intensity === 'low' ? 12 : 24;

  const particles = useMemo(
    () =>
      Array.from({ length: count }).map((_, i) => ({
        id: i,
        left: Math.random() * 100,
        top: Math.random() * 100,
        size: 1 + Math.random() * 2.4,
        delay: Math.random() * -14,
        duration: 11 + Math.random() * 12,
        dx: `${(Math.random() - 0.5) * 90}px`,
        dy: `${-30 - Math.random() * 90}px`,
      })),
    [count],
  );

  const flakes = useMemo(
    () =>
      Array.from({ length: prefs.intensity === 'high' ? 60 : prefs.intensity === 'low' ? 20 : 38 }).map((_, i) => ({
        id: i,
        left: Math.random() * 100,
        size: 1.4 + Math.random() * 3.2,
        delay: Math.random() * -18,
        duration: 9 + Math.random() * 14,
        drift: `${(Math.random() - 0.5) * 160}px`,
        opacity: 0.25 + Math.random() * 0.5,
      })),
    [prefs.intensity],
  );

  if (!prefs.particles && !prefs.snow) return null;

  return (
    <div className="fx-layer" aria-hidden="true">
      {prefs.particles
        ? particles.map((p) => (
            <span
              key={`p-${p.id}`}
              className="fx-particle"
              style={{
                left: `${p.left}%`,
                top: `${p.top}%`,
                width: p.size,
                height: p.size,
                animationDelay: `${p.delay}s`,
                animationDuration: `${p.duration}s`,
                ['--dx' as string]: p.dx,
                ['--dy' as string]: p.dy,
              }}
            />
          ))
        : null}
      {prefs.snow
        ? flakes.map((f) => (
            <span
              key={`s-${f.id}`}
              className="fx-snow"
              style={{
                left: `${f.left}%`,
                width: f.size,
                height: f.size,
                opacity: f.opacity,
                animationDelay: `${f.delay}s`,
                animationDuration: `${f.duration}s`,
                ['--drift' as string]: f.drift,
              }}
            />
          ))
        : null}
    </div>
  );
}
