import MascotImage from "@/components/ui/MascotImage";
import { Github, Twitter, Instagram, Linkedin } from "lucide-react";

const FEATURE_LINKS = [
  { label: "XP Tracking",      href: "#features" },
  { label: "Career Wallet",    href: "#features" },
  { label: "Achievement Badges", href: "#features" },
  { label: "How It Works",    href: "#how-it-works" },
  { label: "Stats",           href: "#stats" },
];

const LEGAL_LINKS = [
  { label: "Privacy Policy",   href: "#" },
  { label: "Terms of Service", href: "#" },
  { label: "Cookie Policy",    href: "#" },
];

const SOCIAL_LINKS = [
  { label: "GitHub",    href: "#", icon: Github },
  { label: "Twitter",   href: "#", icon: Twitter },
  { label: "Instagram", href: "#", icon: Instagram },
  { label: "LinkedIn",  href: "#", icon: Linkedin },
];

export default function Footer() {
  const adminUrl = process.env.NEXT_PUBLIC_ADMIN_URL ?? "http://localhost:3000";
  const year = new Date().getFullYear();

  return (
    <footer
      id="footer"
      style={{ backgroundColor: "var(--color-text-dark)", color: "rgba(247,244,238,0.85)" }}
    >
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-14">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-10">
          {/* Brand column */}
          <div className="md:col-span-1 flex flex-col gap-4">
            <div className="flex items-center gap-2">
              <MascotImage
                src="/assets/logo/xp_carreer_logo-removebg-preview.png"
                alt="XP Career Wallet"
                width={120}
                height={120}
                className="rounded-xl"
                placeholderLabel="logo"
              />
              </div>
            <p className="text-sm leading-relaxed opacity-70">
              Level up your career journey. Earn XP, collect badges, and showcase a blockchain-verified portfolio.
            </p>
            <div className="flex items-center gap-3 mt-1">
              {SOCIAL_LINKS.map(({ label, href, icon: Icon }) => (
                <a
                  key={label}
                  href={href}
                  aria-label={label}
                  className="w-8 h-8 rounded-lg flex items-center justify-center transition-opacity hover:opacity-70"
                  style={{ backgroundColor: "rgba(247,244,238,0.1)" }}
                >
                  <Icon size={15} />
                </a>
              ))}
            </div>
          </div>

          {/* Features */}
          <div>
            <h4 className="text-sm font-bold uppercase tracking-widest mb-4 opacity-50">Features</h4>
            <ul className="flex flex-col gap-2">
              {FEATURE_LINKS.map((l) => (
                <li key={l.label}>
                  <a
                    href={l.href}
                    className="text-sm transition-opacity hover:opacity-70"
                  >
                    {l.label}
                  </a>
                </li>
              ))}
            </ul>
          </div>

          {/* Legal */}
          <div>
            <h4 className="text-sm font-bold uppercase tracking-widest mb-4 opacity-50">Legal</h4>
            <ul className="flex flex-col gap-2">
              {LEGAL_LINKS.map((l) => (
                <li key={l.label}>
                  <a href={l.href} className="text-sm transition-opacity hover:opacity-70">
                    {l.label}
                  </a>
                </li>
              ))}
            </ul>
          </div>

          {/* Access */}
          <div>
            <h4 className="text-sm font-bold uppercase tracking-widest mb-4 opacity-50">Access</h4>
            <ul className="flex flex-col gap-2">
              <li>
                <a
                  href={process.env.NEXT_PUBLIC_APP_STORE_URL ?? "#"}
                  className="text-sm transition-opacity hover:opacity-70"
                >
                  App Store
                </a>
              </li>
              <li>
                <a
                  href={process.env.NEXT_PUBLIC_PLAY_STORE_URL ?? "#"}
                  className="text-sm transition-opacity hover:opacity-70"
                >
                  Google Play
                </a>
              </li>
              <li>
                <a
                  href={adminUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm opacity-50 transition-opacity hover:opacity-70"
                >
                  Admin Login ↗
                </a>
              </li>
            </ul>
          </div>
        </div>

        <div
          className="mt-12 pt-6 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs opacity-40"
          style={{ borderTop: "1px solid rgba(247,244,238,0.1)" }}
        >
          <p>© {year} XP Career Wallet. All rights reserved.</p>
          <p>Built with ❤️ for ambitious learners.</p>
        </div>
      </div>
    </footer>
  );
}
