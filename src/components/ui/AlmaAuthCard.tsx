/**
 * Alma Links themed auth card: split layout with animated dot map (left)
 * and form panel (right). Used for sign-in and sign-up pages.
 * Uses Alma brand colors (--brand-blue-dark, --brand-blue-light) and Tailwind brand.*
 */
import React, { useRef, useEffect, useState } from 'react';
import { motion } from 'framer-motion';

const BRAND_DARK = '#0B2B6B';
const BRAND_LIGHT = '#2E7FEF';

type RoutePoint = { x: number; y: number; delay: number };

const DotMap: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });

  const routes: { start: RoutePoint; end: RoutePoint; color: string }[] = [
    { start: { x: 100, y: 150, delay: 0 }, end: { x: 200, y: 80, delay: 2 }, color: BRAND_DARK },
    { start: { x: 200, y: 80, delay: 2 }, end: { x: 260, y: 120, delay: 4 }, color: BRAND_DARK },
    { start: { x: 50, y: 50, delay: 1 }, end: { x: 150, y: 180, delay: 3 }, color: BRAND_DARK },
    { start: { x: 280, y: 60, delay: 0.5 }, end: { x: 180, y: 180, delay: 2.5 }, color: BRAND_DARK },
  ];

  const generateDots = (width: number, height: number) => {
    const dots: { x: number; y: number; radius: number; opacity: number }[] = [];
    const gap = 12;
    const dotRadius = 1;
    for (let x = 0; x < width; x += gap) {
      for (let y = 0; y < height; y += gap) {
        const isInMapShape =
          ((x < width * 0.25 && x > width * 0.05) && (y < height * 0.4 && y > height * 0.1)) ||
          ((x < width * 0.25 && x > width * 0.15) && (y < height * 0.8 && y > height * 0.4)) ||
          ((x < width * 0.45 && x > width * 0.3) && (y < height * 0.35 && y > height * 0.15)) ||
          ((x < width * 0.5 && x > width * 0.35) && (y < height * 0.65 && y > height * 0.35)) ||
          ((x < width * 0.7 && x > width * 0.45) && (y < height * 0.5 && y > height * 0.1)) ||
          ((x < width * 0.8 && x > width * 0.65) && (y < height * 0.8 && y > height * 0.6));
        if (isInMapShape && Math.random() > 0.3) {
          dots.push({ x, y, radius: dotRadius, opacity: Math.random() * 0.5 + 0.2 });
        }
      }
    }
    return dots;
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas?.parentElement) return;
    const resizeObserver = new ResizeObserver(entries => {
      const { width, height } = entries[0].contentRect;
      setDimensions({ width, height });
      canvas.width = width;
      canvas.height = height;
    });
    resizeObserver.observe(canvas.parentElement);
    return () => resizeObserver.disconnect();
  }, []);

  useEffect(() => {
    if (!dimensions.width || !dimensions.height) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dots = generateDots(dimensions.width, dimensions.height);
    let animationFrameId: number;
    let startTime = Date.now();

    function drawDots() {
      ctx.clearRect(0, 0, dimensions.width, dimensions.height);
      dots.forEach(dot => {
        ctx.beginPath();
        ctx.arc(dot.x, dot.y, dot.radius, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(11, 43, 107, ${dot.opacity})`;
        ctx.fill();
      });
    }

    function drawRoutes() {
      const currentTime = (Date.now() - startTime) / 1000;
      routes.forEach(route => {
        const elapsed = currentTime - route.start.delay;
        if (elapsed <= 0) return;
        const duration = 3;
        const progress = Math.min(elapsed / duration, 1);
        const x = route.start.x + (route.end.x - route.start.x) * progress;
        const y = route.start.y + (route.end.y - route.start.y) * progress;
        ctx.beginPath();
        ctx.moveTo(route.start.x, route.start.y);
        ctx.lineTo(x, y);
        ctx.strokeStyle = route.color;
        ctx.lineWidth = 1.5;
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(route.start.x, route.start.y, 3, 0, Math.PI * 2);
        ctx.fillStyle = route.color;
        ctx.fill();
        ctx.beginPath();
        ctx.arc(x, y, 3, 0, Math.PI * 2);
        ctx.fillStyle = BRAND_LIGHT;
        ctx.fill();
        ctx.beginPath();
        ctx.arc(x, y, 6, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(46, 127, 239, 0.4)';
        ctx.fill();
        if (progress === 1) {
          ctx.beginPath();
          ctx.arc(route.end.x, route.end.y, 3, 0, Math.PI * 2);
          ctx.fillStyle = route.color;
          ctx.fill();
        }
      });
    }

    function animate() {
      drawDots();
      drawRoutes();
      const currentTime = (Date.now() - startTime) / 1000;
      if (currentTime > 15) startTime = Date.now();
      animationFrameId = requestAnimationFrame(animate);
    }
    animate();
    return () => cancelAnimationFrame(animationFrameId);
  }, [dimensions]);

  return (
    <div className="relative w-full h-full overflow-hidden">
      <canvas ref={canvasRef} className="absolute inset-0 w-full h-full" />
    </div>
  );
};

export interface AlmaAuthCardProps {
  /** Title on the left panel (e.g. "Alma Links") */
  title?: string;
  /** Subtitle on the left panel */
  subtitle?: string;
  /** Right panel content (form) */
  children: React.ReactNode;
  /** Optional logo URL - defaults to Alma Links logo path */
  logoUrl?: string;
}

/**
 * Alma Links themed auth card layout: left = DotMap + branding, right = form.
 */
const AlmaAuthCard: React.FC<AlmaAuthCardProps> = ({
  title = 'Alma Links',
  subtitle = 'Sign in to connect with members, discover events, and join conversations worldwide.',
  children,
  logoUrl,
}) => {
  return (
    <div className="flex w-full h-full min-h-[500px] md:min-h-[600px] items-center justify-center">
      <motion.div
        initial={{ opacity: 0, scale: 0.98 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.4 }}
        className="w-full max-w-4xl overflow-hidden rounded-2xl flex flex-col md:flex-row bg-white shadow-xl border border-gray-100"
      >
        {/* Left - Map + Alma branding (generous top padding so logo isn't cut) */}
        <div className="hidden md:flex md:w-1/2 md:min-h-[560px] relative overflow-hidden border-r border-gray-100 bg-gradient-to-br from-[#DCE8F6] to-[#eef4fc]">
          <DotMap />
          <div className="absolute inset-0 flex flex-col items-center justify-center pt-16 pb-16 px-10 z-10">
            <motion.div
              initial={{ opacity: 0, y: -12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3, duration: 0.4 }}
              className="mb-6"
            >
              {logoUrl ? (
                <img src={logoUrl} alt={title} className="h-11 w-auto object-contain object-center" />
              ) : (
                <div
                  className="h-14 w-14 rounded-xl flex items-center justify-center shadow-lg"
                  style={{ background: `linear-gradient(135deg, ${BRAND_DARK} 0%, ${BRAND_LIGHT} 100%)` }}
                >
                  <span className="text-white font-bold text-lg">A</span>
                </div>
              )}
            </motion.div>
            <motion.h2
              initial={{ opacity: 0, y: -12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4, duration: 0.4 }}
              className="text-2xl md:text-3xl font-bold mb-2 text-center text-[var(--brand-blue-dark)]"
            >
              {title}
            </motion.h2>
            <motion.p
              initial={{ opacity: 0, y: -12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.5, duration: 0.4 }}
              className="text-sm text-center text-gray-600 max-w-xs"
            >
              {subtitle}
            </motion.p>
          </div>
        </div>

        {/* Right - Form (no inner scroll; page scrolls if needed) */}
        <div className="w-full md:w-1/2 p-6 sm:p-8 md:p-10 flex flex-col bg-white min-h-[420px]">
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
            className="w-full max-w-sm mx-auto md:mx-0 flex flex-col justify-center"
          >
            {children}
          </motion.div>
        </div>
      </motion.div>
    </div>
  );
};

export default AlmaAuthCard;
