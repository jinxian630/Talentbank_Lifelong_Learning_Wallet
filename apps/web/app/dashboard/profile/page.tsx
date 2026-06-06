"use client";
import { useState, useEffect } from "react";
import { useAuthState } from "react-firebase-hooks/auth";
import { useRouter } from "next/navigation";
import { auth, db, storage } from "@talentbank/firebase-config";
import {
  getUserBadges,
  getUserProfile,
  saveUserProfile,
} from "@talentbank/firebase-config";
import { signOut } from "firebase/auth";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import {
  LogOut,
  Calendar,
  Award,
  User,
  Plus,
  X,
  ExternalLink,
  FileText,
} from "lucide-react";

const BADGE_CLIPS: Record<string, string> = {
  hexagon: "polygon(50% 0%, 100% 25%, 100% 75%, 50% 100%, 0% 75%, 0% 25%)",
  diamond: "polygon(50% 0%, 100% 50%, 50% 100%, 0% 50%)",
  pentagon: "polygon(50% 0%, 100% 38%, 82% 100%, 18% 100%, 0% 38%)",
  star: "polygon(50% 0%, 61% 35%, 98% 35%, 68% 57%, 79% 91%, 50% 70%, 21% 91%, 32% 57%, 2% 35%, 39% 35%)",
  circle: "none",
  square: "none",
};

const PRESET_SKILLS = [
  "Python",
  "JavaScript",
  "TypeScript",
  "Java",
  "C++",
  "C#",
  "Rust",
  "Go",
  "Kotlin",
  "Swift",
  "Dart",
  "Flutter",
  "React Native",
  "React",
  "Next.js",
  "Vue.js",
  "Node.js",
  "Django",
  "FastAPI",
  "Spring Boot",
  "SQL",
  "MongoDB",
  "PostgreSQL",
  "Firebase",
  "Supabase",
  "AI & ML",
  "Data Science",
  "Data Analytics",
  "Power BI",
  "Tableau",
  "Cybersecurity",
  "Cloud (AWS)",
  "Cloud (GCP)",
  "Cloud (Azure)",
  "DevOps",
  "Docker",
  "Kubernetes",
  "UI/UX Design",
  "Figma",
  "Graphic Design",
  "Product Management",
  "Project Management",
  "Public Speaking",
  "Technical Writing",
];

const INTEREST_TAGS = [
  "Python",
  "JavaScript",
  "TypeScript",
  "Java",
  "C++",
  "Rust",
  "Go",
  "AI & Machine Learning",
  "Data Science",
  "Web Development",
  "Mobile Development",
  "Cybersecurity",
  "Cloud Computing",
  "Blockchain",
  "UI/UX Design",
  "Product Management",
  "Business & Entrepreneurship",
  "Robotics",
  "Game Development",
  "Open Source",
  "Open to Explore 🌍",
];

