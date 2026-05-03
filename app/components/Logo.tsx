"use client";

import Image from "next/image";

const BRAND_MARK = "/brand-shopping-cart-symbol.png";

type LogoProps = {
  variant?: "full" | "mark";
  size?: number;
  className?: string;
};

function BrandMark({ size, alt }: { size: number; alt: string }) {
  return (
    <Image
      src={BRAND_MARK}
      alt={alt}
      width={size}
      height={size}
      className="shrink-0 object-contain"
      priority
    />
  );
}

export default function Logo({ variant = "full", size = 34, className = "" }: LogoProps) {
  if (variant === "mark") {
    return (
      <span className={`inline-flex items-center ${className}`}>
        <BrandMark size={size} alt="EasySamaan" />
      </span>
    );
  }

  return (
    <span className={`inline-flex items-center gap-2.5 ${className}`}>
      <BrandMark size={size} alt="" />
      <span className="text-2xl font-black tracking-tight">EasySamaan</span>
    </span>
  );
}
