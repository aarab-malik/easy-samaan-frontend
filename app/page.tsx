'use client';

import Link from 'next/link';
import Image from 'next/image';
import { useAuth } from './lib/auth-context';
import { FadeUp, HoverLift, Stagger, StaggerItem } from './components/MotionPrimitives';
import { motion } from 'motion/react';
import { HiArrowLongDown } from 'react-icons/hi2';

export default function Home() {
  const { user, isAuthenticated } = useAuth();
  const categories = ['Groceries', 'Electronics', 'Fashion', 'Home', 'Beauty', 'Sports', 'Books', 'Toys'];

  return (
    <div className="min-h-screen bg-[#fff9f3] flex flex-col">
      {/* Hero Section */}
      <section className="relative isolate flex h-[88vh] min-h-[620px] items-center overflow-hidden px-8">
        <div className="absolute inset-0 -z-30 bg-[length:280%_280%] bg-[linear-gradient(120deg,#FFE2BE,#FFD6AA,#FFB870,#FFE8CC)] animate-[gradient-shift_11s_ease_infinite]" />
        <video
          autoPlay
          muted
          loop
          playsInline
          poster="/hero-poster.jpg"
          className="absolute inset-0 -z-20 h-full w-full object-cover"
        >
          <source src="/hero.mp4" type="video/mp4" />
        </video>
        <div className="absolute inset-0 -z-10 bg-gradient-to-br from-black/65 via-black/40 to-[#c25a00]/45" />
        <div className="pointer-events-none absolute -left-24 top-16 h-64 w-64 rounded-full bg-white/15 blur-3xl" />
        <div className="pointer-events-none absolute bottom-8 right-16 h-56 w-56 rounded-full bg-[#FFB870]/25 blur-3xl" />
        <motion.div className="pointer-events-none absolute left-[8%] top-[22%] hidden rounded-2xl border border-white/30 bg-white/15 p-4 text-white shadow-xl backdrop-blur-md lg:block" animate={{ y: [0, -9, 0] }} transition={{ repeat: Infinity, duration: 3.4 }}>
          <p className="text-xs uppercase tracking-[0.25em] text-white/70">Top Seller</p>
          <p className="mt-1 text-lg font-bold">Fresh Basket Deals</p>
        </motion.div>
        <motion.div className="pointer-events-none absolute bottom-[20%] right-[7%] hidden rounded-2xl border border-white/30 bg-black/25 p-4 text-white shadow-xl backdrop-blur-sm xl:block" animate={{ y: [0, -10, 0] }} transition={{ repeat: Infinity, duration: 3.8, delay: 0.4 }}>
          <p className="text-xs uppercase tracking-[0.2em] text-orange-200">Fast Delivery</p>
          <p className="mt-1 text-lg font-bold">Arrives in 30 mins</p>
        </motion.div>

        <div className="mx-auto w-full max-w-6xl text-center text-white">
          <Stagger className="space-y-6">
            <StaggerItem>
              <h1 className="text-5xl font-black leading-tight md:text-7xl">EasySamaan</h1>
            </StaggerItem>
            <StaggerItem>
              <p className="mx-auto max-w-2xl text-lg text-white/85 md:text-2xl">
                Har Cheez, Aik Jagah - discover shops, compare prices, and get everything delivered quickly.
              </p>
            </StaggerItem>
            <StaggerItem>
              <div className="flex flex-wrap items-center justify-center gap-4">
                <Link
                  href="/shop"
                  className="rounded-full bg-[#FF8D28] px-8 py-3 text-base font-bold text-[#1E1E1E] shadow-xl transition-all duration-300 hover:-translate-y-0.5 hover:scale-[1.02] hover:bg-[#ff9f49]"
                >
                  Shop Now
                </Link>
                <Link
                  href={isAuthenticated ? (user?.role === 'shop_owner' ? '/shop-owner' : '/signup?role=shop_owner') : '/signup?role=shop_owner'}
                  className="rounded-full border border-white/60 bg-white/10 px-8 py-3 text-base font-semibold text-white backdrop-blur-md transition-all duration-300 hover:-translate-y-0.5 hover:scale-[1.02] hover:bg-white/20"
                >
                  Become a Seller
                </Link>
                {!isAuthenticated && (
                  <Link
                    href="/signup"
                    className="rounded-full border border-white/45 bg-black/30 px-8 py-3 text-base font-semibold text-white transition-all duration-300 hover:-translate-y-0.5 hover:scale-[1.02] hover:bg-black/45"
                  >
                    Sign Up
                  </Link>
                )}
              </div>
            </StaggerItem>
          </Stagger>
        </div>
        <motion.div className="absolute bottom-10 left-1/2 -translate-x-1/2 text-white/80" animate={{ y: [0, 7, 0] }} transition={{ repeat: Infinity, duration: 1.6 }}>
          <HiArrowLongDown className="text-4xl" />
        </motion.div>
      </section>

      <section className="overflow-hidden border-y border-[#f1d8be] bg-white py-4">
        <div className="animate-[marquee_24s_linear_infinite] whitespace-nowrap">
          {[...categories, ...categories].map((category, index) => (
            <span key={`${category}-${index}`} className="mx-2 inline-flex items-center rounded-full border border-[#ffd2a5] bg-[#fff4e5] px-5 py-2 text-sm font-semibold text-[#c25a00]">
              {category}
            </span>
          ))}
        </div>
      </section>

      {/* Promo Banner */}
      <FadeUp>
        <section className="mx-8 my-10 rounded-3xl bg-[#FF8D28] px-8 py-12 shadow-[0_24px_60px_rgba(255,141,40,0.24)]">
          <div className="mx-auto grid max-w-6xl grid-cols-1 items-center gap-8 md:grid-cols-3">
            <div className="text-white">
              <div className="mb-4 w-fit rounded-full bg-white px-4 py-2 text-lg font-bold text-[#FF8D28]">
                SPECIAL OFFERS
              </div>
              <h3 className="mb-2 text-4xl font-bold">Shop With Us</h3>
              <p className="mb-6 text-xl font-bold text-yellow-300">Best Prices Available</p>
              <Link
                href="/shop"
                className="inline-block rounded-full bg-yellow-300 px-6 py-2 font-bold text-black transition-colors hover:bg-yellow-400"
              >
                Browse Products
              </Link>
            </div>

            <div className="relative h-64 overflow-hidden rounded-2xl border border-white/25 bg-[#2C2C2C]/80">
              <Image
                src="/front_page_aesthetic.jpg"
                alt="Featured products"
                fill
                sizes="(max-width: 768px) 100vw, 33vw"
                className="object-cover"
              />
              <div className="absolute inset-0 bg-black/20" />
              <span className="absolute bottom-3 left-3 rounded-full bg-black/55 px-3 py-1 text-xs font-bold text-white">
                Featured Products
              </span>
            </div>

            <div className="space-y-4">
              {['Easy Checkout', 'Fast Delivery', 'Best Prices'].map((value) => (
                <motion.div
                  key={value}
                  whileHover={{ y: -4, scale: 1.01 }}
                  className="rounded-xl bg-white p-4 text-center shadow-md transition-all"
                >
                  <p className="font-bold text-[#1E1E1E]">{value}</p>
                </motion.div>
              ))}
            </div>
          </div>
        </section>
      </FadeUp>

      {/* Features Section */}
      <section className="px-8 py-16">
        <div className="mx-auto max-w-6xl">
          <FadeUp>
            <h2 className="mb-12 text-center text-3xl font-bold text-[#1E1E1E]">How It Works</h2>
          </FadeUp>
          <Stagger className="grid grid-cols-1 gap-8 md:grid-cols-3">
            {[
              { icon: '🛒', title: 'Browse', text: 'Explore products from multiple shops in your area' },
              { icon: '💳', title: 'Order', text: 'Add items to cart and proceed to checkout' },
              { icon: '🚚', title: 'Deliver', text: 'Receive your order at your doorstep quickly' },
            ].map((item) => (
              <StaggerItem key={item.title}>
                <HoverLift className="rounded-2xl border border-[#f4d3b0] bg-white p-7 text-center shadow-sm">
                  <div className="mx-auto mb-4 flex h-24 w-24 animate-[float_4s_ease-in-out_infinite] items-center justify-center rounded-full bg-[#F5F5F5]">
                    <span className="text-4xl">{item.icon}</span>
                  </div>
                  <h3 className="mb-2 text-xl font-bold text-[#1E1E1E]">{item.title}</h3>
                  <p className="text-[#757575]">{item.text}</p>
                </HoverLift>
              </StaggerItem>
            ))}
          </Stagger>
        </div>
      </section>

      {/* User Roles Section */}
      <section className="bg-[#F5F5F5] py-16 px-8">
        <div className="max-w-6xl mx-auto">
          <FadeUp>
            <h2 className="text-3xl font-bold text-[#1E1E1E] mb-12 text-center">Join Our Community</h2>
          </FadeUp>
          <Stagger className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {[
              {
                icon: '🛍️',
                title: 'Customer',
                text: 'Shop from multiple vendors and get fast delivery to your doorstep',
                href: isAuthenticated ? '/shop' : '/signup?role=customer',
                cta: isAuthenticated ? 'Start Shopping' : 'Sign Up as Customer',
                buttonClass: 'bg-[#FF8D28] text-black hover:bg-orange-600',
              },
              {
                icon: '🏪',
                title: 'Shop Owner',
                text: 'Create a shop, add products, and reach more customers easily',
                href: isAuthenticated && user?.role === 'shop_owner' ? '/shop-owner' : '/signup?role=shop_owner',
                cta: isAuthenticated && user?.role === 'shop_owner' ? 'Manage Shop' : 'Sign Up as Shop Owner',
                buttonClass: 'bg-[#2C2C2C] text-white hover:bg-black',
              },
              {
                icon: '🏍️',
                title: 'Rider',
                text: 'Earn money by delivering orders to customers in your area',
                href: isAuthenticated && user?.role === 'rider' ? '/rider' : '/signup?role=rider',
                cta: isAuthenticated && user?.role === 'rider' ? 'View Deliveries' : 'Sign Up as Rider',
                buttonClass: 'bg-[#757575] text-white hover:bg-[#1E1E1E]',
              },
            ].map((role) => (
              <StaggerItem key={role.title}>
                <HoverLift className="h-full">
                  <div className="h-full rounded-2xl border-2 border-[#D9D9D9] bg-white p-8 text-center transition-all duration-300 hover:border-[#FFB870] hover:shadow-[0_20px_45px_rgba(255,141,40,0.16)]">
                    <span className="text-5xl mb-4 block">{role.icon}</span>
                    <h3 className="text-2xl font-bold text-[#1E1E1E] mb-3">{role.title}</h3>
                    <p className="text-[#757575] mb-6">{role.text}</p>
                    <Link href={role.href} className={`inline-block rounded-xl px-6 py-2 font-bold transition-all duration-300 ${role.buttonClass}`}>
                      {role.cta}
                    </Link>
                  </div>
                </HoverLift>
              </StaggerItem>
            ))}
          </Stagger>
        </div>
      </section>

      {/* Reviews Section */}
      <section className="py-16 px-8">
        <div className="max-w-6xl mx-auto">
          <FadeUp>
            <h2 className="text-3xl font-bold text-[#1E1E1E] mb-12">Latest Reviews</h2>
          </FadeUp>
          <Stagger className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {[
              {
                title: 'Fast & Reliable',
                text: 'Great service and fast delivery. Will use again!',
                author: 'Ahmed Khan',
                date: '17/02/2026'
              },
              {
                title: 'Best Prices',
                text: 'Found everything I needed at competitive prices.',
                author: 'Fatima Ali',
                date: '16/02/2026'
              },
              {
                title: 'Highly Recommended',
                text: 'Easy to use app and excellent customer service.',
                author: 'Hassan Rauf',
                date: '15/02/2026'
              }
            ].map((review) => (
              <StaggerItem key={review.title}>
                <HoverLift>
                  <div className="rounded-2xl border border-[#f0cfac] bg-white p-6 shadow-sm transition-all duration-300 hover:shadow-[0_18px_45px_rgba(255,141,40,0.17)]">
                    <div className="mb-4 flex gap-1">
                      {[...Array(5)].map((_, i) => (
                        <span key={i} className="text-lg">⭐</span>
                      ))}
                    </div>
                    <h3 className="text-lg font-bold text-[#1E1E1E] mb-2">{review.title}</h3>
                    <p className="text-[#757575] mb-4">{review.text}</p>
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 rounded-full bg-[#D9D9D9]" />
                      <div>
                        <p className="text-sm font-bold text-[#1E1E1E]">{review.author}</p>
                        <p className="text-xs text-[#757575]">{review.date}</p>
                      </div>
                    </div>
                  </div>
                </HoverLift>
              </StaggerItem>
            ))}
          </Stagger>
        </div>
      </section>

    </div>
  );
}
