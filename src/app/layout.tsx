import type { Metadata } from "next";
import { Inter, Roboto, Kanit, Prompt } from "next/font/google";
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

const kanit = Kanit({
  variable: "--font-kanit",
  subsets: ["latin", "thai"],
  weight: ["400", "700", "900"],
});

const prompt = Prompt({
  variable: "--font-prompt",
  subsets: ["latin", "thai"],
  weight: ["400", "700", "900"],
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
      className={`${inter.variable} ${roboto.variable} ${kanit.variable} ${prompt.variable} h-full antialiased dark`}
    >
      <body className={`min-h-full flex flex-col font-sans bg-zinc-950 text-zinc-50`}>
        {children}
      </body>
    </html>
  );
}
