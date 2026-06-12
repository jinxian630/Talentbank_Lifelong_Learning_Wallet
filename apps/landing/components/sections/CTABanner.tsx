"use client";

import { motion } from "framer-motion";
import { ArrowRight, Download } from "lucide-react";
import MascotImage from "@/components/ui/MascotImage";

export default function CTABanner() {
  const adminUrl = process.env.NEXT_PUBLIC_ADMIN_URL ?? "http://localhost:3000";

  return (
    <section className="section-padding">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div
          className="relative rounded-3xl overflow-hidden px-8 py-16 lg:py-20"
          style={{
            background:
              "linear-gradient(135deg, var(--color-primary-orange) 0%, var(--color-accent-gold) 100%)",
          }}
        >
          {/* Background blobs */}
          <div
            className="absolute top-0 right-0 w-64 h-64 rounded-full opacity-20 pointer-events-none"
            style={{ backgroundColor: "#fff", transform: "translate(30%, -30%)" }}
          />
          <div
            className="absolute bottom-0 left-0 w-48 h-48 rounded-full opacity-20 pointer-events-none"
            style={{ backgroundColor: "#fff", transform: "translate(-30%, 30%)" }}
          />

          <div className="relative flex flex-col lg:flex-row items-center gap-10 justify-between">
            {/* Text */}
            <motion.div
              initial={{ opacity: 0, x: -40 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6 }}
              className="flex flex-col gap-6 max-w-xl"
            >
              <h2
                className="text-4xl sm:text-5xl font-extrabold text-white leading-tight"
                style={{ fontFamily: "var(--font-heading)" }}
              >
                Start Leveling Up Your Career Today
              </h2>
              <p className="text-white/80 text-lg leading-relaxed">
                Join thousands of students building verified, gamified career
                portfolios. Your journey to the next level starts with one tap.
              </p>
              <div className="flex flex-wrap gap-3">
                <motion.a
                  href={process.env.NEXT_PUBLIC_APP_STORE_URL ?? "#"}
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.97 }}
                  className="flex items-center gap-2 rounded-2xl px-6 py-3 text-sm font-bold"
                  style={{
                    backgroundColor: "#fff",
                    color: "var(--color-primary-orange)",
                  }}
                >
                  <Download size={16} />
                  Download the App
                </motion.a>
                <motion.a
                  href={adminUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.97 }}
                  className="flex items-center gap-2 rounded-2xl px-6 py-3 text-sm font-bold border-2 border-white/60 text-white"
                >
                  Go to Admin Portal
                  <ArrowRight size={16} />
                </motion.a>
              </div>
            </motion.div>

            {/* Mascot */}
            <motion.div
              initial={{ opacity: 0, scale: 0.8 }}
              whileInView={{ opacity: 1, scale: 1 }}
              viewport={{ once: true }}
              transition={{ duration: 0.7, delay: 0.2 }}
            >
              <motion.div
                animate={{ y: [0, -12, 0] }}
                transition={{ duration: 3.5, repeat: Infinity, ease: "easeInOut" }}
              >
                <MascotImage
                  src="/assets/mascot/animations/hamster mascot.jpg"
                  alt="Hamster mascot"
                  width={320}
                  height={320}
                  className="drop-shadow-2xl rounded-3xl"
                  placeholderLabel="hamster mascot.jpg"
                />
              </motion.div>
            </motion.div>
          </div>
        </div>
      </div>
    </section>
  );
}
