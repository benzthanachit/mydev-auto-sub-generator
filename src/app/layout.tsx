import type { Metadata } from "next";
import { Inter, Roboto, Montserrat, Bangers } from "next/font/google";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

const roboto = Roboto({
  weight: ["400", "700", "900"],
  variable: "--font-roboto",
  subsets: ["latin"],
});

const montserrat = Montserrat({
  variable: "--font-montserrat",
  subsets: ["latin"],
});

const bangers = Bangers({
  weight: "400",
  variable: "--font-bangers",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Auto Subtitle Generator",
  description: "Generate and style auto-captions for short-form videos",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${inter.variable} ${roboto.variable} ${montserrat.variable} ${bangers.variable} h-full antialiased dark`}
    >
      <body className={`min-h-full flex flex-col font-sans bg-zinc-950 text-zinc-50`}>
        {children}
      </body>
    </html>
  );
}
