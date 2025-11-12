import type { Metadata } from "next";
import { Poppins } from "next/font/google";
import "./globals.css";
import { ThemeProvider } from "@/components/theme/theme-provider";

const poppins = Poppins({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-poppins",
});

export const metadata: Metadata = {
  metadataBase: new URL("https://riwayyaat.app"),
  title: {
    default: "Riwayyaat",
    template: "%s • Riwayyaat",
  },
  description:
    "Riwayyaat is a graph-native workspace for tracing hadith narrations, sanad integrity, and matn insights — a project by UA.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${poppins.variable} bg-[var(--background)] text-[var(--text-primary)] antialiased`}
      >
        <ThemeProvider>{children}</ThemeProvider>
      </body>
    </html>
  );
}
