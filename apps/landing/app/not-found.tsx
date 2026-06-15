import Link from "next/link";

export default function NotFound() {
  return (
    <main style={{ minHeight: "100vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", backgroundColor: "#F7F4EE", gap: "1rem" }}>
      <h1 style={{ fontSize: "3rem", fontWeight: 800, color: "#3A332C" }}>404</h1>
      <p style={{ color: "#6b6059", fontSize: "1.1rem" }}>Page not found</p>
      <Link href="/" style={{ color: "#E8923C", fontWeight: 600, textDecoration: "underline" }}>
        Go back home
      </Link>
    </main>
  );
}
