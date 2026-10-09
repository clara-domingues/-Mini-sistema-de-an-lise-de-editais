import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: {
    default: "EditalAI | Análise Inteligente de Editais",
    template: "%s | EditalAI",
  },
  description:
    "Analise editais com inteligência artificial, identifique requisitos, organize documentos e acompanhe as informações importantes para participar de licitações.",
  applicationName: "EditalAI",
  keywords: [
    "EditalAI",
    "análise de editais",
    "licitações",
    "inteligência artificial",
    "documentos para licitação",
  ],
  robots: {
    index: false,
    follow: false,
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="pt-BR"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col">{children}</body>
    </html>
  );
}