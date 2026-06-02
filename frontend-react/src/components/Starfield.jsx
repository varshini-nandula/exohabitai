import { useEffect, useRef } from 'react';

export default function Starfield({ speed = 0.05, count = 100 }) {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationFrameId;
    let width = (canvas.width = window.innerWidth);
    let height = (canvas.height = window.innerHeight);

    // Star data structure
    const stars = Array.from({ length: count }, () => ({
      x: Math.random() * width,
      y: Math.random() * height,
      size: Math.random() * 1.5 + 0.5,
      alpha: Math.random(),
      alphaSpeed: Math.random() * 0.02 + 0.005,
      direction: Math.random() > 0.5 ? 1 : -1,
      color: Math.random() > 0.8 ? '#99F6E4' : '#E2E8F0', // some teal, some white/slate
    }));

    const resizeHandler = () => {
      if (!canvas) return;
      width = canvas.width = window.innerWidth;
      height = canvas.height = window.innerHeight;
    };

    window.addEventListener('resize', resizeHandler);

    const render = () => {
      ctx.clearRect(0, 0, width, height);

      // Dark space background gradient
      const grad = ctx.createLinearGradient(0, 0, 0, height);
      grad.addColorStop(0, '#050816');
      grad.addColorStop(1, '#0B1026');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, width, height);

      // Draw and update stars
      stars.forEach((star) => {
        // Draw star with glow
        ctx.fillStyle = star.color;
        ctx.globalAlpha = star.alpha;
        ctx.beginPath();
        ctx.arc(star.x, star.y, star.size, 0, Math.PI * 2);
        ctx.fill();

        // Update alpha (twinkling)
        star.alpha += star.alphaSpeed * star.direction;
        if (star.alpha >= 1) {
          star.alpha = 1;
          star.direction = -1;
        } else if (star.alpha <= 0.1) {
          star.alpha = 0.1;
          star.direction = 1;
        }

        // Slow horizontal/vertical drift
        star.x += speed * 0.1;
        star.y += speed * 0.05;

        // Wrap around boundaries
        if (star.x > width) star.x = 0;
        if (star.y > height) star.y = 0;
      });

      ctx.globalAlpha = 1.0;
      animationFrameId = requestAnimationFrame(render);
    };

    render();

    return () => {
      window.removeEventListener('resize', resizeHandler);
      cancelAnimationFrame(animationFrameId);
    };
  }, [speed, count]);

  return (
    <canvas
      ref={canvasRef}
      className="fixed inset-0 -z-50 pointer-events-none w-full h-full block"
    />
  );
}
