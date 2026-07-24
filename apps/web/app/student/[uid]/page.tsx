"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import { getDoc, getDocs, collection, query, where, doc } from "firebase/firestore";
import { db } from "@talentbank/firebase-config";
import { LEVEL_NAMES } from "@talentbank/shared";
import type { UserProfile, Badge } from "@talentbank/shared";

// Keys that render better with white/light text
const DARK_KEYS = new Set(["slate", "charcoal", "ocean", "midnight", "cosmic", "neon", "candy"]);

function isDark(profile: UserProfile | null): boolean {
  if (!profile?.profileBackground) return false;
  return DARK_KEYS.has(profile.profileBackground.value);
}

// Backward-compat: old data that stored a raw hex as the value
function legacyBgStyle(bg: UserProfile["profileBackground"]): React.CSSProperties | null {
  if (!bg) return null;
  // If value looks like a CSS hex/named color (not a theme key), apply as inline style
  if (bg.value.startsWith("#")) return { backgroundColor: bg.value };
  return null; // modern keys → handled by career-bg-{value} CSS class
}

interface ExamReg { id: string; examTitle?: string; status?: string; }

export default function PublicStudentProfile() {
  const { uid } = useParams<{ uid: string }>();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [badges, setBadges] = useState<Badge[]>([]);
  const [enrollments, setEnrollments] = useState<ExamReg[]>([]);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    if (!uid) return;
    const load = async () => {
      const userSnap = await getDoc(doc(db, "users", uid as string));
      if (!userSnap.exists()) { setNotFound(true); setLoading(false); return; }
      setProfile(userSnap.data() as UserProfile);

      const badgeSnap = await getDocs(collection(db, "badges"));
      setBadges(badgeSnap.docs.map((d) => ({ id: d.id, ...d.data() } as Badge)).filter((b) => b.userId === uid));

      const regSnap = await getDocs(query(collection(db, "examRegistrations"), where("userId", "==", uid)));
      setEnrollments(regSnap.docs.map((d) => ({ id: d.id, ...d.data() } as ExamReg)));
      setLoading(false);
    };
    load();
  }, [uid]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F7F4EE]">
        <p className="text-[#9E988F] text-sm">Loading profile…</p>
      </div>
    );
  }

  if (notFound || !profile) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F7F4EE]">
        <div className="text-center">
          <p className="text-2xl mb-2">🔍</p>
          <p className="text-[#3A332C] font-semibold">Profile not found</p>
          <p className="text-[#9E988F] text-sm mt-1">This link may be invalid or the account may been removed.</p>
        </div>
      </div>
    );
  }

  const levelName = LEVEL_NAMES[profile.level ?? 1] ?? "Explorer";
  const dark = isDark(profile);
  const bg = profile.profileBackground;
  const bgKey = (bg?.type === "static" || bg?.type === "animated") ? bg.value : "cream";
  const legacyStyle = legacyBgStyle(bg);

  // Tailwind theme tokens
  const textMuted  = dark ? "text-white/60"  : "text-[#9E988F]";
  const textBody   = dark ? "text-white/90"  : "text-[#3A332C]";
  const cardBg     = dark ? "bg-white/10 border-white/20 backdrop-blur-sm" : "bg-white border-[#E2DED6]";
  const skillChip  = dark ? "bg-white/20 text-white" : "bg-[#E8923C15] text-[#E8923C] border border-[#E8923C30]";
  const interestChip = dark ? "bg-white/20 text-white" : "bg-[#6E89B815] text-[#6E89B8] border border-[#6E89B830]";
  const labelChip  = dark ? "bg-white/20 text-white" : "bg-[#E8923C20] text-[#E8923C]";
  const linkColor  = dark ? "text-white/80 hover:text-white" : "text-[#6E89B8] hover:text-[#4a6a9a]";
  const innerCard  = dark ? "bg-white/10 border-white/15" : "bg-[#F7F4EE] border-[#E2DED6]";

  return (
    <div
      className={`career-bg-${bgKey} min-h-screen py-10 px-4`}
      style={legacyStyle ?? undefined}
    >
      {/* Content sits above the animated ::before layer */}
      <div className="relative z-10 max-w-xl mx-auto space-y-6">

        {/* Header */}
        <div className={`rounded-2xl p-6 border flex items-center gap-5 ${cardBg}`}>
          {profile.photoURL
            ? <img src={profile.photoURL} alt={profile.name} className="w-20 h-20 rounded-full object-cover shrink-0" />
            : <div className="w-20 h-20 rounded-full bg-[#E2DED6] shrink-0" />}
          <div>
            <h1 className={`text-xl font-bold ${textBody}`}>{profile.name}</h1>
            <span className={`inline-block mt-1 px-3 py-1 rounded-full text-xs font-semibold ${dark ? "bg-white/20 text-white" : "bg-[#E8923C20] text-[#E8923C] border border-[#E8923C40]"}`}>
              Lv.{profile.level ?? 1} · {levelName}
            </span>
            <p className={`text-xs mt-1 ${textMuted}`}>{profile.email}</p>
          </div>
        </div>

        {/* Skills */}
        {(profile.skills?.length ?? 0) > 0 && (
          <div className={`rounded-2xl p-6 border ${cardBg}`}>
            <h2 className={`text-sm font-bold mb-3 uppercase tracking-wide ${textMuted}`}>Skills</h2>
            <div className="flex flex-wrap gap-2">
              {profile.skills!.map((s) => (
                <span key={s} className={`px-3 py-1 rounded-full text-xs font-semibold ${skillChip}`}>{s}</span>
              ))}
            </div>
          </div>
        )}

        {/* Interests */}
        {(profile.interests?.length ?? 0) > 0 && (
          <div className={`rounded-2xl p-6 border ${cardBg}`}>
            <h2 className={`text-sm font-bold mb-3 uppercase tracking-wide ${textMuted}`}>Interests</h2>
            <div className="flex flex-wrap gap-2">
              {profile.interests!.map((i) => (
                <span key={i} className={`px-3 py-1 rounded-full text-xs font-semibold ${interestChip}`}>{i}</span>
              ))}
            </div>
          </div>
        )}

        {/* Badges */}
        {badges.length > 0 && (
          <div className={`rounded-2xl p-6 border ${cardBg}`}>
            <h2 className={`text-sm font-bold mb-4 uppercase tracking-wide ${textMuted}`}>
              Badges <span className="font-normal normal-case">({badges.length})</span>
            </h2>
            <div className="grid grid-cols-4 gap-3">
              {badges.map((b) => (
                <div key={b.id} className="flex flex-col items-center gap-1 p-3 rounded-xl text-center" style={{ backgroundColor: b.color + "20" }}>
                  <span className="text-3xl">{b.emoji}</span>
                  <span className={`text-[10px] font-semibold leading-tight ${textMuted}`}>{b.eventTitle}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Certifications */}
        {enrollments.length > 0 && (
          <div className={`rounded-2xl p-6 border ${cardBg}`}>
            <h2 className={`text-sm font-bold mb-4 uppercase tracking-wide ${textMuted}`}>Certifications</h2>
            <div className="space-y-3">
              {enrollments.map((e) => (
                <div key={e.id} className={`flex items-center gap-3 rounded-xl p-3 border ${innerCard}`}>
                  <span className="text-xl">📜</span>
                  <div>
                    <p className={`text-sm font-semibold ${textBody}`}>{e.examTitle ?? "Certification"}</p>
                    <p className={`text-xs capitalize ${textMuted}`}>{e.status ?? "registered"}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Links & Info (custom fields) */}
        {(profile.customFields?.length ?? 0) > 0 && (
          <div className={`rounded-2xl p-6 border ${cardBg}`}>
            <h2 className={`text-sm font-bold mb-4 uppercase tracking-wide ${textMuted}`}>Links & Info</h2>
            <div className="space-y-4">
              {profile.customFields!.map((f) => (
                <div key={f.id}>
                  <span className={`inline-block px-3 py-1 rounded-full text-xs font-bold mb-2 ${labelChip}`}>
                    {f.label}
                  </span>
                  {f.fieldType === "description" ? (
                    <p className={`text-sm whitespace-pre-wrap leading-relaxed ${textBody}`}>{f.value}</p>
                  ) : f.value.startsWith("http") ? (
                    <a href={f.value} target="_blank" rel="noopener noreferrer"
                      className={`text-sm underline underline-offset-2 break-all ${linkColor}`}>
                      {f.value}
                    </a>
                  ) : (
                    <p className={`text-sm ${textBody}`}>{f.value}</p>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Footer */}
        <p className={`text-center text-xs pb-6 ${textMuted}`}>
          Built with <span className={`font-semibold ${dark ? "text-white" : "text-[#E8923C]"}`}>TalentBank XP Career Wallet</span>
        </p>

      </div>
    </div>
  );
}
