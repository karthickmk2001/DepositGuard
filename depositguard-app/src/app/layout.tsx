import type { Metadata } from "next";
import { Geist } from "next/font/google";
import "./globals.css";
import { DepositGuardProviders } from "./providers";
import Navbar from "@/components/Navbar";

const geist = Geist({ subsets: ["latin"], variable: "--font-geist" });

export const metadata: Metadata = {
  title: "DepositGuard : Deposit Shield for Ireland",
  description:
    "Decentralised rent deposit escrow. Neutral, transparent, and instant. Built for Ireland's 330,000 renters.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${geist.variable} h-full`}>
      <body className="min-h-full flex flex-col bg-gray-950 text-gray-100 antialiased">
        <DepositGuardProviders>
          <Navbar />
          <main className="flex-1">{children}</main>
          <footer className="border-t border-gray-800/60 py-5 text-center text-xs text-gray-600">
            DepositGuard
          </footer>
        </DepositGuardProviders>
      </body>
    </html>
  );
}
