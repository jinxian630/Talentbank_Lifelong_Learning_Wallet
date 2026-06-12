"use client";

import { motion } from "framer-motion";
import { ArrowRight, LogIn } from "lucide-react";

const BLOBS = [
  { color: "#E8923C", size: 320, top: "5%",  left: "-10%", delay: 0 },
  { color: "#6E89B8", size: 240, top: "60%", left: "80%",  delay: 2 },
  { color: "#C9A876", size: 180, top: "80%", left: "5%",   delay: 4 },
  { color: "#8FBF8C", size: 200, top: "20%", left: "70%",  delay: 1 },
];

export default function Hero() {
  const adminUrl = process.env.NEXT_PUBLIC_ADMIN_URL ?? "http://localhost:3000";

  return (
    <section
      id="home"
      className="relative min-h-screen flex items-center overflow-hidden pt-20"
    >
      {/* Floating background blobs */}
      {BLOBS.map((blob, i) => (
        <motion.div
          key={i}
          className="absolute blob pointer-events-none"
          style={{
            width: blob.size,
            height: blob.size,
            top: blob.top,
            left: blob.left,
            backgroundColor: blob.color,
          }}
          animate={{
            x: [0, 30, -20, 0],
            y: [0, -25, 15, 0],
            scale: [1, 1.08, 0.95, 1],
          }}
          transition={{
            duration: 10 + blob.delay * 2,
            delay: blob.delay,
            repeat: Infinity,
            ease: "easeInOut",
          }}
        />
      ))}

      <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 w-full py-16">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
          {/* Text content */}
          <motion.div
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, ease: "easeOut" }}
            className="flex flex-col gap-6"
          >
            {/* Pill badge */}
            <motion.div
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.2, duration: 0.5 }}
              className="inline-flex items-center gap-2 w-fit rounded-full px-4 py-1.5 text-xs font-bold"
              style={{
                backgroundColor: "rgba(232,146,60,0.15)",
                color: "var(--color-primary-orange)",
              }}
            >
              <span className="animate-sparkle">⭐</span>
              Gamified Career Tracking — Now Live
            </motion.div>

            <h1
              className="text-5xl sm:text-6xl lg:text-7xl font-extrabold leading-tight"
              style={{ fontFamily: "var(--font-heading)" }}
            >
              Track Your Career{" "}
              <span className="gradient-text-orange">Like a Game</span>
            </h1>

            <p className="text-lg leading-relaxed max-w-lg" style={{ color: "#6b6059" }}>
              Earn XP, collect achievement badges, and build a{" "}
              <strong>blockchain-verified portfolio</strong> — all in one
              friendly career wallet built for ambitious learners.
            </p>

            {/* XP bar teaser */}
            <div
              className="rounded-2xl p-4 flex flex-col gap-2 max-w-sm"
              style={{ backgroundColor: "#fff", boxShadow: "0 4px 16px rgba(58,51,44,0.08)" }}
            >
              <div className="flex items-center justify-between text-xs font-bold" style={{ color: "var(--color-text-dark)" }}>
                <span>Your Career Level</span>
                <span style={{ color: "var(--color-primary-orange)" }}>Lv. 12 Explorer</span>
              </div>
              <div className="h-3 rounded-full overflow-hidden" style={{ backgroundColor: "var(--color-shadow-grey)" }}>
                <motion.div
                  className="h-full rounded-full"
                  style={{ background: "linear-gradient(90deg, var(--color-primary-orange), var(--color-accent-gold))" }}
                  initial={{ width: 0 }}
                  animate={{ width: "68%" }}
                  transition={{ delay: 1, duration: 1.5, ease: "easeOut" }}
                />
              </div>
              <p className="text-xs" style={{ color: "#9a8f87" }}>680 / 1000 XP to next level</p>
            </div>

            {/* CTA buttons */}
            <div id="hero-cta" className="flex flex-wrap gap-3">
              <motion.a
                href={process.env.NEXT_PUBLIC_EXPO_URL ?? "#"}
                target="_blank"
                rel="noopener noreferrer"
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.97 }}
                className="flex items-center gap-2 rounded-2xl px-6 py-3 text-sm font-bold text-white"
                style={{ backgroundColor: "var(--color-primary-orange)" }}
              >
                <LogIn size={16} />
                Student Login
              </motion.a>
              <motion.a
                href={adminUrl}
                target="_blank"
                rel="noopener noreferrer"
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.97 }}
                className="flex items-center gap-2 rounded-2xl px-6 py-3 text-sm font-bold border-2"
                style={{
                  borderColor: "var(--color-primary-blue)",
                  color: "var(--color-primary-blue)",
                }}
              >
                For Organizers
                <ArrowRight size={16} />
              </motion.a>
            </div>
          </motion.div>

          {/* Mascot video */}
          <motion.div
            initial={{ opacity: 0, scale: 0.85 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.8, delay: 0.3, ease: "easeOut" }}
            className="flex justify-center lg:justify-end"
          >
            <video
              src="/assets/mascot/animations/introduce xp carrer wallet.mp4"
              autoPlay
              loop
              muted
              playsInline
              className="w-full max-w-[600px] drop-shadow-2xl rounded-3xl"
            />
          </motion.div>
        </div>
      </div>
    </section>
  );
}
