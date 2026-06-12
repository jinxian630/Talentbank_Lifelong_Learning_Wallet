import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { SuiProvider } from "@/providers/SuiProvider";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "TalentBank Lifelong Learning Wallet",
  description: "Your lifelong learning wallet",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <SuiProvider>{children}</SuiProvider>
      </body>
    </html>
  );
}
