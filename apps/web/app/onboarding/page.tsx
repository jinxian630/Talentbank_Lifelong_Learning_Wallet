"use client";
import { useState } from "react";
import { useAuthState } from "react-firebase-hooks/auth";
import { useRouter } from "next/navigation";
import { auth } from "@talentbank/firebase-config";
import { saveUserProfile } from "@talentbank/firebase-config";

const INTEREST_TAGS = [
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
  "AI & Machine Learning",
  "Data Science",
  "Data Analytics",
  "Web Development",
  "Mobile Development",
  "Backend Development",
  "Cybersecurity",
  "Cloud Computing",
  "DevOps",
  "Blockchain",
  "UI/UX Design",
  "Graphic Design",
  "Product Management",
  "Business & Entrepreneurship",
  "Robotics",
  "Game Development",
  "Embedded Systems",
  "IoT",
  "AR/VR",
  "Open Source",
  "Open to Explore 🌍",
];

import { Plus } from "lucide-react";

export default function Onboarding() {
  const [user] = useAuthState(auth);
  const router = useRouter();
  const [selected, setSelected] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  const toggle = (tag: string) => {
    setSelected((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag],
    );
  };

  const handleSave = async () => {
    setSaving(true);
    await saveUserProfile(user!.uid, {
      interests: selected,
      onboarded: true,
      name: user!.displayName,
      email: user!.email,
      photoURL: user!.photoURL,
    });
    router.push("/dashboard");
  };

  const handleSkip = async () => {
    await saveUserProfile(user!.uid, {
      interests: ["Open to Explore 🌍"],
      onboarded: true,
      name: user!.displayName,
      email: user!.email,
      photoURL: user!.photoURL,
    });
    router.push("/dashboard");
  };

  const [customTag, setCustomTag] = useState("");
  const addCustomTag = () => {
    if (!customTag.trim() || selected.includes(customTag.trim())) return;
    setSelected((prev) => [...prev, customTag.trim()]);
    setCustomTag("");
  };

  return (
    <main className="min-h-screen bg-[#0F0E17] flex items-center justify-center px-6 py-12">
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Outfit:wght@400;600;700;900&family=DM+Sans:wght@400;500;600&display=swap'); * { font-family: 'DM Sans', sans-serif; } h1,h2,h3 { font-family: 'Outfit', sans-serif; }`}</style>

      <div className="w-full max-w-2xl flex flex-col gap-8">
        <div className="flex flex-col gap-3">
          <div className="bg-amber-400 text-white rounded-xl px-3 py-1 font-black text-sm w-fit shadow-lg shadow-amber-400/30">
            TB
          </div>
          <h1 className="text-3xl font-black text-white">
            What are you into? 🎯
          </h1>
          <p className="text-white/50 text-sm">
            Pick your interests so we can recommend the right events for you.
            You can always update this in your profile.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          {INTEREST_TAGS.map((tag) => (
            <button
              key={tag}
              onClick={() => toggle(tag)}
              className={`px-4 py-2 rounded-2xl text-sm font-semibold border transition-all duration-150 ${
                selected.includes(tag)
                  ? "bg-amber-400 border-amber-400 text-[#0F0E17] shadow-lg shadow-amber-400/20"
                  : "bg-white/5 border-white/10 text-white/60 hover:border-amber-400/40 hover:text-white"
              }`}
            >
              {tag}
            </button>
          ))}
        </div>

        <div className="flex gap-2">
          <input
            className="flex-1 bg-white/5 border border-white/10 rounded-2xl px-4 py-3 text-sm text-white outline-none focus:border-amber-400/50 placeholder:text-white/30"
            placeholder="Add your own interest..."
            value={customTag}
            onKeyDown={(e) => e.key === "Enter" && addCustomTag()}
            onChange={(e) => setCustomTag(e.target.value)}
          />
          <button
            onClick={addCustomTag}
            className="bg-white/5 border border-white/10 text-white/60 px-4 rounded-2xl hover:bg-white/10 transition"
          >
            <Plus size={16} />
          </button>
        </div>

        <div className="flex gap-3">
          <button
            onClick={handleSave}
            disabled={saving || selected.length === 0}
            className="flex-1 bg-amber-400 text-[#0F0E17] py-3.5 rounded-2xl font-black hover:bg-amber-300 transition disabled:opacity-30 shadow-lg shadow-amber-400/20"
          >
            {saving
              ? "Saving..."
              : `Let's go! ${selected.length > 0 ? `(${selected.length} selected)` : ""}`}
          </button>
          <button
            onClick={handleSkip}
            className="px-6 bg-white/5 border border-white/10 text-white/50 py-3.5 rounded-2xl font-semibold hover:bg-white/10 transition"
          >
            Skip
          </button>
        </div>
      </div>
    </main>
  );
}