export default function ProfilePage() {
  const [user, loading] = useAuthState(auth);
  const router = useRouter();
  const [profile, setProfile] = useState<any>(null);
  const [badges, setBadges] = useState<any[]>([]);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState("info");
  const [customSkill, setCustomSkill] = useState("");

  const [form, setForm] = useState({
    name: "",
    bio: "",
    phone: "",
    linkedin: "",
    skills: [] as string[],
    interests: [] as string[],
    resumeFile: null as File | null,
    resumeUrl: "",
  });

  useEffect(() => {
    if (!loading && !user) router.push("/");
  }, [user, loading]);

  useEffect(() => {
    if (user) {
      fetchProfile();
      getUserBadges(user.uid).then(setBadges);
    }
  }, [user]);

  const fetchProfile = async () => {
    const data = await getUserProfile(user!.uid);
    setProfile(data);
    setForm({
      name: data?.name ?? user?.displayName ?? "",
      bio: data?.bio ?? "",
      phone: data?.phone ?? "",
      linkedin: data?.linkedin ?? "",
      skills: data?.skills ?? [],
      interests: data?.interests ?? [],
      resumeFile: null,
      resumeUrl: data?.resumeUrl ?? "",
    });
  };

  const handleSave = async () => {
    setSaving(true);
    let resumeUrl = form.resumeUrl;
    if (form.resumeFile) {
      const storageRef = ref(
        storage,
        `resumes/${user!.uid}_${form.resumeFile.name}`,
      );
      await uploadBytes(storageRef, form.resumeFile);
      resumeUrl = await getDownloadURL(storageRef);
    }
    await saveUserProfile(user!.uid, {
      name: form.name,
      bio: form.bio,
      phone: form.phone,
      linkedin: form.linkedin,
      skills: form.skills,
      interests: form.interests,
      resumeUrl,
    });
    setSaving(false);
    setEditing(false);
    fetchProfile();
  };

  const toggleSkill = (skill: string) => {
    setForm((prev) => ({
      ...prev,
      skills: prev.skills.includes(skill)
        ? prev.skills.filter((s) => s !== skill)
        : [...prev.skills, skill],
    }));
  };

  const toggleInterest = (tag: string) => {
    setForm((prev) => ({
      ...prev,
      interests: prev.interests.includes(tag)
        ? prev.interests.filter((t) => t !== tag)
        : [...prev.interests, tag],
    }));
  };

  const addCustomSkill = () => {
    if (!customSkill.trim()) return;
    setForm((prev) => ({
      ...prev,
      skills: [...prev.skills, customSkill.trim()],
    }));
    setCustomSkill("");
  };

  const handleLogout = async () => {
    await signOut(auth);
    router.push("/");
  };

  if (loading)
    return (
      <div className="min-h-screen bg-[#0F0E17] flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-amber-400 border-t-transparent rounded-full animate-spin" />
      </div>
    );

  return (
    <main className="min-h-screen bg-[#0F0E17]">
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Outfit:wght@400;600;700;900&family=DM+Sans:wght@400;500;600&display=swap'); * { font-family: 'DM Sans', sans-serif; } h1,h2,h3 { font-family: 'Outfit', sans-serif; }`}</style>

      <nav className="bg-[#0F0E17]/80 border-b border-white/8 backdrop-blur-xl sticky top-0 z-40 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="bg-amber-400 text-white rounded-xl px-3 py-1 font-black text-sm shadow-lg shadow-amber-400/30">
            TB
          </div>
          <span className="font-bold text-white">TalentBank</span>
        </div>
        <button
          onClick={handleLogout}
          className="text-white/40 hover:text-red-400 transition"
        >
          <LogOut size={16} />
        </button>
      </nav>

      <div className="bg-[#0F0E17]/80 border-b border-white/8 backdrop-blur-xl px-6">
        <div className="max-w-4xl mx-auto flex">
          {[
            {
              id: "events",
              label: "Events",
              icon: <Calendar size={15} />,
              path: "/dashboard/events",
            },
            {
              id: "badges",
              label: "Badges",
              icon: <Award size={15} />,
              path: "/dashboard/badges",
            },
            {
              id: "profile",
              label: "Profile",
              icon: <User size={15} />,
              path: "/dashboard/profile",
            },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => router.push(tab.path)}
              className={`flex items-center gap-1.5 px-5 py-4 text-sm font-semibold border-b-2 transition ${tab.id === "profile" ? "border-amber-400 text-amber-400" : "border-transparent text-white/40 hover:text-white/70"}`}
            >
              {tab.icon} {tab.label}
            </button>
          ))}
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-6 py-8 flex flex-col gap-6">
        {/* Profile Header */}
        <div className="bg-[#1A1825] border border-white/8 rounded-3xl p-6 flex items-center gap-5">
          <div className="relative shrink-0">
            <div className="w-20 h-20 rounded-2xl overflow-hidden border-2 border-amber-400/30">
              {user?.photoURL ? (
                <img
                  src={user.photoURL}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full bg-amber-400 flex items-center justify-center text-white text-2xl font-black">
                  {user?.displayName?.[0]}
                </div>
              )}
            </div>
            <div className="absolute -bottom-1 -right-1 w-6 h-6 bg-amber-400 rounded-lg flex items-center justify-center text-xs text-[#0F0E17] font-black">
              {badges.length}
            </div>
          </div>
          <div className="flex-1 min-w-0">
            <h1 className="text-xl font-black text-white truncate">
              {profile?.name ?? user?.displayName}
            </h1>
            <p className="text-sm text-white/40">{user?.email}</p>
            {profile?.bio && (
              <p className="text-sm text-white/60 mt-1 line-clamp-2">
                {profile.bio}
              </p>
            )}
          </div>
          <button
            onClick={() => setEditing(true)}
            className="shrink-0 bg-white/5 border border-white/10 text-white/60 px-4 py-2 rounded-xl text-sm font-semibold hover:bg-white/10 transition"
          >
            Edit
          </button>
        </div>

        {/* Sub tabs */}
        <div className="flex gap-2">
          {["info", "badges"].map((t) => (
            <button
              key={t}
              onClick={() => setActiveTab(t)}
              className={`px-4 py-2 rounded-xl text-sm font-semibold transition capitalize ${activeTab === t ? "bg-amber-400 text-[#0F0E17]" : "bg-white/5 text-white/40 hover:bg-white/10"}`}
            >
              {t === "badges" ? `Badges (${badges.length})` : "Info"}
            </button>
          ))}
        </div>

        {activeTab === "info" && (
          <div className="flex flex-col gap-4">
            {/* Contact */}
            {(profile?.phone || profile?.linkedin || profile?.resumeUrl) && (
              <div className="bg-[#1A1825] border border-white/8 rounded-3xl p-5 flex flex-col gap-3">
                <h2 className="text-sm font-bold text-white/60 uppercase tracking-wider">
                  Contact
                </h2>
                {profile?.phone && (
                  <p className="text-sm text-white">📞 {profile.phone}</p>
                )}
                {profile?.linkedin && (
                  <a
                    href={profile.linkedin}
                    target="_blank"
                    rel="noreferrer"
                    className="text-sm text-amber-400 flex items-center gap-1 hover:underline"
                  >
                    <ExternalLink size={13} /> LinkedIn
                  </a>
                )}
                {profile?.resumeUrl && (
                  <a
                    href={profile.resumeUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="text-sm text-cyan-400 flex items-center gap-1 hover:underline"
                  >
                    <FileText size={13} /> View Resume
                  </a>
                )}
              </div>
            )}

            {/* Skills */}
            {form.skills.length > 0 && (
              <div className="bg-[#1A1825] border border-white/8 rounded-3xl p-5 flex flex-col gap-3">
                <h2 className="text-sm font-bold text-white/60 uppercase tracking-wider">
                  Skills
                </h2>
                <div className="flex flex-wrap gap-2">
                  {form.skills.map((skill) => (
                    <span
                      key={skill}
                      className="px-3 py-1.5 rounded-xl text-xs font-semibold bg-purple-400/10 text-purple-400"
                    >
                      {skill}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Interests */}
            {form.interests.length > 0 && (
              <div className="bg-[#1A1825] border border-white/8 rounded-3xl p-5 flex flex-col gap-3">
                <h2 className="text-sm font-bold text-white/60 uppercase tracking-wider">
                  Interests
                </h2>
                <div className="flex flex-wrap gap-2">
                  {form.interests.map((tag) => (
                    <span
                      key={tag}
                      className="px-3 py-1.5 rounded-xl text-xs font-semibold bg-cyan-400/10 text-cyan-400"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {!profile?.phone &&
              !profile?.linkedin &&
              form.skills.length === 0 && (
                <div className="bg-[#1A1825] border border-white/8 rounded-3xl p-8 text-center">
                  <p className="text-white/30 text-sm">No info added yet.</p>
                  <button
                    onClick={() => setEditing(true)}
                    className="mt-3 text-amber-400 text-sm font-semibold hover:underline"
                  >
                    Complete your profile →
                  </button>
                </div>
              )}
          </div>
        )}

        {activeTab === "badges" && (
          <div className="flex flex-col gap-4">
            {badges.length === 0 ? (
              <div className="bg-[#1A1825] border border-white/8 rounded-3xl p-8 text-center">
                <div className="text-4xl mb-3">🏅</div>
                <p className="text-white/30 text-sm">
                  No badges yet. Join events to earn some!
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                {badges.map((badge) => (
                  <div
                    key={badge.id}
                    className="bg-[#1A1825] border border-white/8 rounded-3xl p-5 flex flex-col items-center gap-3"
                  >
                    <div
                      style={{
                        width: 64,
                        height: 64,
                        background: badge.color,
                        clipPath: BADGE_CLIPS[badge.shape] ?? "none",
                        borderRadius:
                          badge.shape === "circle"
                            ? "50%"
                            : badge.shape === "square"
                              ? "12px"
                              : "0",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontSize: 26,
                        boxShadow: `0 6px 24px ${badge.color}40`,
                      }}
                    >
                      {badge.emoji}
                    </div>
                    <p className="text-xs font-bold text-white text-center leading-tight">
                      {badge.eventTitle}
                    </p>
                    <p className="text-xs text-white/30">
                      {badge.awardedAt?.toDate().toLocaleDateString()}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Edit Modal */}
      {editing && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-start justify-center overflow-y-auto py-8 px-4">
          <div className="bg-[#1A1825] border border-white/10 rounded-3xl p-6 w-full max-w-lg flex flex-col gap-5">
            <div className="flex items-center justify-between">
              <h2 className="font-black text-white text-lg">Edit Profile</h2>
              <button
                onClick={() => setEditing(false)}
                className="text-white/40 hover:text-white transition"
              >
                <X size={20} />
              </button>
            </div>

            <div className="flex flex-col gap-3">
              <label className="text-xs font-semibold text-white/40 uppercase tracking-wider">
                Display Name
              </label>
              <input
                className="bg-white/5 border border-white/10 rounded-2xl px-4 py-3 text-sm text-white outline-none focus:border-amber-400/50"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
              />
            </div>

            <div className="flex flex-col gap-3">
              <label className="text-xs font-semibold text-white/40 uppercase tracking-wider">
                Bio
              </label>
              <textarea
                className="bg-white/5 border border-white/10 rounded-2xl px-4 py-3 text-sm text-white outline-none focus:border-amber-400/50 resize-none"
                rows={3}
                placeholder="Tell people about yourself..."
                value={form.bio}
                onChange={(e) => setForm({ ...form, bio: e.target.value })}
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-2">
                <label className="text-xs font-semibold text-white/40 uppercase tracking-wider">
                  Phone
                </label>
                <input
                  className="bg-white/5 border border-white/10 rounded-2xl px-4 py-3 text-sm text-white outline-none focus:border-amber-400/50"
                  placeholder="+60 12 345 6789"
                  value={form.phone}
                  onChange={(e) => setForm({ ...form, phone: e.target.value })}
                />
              </div>
              <div className="flex flex-col gap-2">
                <label className="text-xs font-semibold text-white/40 uppercase tracking-wider">
                  LinkedIn URL
                </label>
                <input
                  className="bg-white/5 border border-white/10 rounded-2xl px-4 py-3 text-sm text-white outline-none focus:border-amber-400/50"
                  placeholder="https://linkedin.com/in/..."
                  value={form.linkedin}
                  onChange={(e) =>
                    setForm({ ...form, linkedin: e.target.value })
                  }
                />
              </div>
            </div>

            <div className="flex flex-col gap-3">
              <label className="text-xs font-semibold text-white/40 uppercase tracking-wider">
                Resume (PDF)
              </label>
              <input
                type="file"
                accept=".pdf"
                className="text-sm text-white/50 file:mr-3 file:py-2 file:px-4 file:rounded-xl file:border-0 file:bg-white/10 file:text-white/70 file:text-sm file:font-semibold hover:file:bg-white/20"
                onChange={(e) =>
                  setForm({ ...form, resumeFile: e.target.files?.[0] ?? null })
                }
              />
              {form.resumeUrl && (
                <p className="text-xs text-cyan-400">Resume uploaded ✓</p>
              )}
            </div>

            <div className="flex flex-col gap-3">
              <label className="text-xs font-semibold text-white/40 uppercase tracking-wider">
                Skills
              </label>
              <div className="flex flex-wrap gap-2">
                {PRESET_SKILLS.map((skill) => (
                  <button
                    key={skill}
                    onClick={() => toggleSkill(skill)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-semibold border transition ${
                      form.skills.includes(skill)
                        ? "bg-purple-400/20 border-purple-400/50 text-purple-400"
                        : "bg-white/5 border-white/10 text-white/40 hover:border-purple-400/30"
                    }`}
                  >
                    {skill}
                  </button>
                ))}
              </div>
              <div className="flex gap-2">
                <input
                  className="flex-1 bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm text-white outline-none focus:border-purple-400/50"
                  placeholder="Add custom skill..."
                  value={customSkill}
                  onChange={(e) => setCustomSkill(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && addCustomSkill()}
                />
                <button
                  onClick={addCustomSkill}
                  className="bg-purple-400/10 text-purple-400 px-3 py-2 rounded-xl hover:bg-purple-400/20 transition"
                >
                  <Plus size={16} />
                </button>
              </div>
              {form.skills
                .filter((s) => !PRESET_SKILLS.includes(s))
                .map((skill) => (
                  <div key={skill} className="flex items-center gap-2">
                    <span className="px-3 py-1.5 rounded-xl text-xs font-semibold bg-purple-400/20 text-purple-400">
                      {skill}
                    </span>
                    <button
                      onClick={() =>
                        setForm((prev) => ({
                          ...prev,
                          skills: prev.skills.filter((s) => s !== skill),
                        }))
                      }
                      className="text-white/20 hover:text-red-400 transition"
                    >
                      <X size={14} />
                    </button>
                  </div>
                ))}
            </div>

            <div className="flex flex-col gap-3">
              <label className="text-xs font-semibold text-white/40 uppercase tracking-wider">
                Interests
              </label>
              <div className="flex flex-wrap gap-2">
                {INTEREST_TAGS.map((tag) => (
                  <button
                    key={tag}
                    onClick={() => toggleInterest(tag)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-semibold border transition ${
                      form.interests.includes(tag)
                        ? "bg-cyan-400/20 border-cyan-400/50 text-cyan-400"
                        : "bg-white/5 border-white/10 text-white/40 hover:border-cyan-400/30"
                    }`}
                  >
                    {tag}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex gap-3 pt-2">
              <button
                onClick={handleSave}
                disabled={saving}
                className="flex-1 bg-amber-400 text-[#0F0E17] py-3 rounded-2xl font-black hover:bg-amber-300 transition disabled:opacity-50 shadow-lg shadow-amber-400/20"
              >
                {saving ? "Saving..." : "Save Profile"}
              </button>
              <button
                onClick={() => setEditing(false)}
                className="px-5 bg-white/5 border border-white/10 text-white/50 rounded-2xl font-semibold hover:bg-white/10 transition"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
