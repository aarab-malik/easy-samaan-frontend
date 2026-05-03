"use client";

import { motion } from "motion/react";
import { ReactNode } from "react";

type SimpleProps = {
  children: ReactNode;
  className?: string;
};

type FadeUpProps = SimpleProps & {
  delay?: number;
};

export function FadeUp({ children, className, delay = 0 }: FadeUpProps) {
  return (
    <motion.div
      className={className}
      initial={{ opacity: 0, y: 24 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.2 }}
      transition={{ duration: 0.6, ease: "easeOut", delay }}
    >
      {children}
    </motion.div>
  );
}

type StaggerProps = SimpleProps & {
  stagger?: number;
};

export function Stagger({ children, className, stagger = 0.12 }: StaggerProps) {
  return (
    <motion.div
      className={className}
      initial="hidden"
      whileInView="show"
      viewport={{ once: true, amount: 0.2 }}
      variants={{
        hidden: {},
        show: {
          transition: {
            staggerChildren: stagger,
          },
        },
      }}
    >
      {children}
    </motion.div>
  );
}

export function StaggerItem({ children, className }: SimpleProps) {
  return (
    <motion.div
      className={className}
      initial={false}
      variants={{
        hidden: { opacity: 0, y: 20 },
        show: { opacity: 1, y: 0 },
      }}
      transition={{ duration: 0.45, ease: "easeOut" }}
    >
      {children}
    </motion.div>
  );
}

export function HoverLift({ children, className }: SimpleProps) {
  return (
    <motion.div
      className={className}
      whileHover={{ y: -6, scale: 1.015 }}
      whileTap={{ scale: 0.985 }}
      transition={{ type: "spring", stiffness: 300, damping: 20 }}
    >
      {children}
    </motion.div>
  );
}
