"use client";

import Link from "next/link";
import {
  BookOpen,
  MessageSquare,
  Upload,
  ArrowRight,
  Sparkles,
  Zap,
  Shield,
  Image as ImageIcon,
  Layers,
  Globe,
} from "lucide-react";
import { useLanguage } from "@/lib/language-context";

export default function Home() {
  const { lang, setLang, t } = useLanguage();

  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-50/30 via-white to-blue-50/30">
      {/* Header */}
      <header className="fixed top-0 left-0 right-0 bg-white/80 backdrop-blur-md border-b border-gray-100 z-50">
        <div className="max-w-6xl mx-auto px-4 h-14 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-orange-400 to-orange-500 flex items-center justify-center shadow-sm">
              <Sparkles className="h-4 w-4 text-white" />
            </div>
            <span className="font-semibold text-lg text-gray-800">Defect Library</span>
          </Link>

          <nav className="flex items-center gap-1">
            <button
              onClick={() => setLang(lang === "zh" ? "en" : "zh")}
              className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-gray-600 hover:text-gray-900 hover:bg-gray-50 rounded-lg transition-colors"
            >
              <Globe className="h-4 w-4" />
              {lang === "zh" ? "EN" : "中文"}
            </button>
            <Link href="/admin" className="px-3 py-1.5 text-sm font-medium text-gray-600 hover:text-gray-900 hover:bg-gray-50 rounded-lg transition-colors">
              {t["nav.admin"]}
            </Link>
            <Link href="/chat" className="px-3 py-1.5 text-sm font-medium text-gray-600 hover:text-gray-900 hover:bg-gray-50 rounded-lg transition-colors">
              {t["nav.chat"]}
            </Link>
            <Link href="/knowledge" className="px-3 py-1.5 text-sm font-medium text-gray-600 hover:text-gray-900 hover:bg-gray-50 rounded-lg transition-colors">
              {t["nav.knowledge"]}
            </Link>
          </nav>
        </div>
      </header>

      {/* Main Content */}
      <main className="pt-20 pb-16">
        {/* Hero Section */}
        <div className="max-w-5xl mx-auto px-4 mb-16">
          <div className="text-center">
            <div className="inline-flex items-center gap-2 bg-orange-50 border border-orange-200 text-orange-700 text-sm font-medium px-4 py-2 rounded-full mb-6">
              <Zap className="h-4 w-4" />
              {t["home.badge"]}
            </div>

            <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold text-gray-900 mb-6 leading-tight">
              {t["home.title"]}
              <span className="bg-gradient-to-r from-orange-500 to-orange-600 bg-clip-text text-transparent">{t["home.titleHighlight"]}</span>
            </h1>

            <p className="text-lg md:text-xl text-gray-600 max-w-3xl mx-auto leading-relaxed mb-10">
              {t["home.subtitle"]}
            </p>

            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <Link
                href="/chat"
                className="group flex items-center justify-center gap-2 px-6 py-3 bg-gradient-to-r from-orange-500 to-orange-600 text-white font-medium rounded-xl shadow-lg shadow-orange-500/25 hover:shadow-xl hover:shadow-orange-500/30 transition-all hover:-translate-y-0.5"
              >
                {t["home.btnPrimary"]}
                <ArrowRight className="h-4 w-4 group-hover:translate-x-0.5 transition-transform" />
              </Link>

              <Link
                href="/admin"
                className="flex items-center justify-center gap-2 px-6 py-3 bg-white text-gray-700 font-medium rounded-xl border border-gray-200 shadow-sm hover:border-orange-300 hover:bg-orange-50/50 transition-all"
              >
                {t["home.btnSecondary"]}
                <Upload className="h-4 w-4" />
              </Link>
            </div>
          </div>
        </div>

        {/* Feature Cards */}
        <div className="max-w-5xl mx-auto px-4 mb-20">
          <div className="grid md:grid-cols-3 gap-6">
            <Link
              href="/admin"
              className="group p-7 bg-white rounded-2xl border border-gray-100 shadow-sm hover:shadow-xl hover:border-orange-200 transition-all duration-300 hover:-translate-y-1"
            >
              <div className="w-14 h-14 bg-gradient-to-br from-orange-100 to-orange-50 rounded-2xl flex items-center justify-center mb-5 group-hover:scale-110 transition-transform">
                <Upload className="h-7 w-7 text-orange-600" />
              </div>
              <h3 className="text-lg font-bold text-gray-900 mb-2">
                {t["card.docTitle"]}
              </h3>
              <p className="text-sm text-gray-500 leading-relaxed mb-4">
                {t["card.docDesc"]}
              </p>
              <span className="text-sm font-medium text-orange-600 flex items-center gap-1 group-hover:gap-2 transition-all">
                {t["card.docLink"]} <ArrowRight className="h-4 w-4" />
              </span>
            </Link>

            <Link
              href="/chat"
              className="group p-7 bg-white rounded-2xl border border-gray-100 shadow-sm hover:shadow-xl hover:border-blue-200 transition-all duration-300 hover:-translate-y-1"
            >
              <div className="w-14 h-14 bg-gradient-to-br from-blue-100 to-blue-50 rounded-2xl flex items-center justify-center mb-5 group-hover:scale-110 transition-transform">
                <MessageSquare className="h-7 w-7 text-blue-600" />
              </div>
              <h3 className="text-lg font-bold text-gray-900 mb-2">
                {t["card.chatTitle"]}
              </h3>
              <p className="text-sm text-gray-500 leading-relaxed mb-4">
                {t["card.chatDesc"]}
              </p>
              <span className="text-sm font-medium text-blue-600 flex items-center gap-1 group-hover:gap-2 transition-all">
                {t["card.chatLink"]} <ArrowRight className="h-4 w-4" />
              </span>
            </Link>

            <Link
              href="/knowledge"
              className="group p-7 bg-white rounded-2xl border border-gray-100 shadow-sm hover:shadow-xl hover:border-green-200 transition-all duration-300 hover:-translate-y-1"
            >
              <div className="w-14 h-14 bg-gradient-to-br from-green-100 to-green-50 rounded-2xl flex items-center justify-center mb-5 group-hover:scale-110 transition-transform">
                <BookOpen className="h-7 w-7 text-green-600" />
              </div>
              <h3 className="text-lg font-bold text-gray-900 mb-2">
                {t["card.knowledgeTitle"]}
              </h3>
              <p className="text-sm text-gray-500 leading-relaxed mb-4">
                {t["card.knowledgeDesc"]}
              </p>
              <span className="text-sm font-medium text-green-600 flex items-center gap-1 group-hover:gap-2 transition-all">
                {t["card.knowledgeLink"]} <ArrowRight className="h-4 w-4" />
              </span>
            </Link>
          </div>
        </div>

        {/* Capabilities Section */}
        <div className="max-w-5xl mx-auto px-4 mb-20">
          <div className="text-center mb-12">
            <h2 className="text-2xl font-bold text-gray-900 mb-3">{t["cap.title"]}</h2>
            <p className="text-gray-500">{t["cap.subtitle"]}</p>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { icon: ImageIcon, titleKey: "cap.1.title", descKey: "cap.1.desc", color: "orange" },
              { icon: Shield, titleKey: "cap.2.title", descKey: "cap.2.desc", color: "blue" },
              { icon: Zap, titleKey: "cap.3.title", descKey: "cap.3.desc", color: "purple" },
              { icon: Layers, titleKey: "cap.4.title", descKey: "cap.4.desc", color: "green" },
            ].map((item, idx) => (
              <div key={idx} className="p-5 bg-white rounded-xl border border-gray-100 hover:border-gray-200 hover:shadow-md transition-all">
                <div className={`w-11 h-11 bg-${item.color}-50 rounded-xl flex items-center justify-center mb-3`}>
                  <item.icon className={`h-5 w-5 text-${item.color}-600`} />
                </div>
                <h4 className="font-semibold text-gray-900 text-sm mb-1">{t[item.titleKey]}</h4>
                <p className="text-xs text-gray-500 leading-relaxed">{t[item.descKey]}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Agent Pipeline */}
        <div className="max-w-5xl mx-auto px-4 mb-16">
          <div className="text-center mb-10">
            <h2 className="text-2xl font-bold text-gray-900 mb-3">{t["pipeline.title"]}</h2>
            <p className="text-gray-500">{t["pipeline.subtitle"]}</p>
          </div>

          <div className="grid md:grid-cols-2 gap-6">
            {/* Pipeline A */}
            <div className="p-6 bg-white rounded-2xl border border-gray-100 shadow-sm">
              <div className="flex items-center gap-3 mb-5">
                <div className="w-10 h-10 bg-gradient-to-br from-orange-400 to-orange-500 rounded-xl flex items-center justify-center text-white font-bold text-sm shadow-sm">
                  A
                </div>
                <div>
                  <h3 className="font-bold text-gray-900">{t["pipeline.a.title"]}</h3>
                  <p className="text-xs text-gray-500">{t["pipeline.a.subtitle"]}</p>
                </div>
              </div>

              <div className="space-y-3">
                {[
                  { nameKey: "pipeline.a.step1", icon: Upload, color: "orange", descKey: "pipeline.a.step1Desc" },
                  { nameKey: "pipeline.a.step2", icon: ImageIcon, color: "red", descKey: "pipeline.a.step2Desc" },
                  { nameKey: "pipeline.a.step3", icon: Layers, color: "green", descKey: "pipeline.a.step3Desc" },
                  { nameKey: "pipeline.a.step4", icon: Zap, color: "blue", descKey: "pipeline.a.step4Desc" },
                ].map((step, idx) => (
                  <div key={idx} className="flex items-center gap-3">
                    <div className={`w-9 h-9 bg-${step.color}-50 rounded-lg flex items-center justify-center shrink-0`}>
                      <step.icon className={`h-4 w-4 text-${step.color}-600`} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-800">{t[step.nameKey]}</p>
                      <p className="text-xs text-gray-500 truncate">{t[step.descKey]}</p>
                    </div>
                    {idx < 3 && (
                      <ArrowRight className="h-4 w-4 text-gray-300 shrink-0" />
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Pipeline B */}
            <div className="p-6 bg-white rounded-2xl border border-gray-100 shadow-sm">
              <div className="flex items-center gap-3 mb-5">
                <div className="w-10 h-10 bg-gradient-to-br from-blue-400 to-blue-500 rounded-xl flex items-center justify-center text-white font-bold text-sm shadow-sm">
                  B
                </div>
                <div>
                  <h3 className="font-bold text-gray-900">{t["pipeline.b.title"]}</h3>
                  <p className="text-xs text-gray-500">{t["pipeline.b.subtitle"]}</p>
                </div>
              </div>

              <div className="space-y-3">
                {[
                  { nameKey: "pipeline.b.step1", icon: Sparkles, color: "purple", descKey: "pipeline.b.step1Desc" },
                  { nameKey: "pipeline.b.step2", icon: Zap, color: "cyan", descKey: "pipeline.b.step2Desc" },
                  { nameKey: "pipeline.b.step3", icon: Shield, color: "indigo", descKey: "pipeline.b.step3Desc" },
                  { nameKey: "pipeline.b.step4", icon: MessageSquare, color: "green", descKey: "pipeline.b.step4Desc" },
                ].map((step, idx) => (
                  <div key={idx} className="flex items-center gap-3">
                    <div className={`w-9 h-9 bg-${step.color}-50 rounded-lg flex items-center justify-center shrink-0`}>
                      <step.icon className={`h-4 w-4 text-${step.color}-600`} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-800">{t[step.nameKey]}</p>
                      <p className="text-xs text-gray-500 truncate">{t[step.descKey]}</p>
                    </div>
                    {idx < 3 && (
                      <ArrowRight className="h-4 w-4 text-gray-300 shrink-0" />
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Stats / Info Bar */}
        <div className="max-w-5xl mx-auto px-4">
          <div className="bg-gradient-to-r from-orange-50 via-white to-blue-50 rounded-2xl border border-gray-100 p-8">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-6 text-center">
              {[
                { value: "6", labelKey: "stat.1.label", subKey: "stat.1.sub" },
                { value: "2", labelKey: "stat.2.label", subKey: "stat.2.sub" },
                { value: "∞", labelKey: "stat.3.label", subKey: "stat.3.sub" },
                { value: "99%", labelKey: "stat.4.label", subKey: "stat.4.sub" },
              ].map((stat, idx) => (
                <div key={idx}>
                  <div className="text-3xl font-bold bg-gradient-to-r from-orange-600 to-blue-600 bg-clip-text text-transparent mb-1">
                    {stat.value}
                  </div>
                  <div className="text-sm font-semibold text-gray-800">{t[stat.labelKey]}</div>
                  <div className="text-xs text-gray-500">{t[stat.subKey]}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-gray-100 bg-white/50 py-8 mt-16">
        <div className="max-w-6xl mx-auto px-4 text-center">
          <p className="text-sm text-gray-500">
            {t["footer.main"]}
          </p>
          <p className="text-xs text-gray-400 mt-2">
            {t["footer.tech"]}
          </p>
        </div>
      </footer>
    </div>
  );
}
