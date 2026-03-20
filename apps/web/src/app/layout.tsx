import type { Metadata } from "next";
import { IBM_Plex_Mono, Space_Grotesk } from "next/font/google";
import "./globals.css";

const spaceGrotesk = Space_Grotesk({
  variable: "--font-space-grotesk",
  subsets: ["latin"],
});

const ibmPlexMono = IBM_Plex_Mono({
  variable: "--font-ibm-plex-mono",
  subsets: ["latin"],
  weight: ["400", "500"],
});

export const metadata: Metadata = {
  title: "InternshipScrapper",
  description:
    "Socle full-stack pour automatiser la recherche de stage et d'emploi.",
};

const bodyClassName = [
  spaceGrotesk.variable,
  ibmPlexMono.variable,
  "h-full antialiased",
].join(" ");

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="fr" className={bodyClassName}>
      <body className="min-h-full flex flex-col bg-background text-foreground">
        <a href="#main-content" className="skip-link">
          Aller au contenu
        </a>
        <div id="main-content" className="contents">
          {children}
        </div>
      </body>
    </html>
  );
}
