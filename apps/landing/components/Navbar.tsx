"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Menu, X, LogIn } from "lucide-react";
import MascotImage from "@/components/ui/MascotImage";

const NAV_LINKS = [
  { label: "Home",        href: "#home" },
  { label: "Features",   href: "#features" },
  { label: "How It Works", href: "#how-it-works" },
  { label: "Stats",      href: "#stats" },
  { label: "Contact",    href: "#footer" },
];

export default function Navbar() {
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  const adminUrl = process.env.NEXT_PUBLIC_ADMIN_URL ?? "http://localhost:3000";
  const expoUrl = process.env.NEXT_PUBLIC_EXPO_URL ?? "#";

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const handleNav = (href: string) => {
    setMobileOpen(false);
    document.querySelector(href)?.scrollIntoView({ behavior: "smooth" });
  };

  return (
    <motion.header
      className="fixed top-0 inset-x-0 z-50 transition-all"
      animate={{
        backgroundColor: scrolled ? "rgba(247,244,238,0.95)" : "rgba(247,244,238,0)",
        backdropFilter: scrolled ? "blur(12px)" : "blur(0px)",
        boxShadow: scrolled ? "0 2px 20px rgba(58,51,44,0.10)" : "none",
        paddingTop: scrolled ? "0.5rem" : "1rem",
        paddingBottom: scrolled ? "0.5rem" : "1rem",
      }}
      transition={{ duration: 0.3 }}
    >
      <nav className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 flex items-center justify-between">
        {/* Logo */}
        <button
          onClick={() => handleNav("#home")}
          className="flex items-center gap-2 focus:outline-none"
          aria-label="Go to home"
        >
          <MascotImage
            src="/assets/logo/xp_carreer_logo-removebg-preview.png"
            alt="XP Career Wallet logo"
            width={130}
            height={130}
            className="rounded-xl -my-4"
            placeholderLabel="logo"
          />
        </button>

        {/* Desktop nav links */}
        <ul className="hidden md:flex items-center gap-6">
          {NAV_LINKS.map((link) => (
            <li key={link.href}>
              <button
                onClick={() => handleNav(link.href)}
                className="text-sm font-semibold transition-colors hover:opacity-70 focus:outline-none"
                style={{ color: "var(--color-text-dark)" }}
              >
                {link.label}
              </button>
            </li>
          ))}
        </ul>

        {/* Desktop CTA buttons */}
        <div className="hidden md:flex items-center gap-3">
          <a
            href={adminUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="rounded-xl px-4 py-2 text-sm font-semibold border-2 transition-all hover:opacity-80"
            style={{
              borderColor: "var(--color-primary-blue)",
              color: "var(--color-primary-blue)",
            }}
          >
            Admin Login
          </a>
          <motion.a
            href={expoUrl}
            target="_blank"
            rel="noopener noreferrer"
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.97 }}
            className="flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-bold text-white transition-all"
            style={{ backgroundColor: "var(--color-primary-orange)" }}
          >
            <LogIn size={15} />
            Student Login
          </motion.a>
        </div>

        {/* Mobile hamburger */}
        <button
          className="md:hidden p-2 rounded-lg focus:outline-none"
          onClick={() => setMobileOpen(!mobileOpen)}
          aria-label="Toggle menu"
          style={{ color: "var(--color-text-dark)" }}
        >
          {mobileOpen ? <X size={24} /> : <Menu size={24} />}
        </button>
      </nav>

      {/* Mobile drawer */}
      <AnimatePresence>
        {mobileOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.25 }}
            className="md:hidden overflow-hidden"
            style={{ backgroundColor: "rgba(247,244,238,0.98)" }}
          >
            <div className="px-4 pb-4 pt-2 flex flex-col gap-3">
              {NAV_LINKS.map((link) => (
                <button
                  key={link.href}
                  onClick={() => handleNav(link.href)}
                  className="text-left py-2 text-base font-semibold border-b focus:outline-none"
                  style={{
                    color: "var(--color-text-dark)",
                    borderColor: "var(--color-shadow-grey)",
                  }}
                >
                  {link.label}
                </button>
              ))}
              <a
                href={adminUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="rounded-xl px-4 py-2 text-sm font-semibold border-2 text-center"
                style={{
                  borderColor: "var(--color-primary-blue)",
                  color: "var(--color-primary-blue)",
                }}
              >
                Admin Login
              </a>
              <a
                href={expoUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-bold text-white"
                style={{ backgroundColor: "var(--color-primary-orange)" }}
              >
                <LogIn size={15} />
                Student Login
              </a>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.header>
  );
}
