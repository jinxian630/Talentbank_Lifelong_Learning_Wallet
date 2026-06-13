"use client";

import { motion } from "framer-motion";
import MascotImage from "@/components/ui/MascotImage";

const STEPS = [
  {
    number: "01",
    title: "Sign Up & Create Your Wallet",
    description:
      "Register with your student email or social account. Your XP Career Wallet is created instantly — no crypto knowledge needed.",
    mascot: null,
    video: "/assets/mascot/animations/sign up acc.mp4",
    mascotLabel: "sign up acc.mp4",
    color: "var(--color-primary-orange)",
  },
  {
    number: "02",
    title: "Join Activities & Events",
    description:
      "Attend workshops, complete courses, scan QR check-ins at events. Every real-world activity feeds directly into your wallet.",
    mascot: null,
    video: "/assets/mascot/animations/join activities.mp4",
    mascotLabel: "join activities.mp4",
    color: "var(--color-primary-blue)",
  },
  {
    number: "03",
    title: "Earn XP & Collect Badges",
    description:
      "Watch your XP bar fill up and unlock achievement badges minted as Soulbound Tokens — permanent proof on the blockchain.",
    mascot: null,
    video: "/assets/mascot/animations/earn xp.mp4",
    mascotLabel: "earn xp.mp4",
    color: "var(--color-accent-gold)",
  },
  {
    number: "04",
    title: "Showcase Your Career Wallet",
    description:
      "Share your verified portfolio with employers, universities, or on LinkedIn. Your skills are provably real and tamper-proof.",
    mascot: null,
    video: "/assets/mascot/animations/carrer.mp4",
    mascotLabel: "carrer.mp4",
    color: "var(--color-success-green)",
  },
];

export default function HowItWorks() {
  return (
    <section
      id="how-it-works"
      className="section-padding"
      style={{ backgroundColor: "rgba(110,137,184,0.06)" }}
    >
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-80px" }}
          transition={{ duration: 0.6 }}
          className="text-center mb-16"
        >
          <p
            className="text-sm font-bold tracking-widest uppercase mb-3"
            style={{ color: "var(--color-primary-blue)" }}
          >
            Your Journey
          </p>
          <h2
            className="text-4xl sm:text-5xl font-extrabold mb-4"
            style={{ fontFamily: "var(--font-heading)", color: "var(--color-text-dark)" }}
          >
            How It{" "}
            <span style={{ color: "var(--color-primary-blue)" }}>Works</span>
          </h2>
          <p className="max-w-xl mx-auto text-base leading-relaxed" style={{ color: "#6b6059" }}>
            Four simple steps to go from zero to a fully-verified career portfolio.
          </p>
        </motion.div>

        {/* Steps */}
        <div className="relative flex flex-col gap-12 lg:gap-0">
          {/* Vertical connector line (desktop hidden by default, shown on lg) */}
          <div
            className="hidden lg:block absolute left-1/2 top-16 bottom-16 w-0.5 -translate-x-1/2 pointer-events-none"
            style={{
              background: "repeating-linear-gradient(to bottom, var(--color-shadow-grey) 0, var(--color-shadow-grey) 12px, transparent 12px, transparent 24px)",
            }}
          />

          {STEPS.map((step, i) => {
            const isLeft = i % 2 === 0;
            return (
              <motion.div
                key={step.number}
                initial={{ opacity: 0, x: isLeft ? -40 : 40 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true, margin: "-60px" }}
                transition={{ duration: 0.6, delay: i * 0.1, ease: "easeOut" }}
                className={`relative flex flex-col lg:flex-row items-center gap-8 ${
                  isLeft ? "lg:flex-row" : "lg:flex-row-reverse"
                }`}
              >
                {/* Text side */}
                <div className="flex-1 lg:max-w-md">
                  <div className="flex items-start gap-4">
                    <div
                      className="flex-shrink-0 w-12 h-12 rounded-2xl flex items-center justify-center text-white font-extrabold text-sm"
                      style={{ backgroundColor: step.color }}
                    >
                      {step.number}
                    </div>
                    <div>
                      <h3
                        className="text-xl font-bold mb-2"
                        style={{ fontFamily: "var(--font-heading)", color: "var(--color-text-dark)" }}
                      >
                        {step.title}
                      </h3>
                      <p className="text-sm leading-relaxed" style={{ color: "#6b6059" }}>
                        {step.description}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Center dot (desktop) */}
                <div
                  className="hidden lg:flex w-10 h-10 rounded-full border-4 items-center justify-center flex-shrink-0 z-10"
                  style={{
                    borderColor: step.color,
                    backgroundColor: "var(--color-bg-cream)",
                  }}
                >
                  <div className="w-3 h-3 rounded-full" style={{ backgroundColor: step.color }} />
                </div>

                {/* Mascot side */}
                <div className="flex-1 flex justify-center">
                  {"video" in step && step.video ? (
                    <video
                      src={step.video}
                      autoPlay
                      loop
                      muted
                      playsInline
                      className="w-full max-w-[320px] rounded-2xl drop-shadow-lg"
                    />
                  ) : (
                    <motion.div
                      animate={{ y: [0, -8, 0] }}
                      transition={{ duration: 3 + i * 0.5, repeat: Infinity, ease: "easeInOut" }}
                    >
                      <MascotImage
                        src={step.mascot ?? ""}
                        alt={`Step ${step.number} mascot`}
                        width={200}
                        height={200}
                        className="drop-shadow-lg"
                        placeholderLabel={step.mascotLabel}
                      />
                    </motion.div>
                  )}
                </div>
              </motion.div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
