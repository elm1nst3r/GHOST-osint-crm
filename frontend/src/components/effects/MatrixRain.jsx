// File: frontend/src/components/effects/MatrixRain.jsx
//
// Falling green glyphs behind the sign-in screen in the Matrix theme. Purely
// decorative: hidden from assistive tech, ignores the pointer, draws nothing
// when the system asks for reduced motion, and stops with the tab (the browser
// pauses animation frames in background tabs).
import { useEffect, useRef } from 'react';

const GLYPHS = 'アイウエオカキクケコサシスセソタチツテトナニヌネノハヒフヘホマミムメモヤユヨラリルレロワン0123456789GHOST';
const SIZE = 16;

const MatrixRain = () => {
  const canvas = useRef(null);

  useEffect(() => {
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return undefined;
    const el = canvas.current;
    const ctx = el.getContext('2d');
    let drops = [];
    const resize = () => {
      el.width = window.innerWidth;
      el.height = window.innerHeight;
      drops = Array.from({ length: Math.ceil(el.width / SIZE) }, () => Math.random() * -50);
    };
    resize();
    window.addEventListener('resize', resize);

    let frame; let last = 0;
    const draw = (time) => {
      frame = requestAnimationFrame(draw);
      if (time - last < 50) return; // ~20 fps is plenty for rain
      last = time;
      ctx.fillStyle = 'rgb(0 0 0 / 0.08)';
      ctx.fillRect(0, 0, el.width, el.height);
      ctx.font = `${SIZE}px monospace`;
      drops.forEach((y, i) => {
        ctx.fillStyle = Math.random() > 0.975 ? '#c8ffd5' : '#00ff41';
        ctx.fillText(GLYPHS[Math.floor(Math.random() * GLYPHS.length)], i * SIZE, y * SIZE);
        drops[i] = y * SIZE > el.height && Math.random() > 0.975 ? 0 : y + 1;
      });
    };
    frame = requestAnimationFrame(draw);
    return () => { cancelAnimationFrame(frame); window.removeEventListener('resize', resize); };
  }, []);

  return <canvas ref={canvas} aria-hidden="true" className="fixed inset-0 pointer-events-none opacity-30" />;
};

export default MatrixRain;
