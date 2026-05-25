import type { Metadata } from "next";
import "./globals.css";
import { LanguageProvider } from "@/lib/language-context";

export const metadata: Metadata = {
  title: {
    default: "Defect Library | 服装缺陷智能检索知识库",
    template: "%s | Defect Library",
  },
  description: "基于AI大模型的服装缺陷智能检索系统，多Agent协同驱动",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN" suppressHydrationWarning>
      <body className="antialiased min-h-screen bg-background text-foreground">
        <LanguageProvider>{children}</LanguageProvider>
      </body>
    </html>
  );
}
