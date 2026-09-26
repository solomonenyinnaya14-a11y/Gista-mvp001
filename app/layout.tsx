import type { Metadata } from "next";
import "./globals.css";
import "./feed-fixes.css";
import "./gist-fixes.css";
import "./ui-fixes.css";
import "./voice-fixes.css";
import "./theme.css";
import "./action-theme-fixes.css";
import VerifiedBadgeInjector from "@/components/VerifiedBadgeInjector";
import ThemeProvider from "@/components/ThemeProvider";

export const metadata: Metadata={title:"Gista",description:"Explore. Share. Talk. Belong."};
export default function RootLayout({children}:{children:React.ReactNode}){return <html lang="en"><body><ThemeProvider><VerifiedBadgeInjector />{children}</ThemeProvider></body></html>}
