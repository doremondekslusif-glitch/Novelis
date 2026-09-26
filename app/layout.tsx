import type { Metadata } from "next";
import "./globals.css";
export const metadata: Metadata={title:"Novelis — AI Novel Studio",description:"Studio penulisan novel dengan bantuan AI"};
export default function RootLayout({children}:{children:React.ReactNode}){return <html lang="id"><body>{children}</body></html>}
