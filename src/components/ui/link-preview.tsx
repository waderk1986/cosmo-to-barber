"use client";

import * as React from "react";
import * as HoverCardPrimitive from "@radix-ui/react-hover-card";
import { motion, useMotionValue, useSpring, AnimatePresence } from "framer-motion";
import { encode } from "qss";

const springConfig = { stiffness: 260, damping: 20, mass: 0.8 };

export function HoverPeek({
  label,
  url,
  className,
  width = 256,
  height = 176,
  quality = 50,
  layout = "fixed",
}: {
  label: string;
  url: string;
  className?: string;
  width?: number;
  height?: number;
  quality?: number;
  layout?: string;
}) {
  const [isOpen, setIsOpen] = React.useState(false);
  const [isMounted, setIsMounted] = React.useState(false);

  React.useEffect(() => {
    setIsMounted(true);
  }, []);

  const springX = useSpring(useMotionValue(0), springConfig);
  const springY = useSpring(useMotionValue(0), springConfig);

  const handleMouseMove = (event: React.MouseEvent) => {
    const target = event.currentTarget as HTMLElement;
    const rect = target.getBoundingClientRect();
    const halfW = rect.width / 2;
    springX.set(event.clientX - rect.left - halfW);
    springY.set(event.clientY - rect.top - rect.height);
  };

  const params = encode({
    url,
    screenshot: true,
    meta: false,
    embed: "screenshot.url",
    colorScheme: "light",
    "viewport.isMobile": true,
    "viewport.deviceScaleFactor": 1,
    "viewport.width": width * 3,
    "viewport.height": height * 3,
  });
  const src = `https://api.microlink.io/?${params}`;

  if (!isMounted) {
    return <a href={url} target="_blank" rel="noopener noreferrer" className={className}>{label}</a>;
  }

  return (
    <HoverCardPrimitive.Root
      openDelay={75}
      closeDelay={100}
      onOpenChange={(open) => setIsOpen(open)}
    >
      <HoverCardPrimitive.Trigger
        onMouseMove={handleMouseMove}
        className={className}
      >
        <a href={url} target="_blank" rel="noopener noreferrer" className={className}>{label}</a>
      </HoverCardPrimitive.Trigger>

      <AnimatePresence>
        {isOpen && (
          <HoverCardPrimitive.Content
            side="top"
            align="center"
            sideOffset={12}
            forceMount
            asChild
          >
            <motion.div
              initial={{ opacity: 0, y: 8, scale: 0.96 }}
              animate={{
                opacity: 1,
                y: 0,
                scale: 1,
                transition: { type: "spring", ...springConfig },
              }}
              exit={{ opacity: 0, y: 8, scale: 0.96 }}
              style={{
                x: springX,
                y: springY,
              }}
            >
              <a
                href={url}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  display: "block",
                  borderRadius: "0.75rem",
                  border: "1.5px solid rgba(0,128,128,0.15)",
                  boxShadow:
                    "0 12px 40px rgba(0,0,0,0.12), 0 0 0 1px rgba(0,0,0,0.04)",
                  overflow: "hidden",
                  background: "#fff",
                }}
              >
                <img
                  src={src}
                  width={width}
                  height={height}
                  alt={`Preview of ${url}`}
                  loading="lazy"
                  decoding="async"
                  style={{
                    display: "block",
                    width: `${width}px`,
                    height: `${height}px`,
                    objectFit: "cover",
                  }}
                />
              </a>
            </motion.div>
          </HoverCardPrimitive.Content>
        )}
      </AnimatePresence>
    </HoverCardPrimitive.Root>
  );
}
