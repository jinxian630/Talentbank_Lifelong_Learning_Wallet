"use client";

import { motion } from "framer-motion";
import {
  Zap,
  Wallet,
  Award,
  BarChart2,
  CalendarCheck,
  Share2,
} from "lucide-react";
import FeatureCard from "@/components/ui/FeatureCard";

const FEATURES = [
  {
    icon: Zap,
    title: "XP & Skill Tracking",
    description:
      "Earn XP for every learning achievement, certification, and milestone. Watch your career level grow in real time.",
    iconColor: "var(--color-primary-orange)",
  },
  {
    icon: Wallet,
    title: "Career Wallet",
    description:
      "Store verified credentials, badges, and Soulbound Tokens securely on-chain. Your proof of skills, always accessible.",
    iconColor: "var(--color-primary-blue)",
  },
  {
    icon: Award,
    title: "Achievement Badges",
    description:
      "Visual rewards for completing courses, events, and skill levels. Each badge is minted as a blockchain NFT.",
    iconColor: "var(--color-accent-gold)",
  },
  {
    icon: BarChart2,
    title: "Progress Dashboard",
    description:
      "Track your growth over time with friendly, visual charts and skill breakdowns tailored to your journey.",
    iconColor: "var(--color-success-green)",
  },
  {
    icon: CalendarCheck,
    title: "Event & Workshop Integration",
    description:
      "Earn XP from real-world events — QR check-ins, hackathons, club activities, and more are all tracked automatically.",
    iconColor: "var(--color-primary-orange)",
  },
  {
    icon: Share2,
    title: "Verified Portfolio",
    description:
      "A shareable, blockchain-backed proof of your skills and achievements. Impress employers with an unforgeable career record.",
    iconColor: "var(--color-primary-blue)",
  },
];

const containerVariants = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.1 } },
};

const itemVariants = {
  hidden:  { opacity: 0, y: 30 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.5, ease: "easeOut" } },
};

export default function Features() {
  return (
    <section id="features" className="section-padding">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-80px" }}
          transition={{ duration: 0.6 }}
          className="text-center mb-14"
        >
          <p
            className="text-sm font-bold tracking-widest uppercase mb-3"
            style={{ color: "var(--color-primary-orange)" }}
          >
            What We Offer
          </p>
          <h2
            className="text-4xl sm:text-5xl font-extrabold mb-4"
            style={{ fontFamily: "var(--font-heading)", color: "var(--color-text-dark)" }}
          >
            Everything You Need to{" "}
            <span className="gradient-text-orange">Level Up</span>
          </h2>
          <p className="max-w-xl mx-auto text-base leading-relaxed" style={{ color: "#6b6059" }}>
            From earning your first XP to showcasing a fully verified career
            portfolio — XP Career Wallet has every tool for the modern learner.
          </p>
        </motion.div>

        {/* Feature grid */}
        <motion.div
          className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6"
          variants={containerVariants}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-60px" }}
        >
          {FEATURES.map((f) => (
            <motion.div key={f.title} variants={itemVariants}>
              <FeatureCard
                icon={f.icon}
                title={f.title}
                description={f.description}
                iconColor={f.iconColor}
              />
            </motion.div>
          ))}
        </motion.div>
      </div>
    </section>
  );
}
