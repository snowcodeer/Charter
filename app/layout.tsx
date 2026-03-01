import type { Metadata } from "next";
import { Source_Serif_4, Special_Elite, Playfair_Display, Cormorant_Garamond } from "next/font/google";
import "./globals.css";

const sourceSerif = Source_Serif_4({
  variable: "--font-sans",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  style: ["normal", "italic"],
});

const specialElite = Special_Elite({
  variable: "--font-accent",
  subsets: ["latin"],
  weight: "400",
});

const playfairDisplay = Playfair_Display({
  variable: "--font-display-alt",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  style: ["normal", "italic"],
});

const cormorantGaramond = Cormorant_Garamond({
  variable: "--font-display",
  subsets: ["latin"],
  weight: ["400", "500"],
  style: ["normal", "italic"],
});

export const metadata: Metadata = {
  title: "Charter",
  description: "AI travel agent",
  icons: {
    icon: "data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><text y='.9em' font-size='90'>🧙</text></svg>",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body
        className={`${sourceSerif.variable} ${specialElite.variable} ${playfairDisplay.variable} ${cormorantGaramond.variable} bg-black text-white`}
      >
        {children}
      </body>
    </html>
  );
}
