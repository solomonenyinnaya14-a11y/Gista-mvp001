import type { Metadata } from "next";
import "./globals.css";
import "./feed-fixes.css";
import "./gist-fixes.css";
import "./ui-fixes.css";
import "./voice-fixes.css";
import "./theme.css";
import "./action-theme-fixes.css";
import "./performance-fixes.css";
import VerifiedBadgeInjector from "@/components/VerifiedBadgeInjector";
import ThemeProvider from "@/components/ThemeProvider";
import NavigationPrefetch from "@/components/NavigationPrefetch";

export const metadata: Metadata={title:"Gista",description:"Explore. Share. Talk. Belong."};
export default function RootLayout({children}:{children:React.ReactNode}){return <html lang="en"><body><ThemeProvider><VerifiedBadgeInjector /><NavigationPrefetch />{children}</ThemeProvider></body></html>}
