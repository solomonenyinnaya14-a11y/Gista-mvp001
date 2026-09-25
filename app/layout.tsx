import type { Metadata } from "next";
import "./globals.css";
export const metadata: Metadata={title:"Gista",description:"Explore. Share. Talk. Belong."};
export default function RootLayout({children}:{children:React.ReactNode}){return <html lang="en"><body>{children}</body></html>}