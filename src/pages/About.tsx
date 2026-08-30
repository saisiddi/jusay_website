import { useEffect } from "react";
import { motion } from "framer-motion";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import ShinyText from "@/components/ShinyText";
import { requestDownload } from "@/lib/download";
import { Zap, Globe, Heart, Phone, Mail } from "lucide-react";

/* Download is login-gated, matching every other download button on the site. */
const handleDownloadClick = (e: React.MouseEvent<HTMLAnchorElement>) => {
  e.preventDefault();
  void requestDownload();
};

const fadeUp = {
  hidden: { opacity: 0, y: 30 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { delay: i * 0.1, duration: 0.6, ease: "easeOut" },
  }),
};

const values = [
  {
    icon: Zap,
    title: "Speed & Simplicity",
    desc: "No bloat, no complex setup. Press a hotkey, speak, and your text appears exactly where you need it.",
  },
  {
    icon: Globe,
    title: "Works Everywhere",
    desc: "System-wide integration. Gmail, VS Code, Slack, Word — any text field in any app on Windows or macOS.",
  },
  {
    icon: Heart,
    title: "Built With Passion",
    desc: "Jusay was built by a small team tired of typing. Every feature exists because it was genuinely needed.",
  },
];

const team = [
  { name: "Aishwanth M S", role: "Developer", phone: "+91 8667487210", email: "aishwanth.dev@gmail.com" },
  { name: "Vishwajeeth Rao B", role: "Developer", phone: "+91 8884543690", email: "vishwajeeth.rao.2021@gmail.com" },
  { name: "Govind D S", role: "Marketing & Frontend", phone: "+91 7892873535", email: "govind.dhondale@gmail.com" },
  { name: "Kalmadi Saisiddi", role: "Revenue & Frontend", phone: "+91 8792526242", email: "kalmadisaisiddi@gmail.com" },
];

const initials = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0])
    .join("")
    .toUpperCase();

const About = () => {
  useEffect(() => {
    document.title = "About Jusay — Meet the Team | AI Voice Assistant";
    return () => {
      document.title = "Jusay";
    };
  }, []);

  return (
    <div className="min-h-screen" style={{ backgroundColor: "#faf9ff" }}>
      <Navbar />

      {/* ── Hero ── */}
      <section
        className="bg-grid relative overflow-hidden px-6 pt-36 pb-20 text-center"
        style={{ background: "linear-gradient(180deg, #ede9fe 0%, #faf9ff 100%)" }}
      >
        {/* Decorative layers — same treatment as the home page sections */}
        <div
          className="absolute -top-40 left-1/2 -translate-x-1/2 w-[700px] h-[500px] rounded-full pointer-events-none"
          style={{ background: "radial-gradient(circle, rgba(124,58,237,0.12) 0%, transparent 70%)" }}
        />
        <div className="absolute top-24 left-[8%] w-72 h-44 rounded-full bg-[rgba(124,58,237,0.08)] blur-3xl pointer-events-none" />
        <div className="absolute bottom-10 right-[10%] w-60 h-40 rounded-full bg-[rgba(167,139,250,0.10)] blur-3xl pointer-events-none" />

        <div className="relative z-10 max-w-3xl mx-auto">
          <motion.span
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            className="badge-purple inline-flex mb-5"
          >
            About us
          </motion.span>
          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="text-4xl md:text-6xl font-extrabold tracking-tight leading-[1.08] text-[#2e2d2d]"
          >
            The voice layer for{" "}
            <span className="font-serif-italic italic-shine">
              <ShinyText text="every app." speed={4} color="#7C3AED" shineColor="#c4b5fd" />
            </span>
          </motion.h1>
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="text-[#2e2d2d]/50 text-lg md:text-xl max-w-xl mx-auto mt-5 leading-relaxed"
          >
            Jusay is a universal AI voice assistant that works system-wide on Windows and macOS.
          </motion.p>
        </div>
      </section>

      {/* ── Story ── */}
      <section className="px-6 py-20 md:py-24">
        <div className="max-w-3xl mx-auto">
          <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} variants={fadeUp} custom={0}>
            <span className="badge-purple inline-flex mb-4">Our story</span>
            <h2 className="text-3xl md:text-4xl font-extrabold tracking-tight text-[#2e2d2d] mb-6">
              Why we built Jusay
            </h2>
            <div className="flex flex-col gap-5 text-[#2e2d2d]/70 text-base md:text-lg leading-relaxed">
              <p>
                Jusay was born out of frustration. As developers and creators, we spend hours typing every
                day — emails, code, messages, docs. We kept asking: <em>why type when we can speak 3× faster?</em>
              </p>
              <p>
                Existing voice tools were expensive, didn't work system-wide, or couldn't format text
                properly. So we built Jusay — a universal voice layer that works in{" "}
                <strong className="text-[#2e2d2d]">any</strong> app, understands context, and formats your
                text based on what you're doing.
              </p>
              <p>
                Today it supports many languages, three modes (AI, Grammar, Notes), custom dictionaries,
                snippets, writing styles, and cloud sync — all in a lightweight app that sits quietly in your
                tray until you need it.
              </p>
            </div>
          </motion.div>
        </div>
      </section>

      {/* ── Values ── */}
      <section className="px-6 py-20 md:py-24" style={{ backgroundColor: "#f5f3ff" }}>
        <div className="max-w-5xl mx-auto">
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            variants={fadeUp}
            custom={0}
            className="text-center mb-12"
          >
            <span className="badge-purple inline-flex mb-4">What we believe</span>
            <h2 className="text-3xl md:text-4xl font-extrabold tracking-tight text-[#2e2d2d]">
              Principles we build on
            </h2>
          </motion.div>
          <div className="grid gap-6 md:grid-cols-3">
            {values.map((v, i) => {
              const Icon = v.icon;
              return (
                <motion.div
                  key={v.title}
                  initial="hidden"
                  whileInView="visible"
                  viewport={{ once: true }}
                  variants={fadeUp}
                  custom={i + 1}
                  whileHover={{ y: -4 }}
                  className="rounded-2xl bg-white border border-[rgba(124,58,237,0.1)] shadow-card p-7 transition-all duration-300"
                >
                  <div className="w-11 h-11 rounded-xl flex items-center justify-center mb-4" style={{ background: "rgba(124,58,237,0.1)" }}>
                    <Icon className="w-5 h-5" style={{ color: "#7C3AED" }} strokeWidth={2.2} />
                  </div>
                  <h3 className="text-lg font-bold text-[#2e2d2d] mb-1.5">{v.title}</h3>
                  <p className="text-sm text-[#2e2d2d]/55 leading-relaxed">{v.desc}</p>
                </motion.div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ── Team ── */}
      <section className="px-6 py-20 md:py-24">
        <div className="max-w-5xl mx-auto">
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            variants={fadeUp}
            custom={0}
            className="text-center mb-12"
          >
            <span className="badge-purple inline-flex mb-4">The team</span>
            <h2 className="text-3xl md:text-4xl font-extrabold tracking-tight text-[#2e2d2d]">
              Meet the people behind Jusay
            </h2>
            <p className="text-[#2e2d2d]/50 text-lg max-w-xl mx-auto mt-3">
              A small, passionate team making voice the fastest way to get text into any app.
            </p>
          </motion.div>

          {/* Two columns keep the cards wide enough for the full email on one
              line, which four narrow columns could not do. */}
          <div className="grid gap-5 md:grid-cols-2 max-w-4xl mx-auto">
            {team.map((m, i) => (
              <motion.div
                key={m.name}
                initial="hidden"
                whileInView="visible"
                viewport={{ once: true }}
                variants={fadeUp}
                custom={i + 1}
                whileHover={{ y: -4 }}
                className="flex items-start gap-4 h-full rounded-2xl bg-white border border-[rgba(124,58,237,0.1)] shadow-card p-6 transition-all duration-300"
              >
                <div
                  className="w-12 h-12 shrink-0 rounded-full flex items-center justify-center text-sm font-black"
                  style={{ background: "rgba(124,58,237,0.1)", color: "#7C3AED" }}
                >
                  {initials(m.name)}
                </div>
                <div className="min-w-0">
                  <h3 className="text-base font-bold text-[#2e2d2d] leading-tight">{m.name}</h3>
                  <span
                    className="inline-flex mt-1.5 mb-3 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider"
                    style={{ background: "rgba(124,58,237,0.1)", color: "#7C3AED" }}
                  >
                    {m.role}
                  </span>
                  <div className="flex flex-col gap-1.5">
                    <a
                      href={`tel:${m.phone.replace(/\s+/g, "")}`}
                      className="flex items-center gap-2 text-[13px] text-[#2e2d2d]/65 hover:text-[#7C3AED] transition-colors"
                    >
                      <Phone className="w-3.5 h-3.5 shrink-0" style={{ color: "#7C3AED" }} />
                      {m.phone}
                    </a>
                    <a
                      href={`mailto:${m.email}`}
                      className="flex items-center gap-2 text-[13px] text-[#2e2d2d]/65 hover:text-[#7C3AED] transition-colors"
                    >
                      <Mail className="w-3.5 h-3.5 shrink-0" style={{ color: "#7C3AED" }} />
                      <span className="truncate">{m.email}</span>
                    </a>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Closing CTA — mirrors the home page's download prompt ── */}
      <section className="bg-grid relative overflow-hidden px-6 py-20 md:py-24" style={{ backgroundColor: "#ede9fe" }}>
        <div
          className="absolute -top-32 left-1/2 -translate-x-1/2 w-[600px] h-[400px] rounded-full pointer-events-none"
          style={{ background: "radial-gradient(circle, rgba(124,58,237,0.14) 0%, transparent 70%)" }}
        />
        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true }}
          variants={fadeUp}
          custom={0}
          className="relative z-10 max-w-2xl mx-auto text-center"
        >
          <h2 className="text-3xl md:text-4xl font-extrabold tracking-tight text-[#2e2d2d]">
            Ready to stop typing?
          </h2>
          <p className="text-[#2e2d2d]/50 text-lg mt-3 mb-8">
            Download Jusay and start speaking in any app — free to try.
          </p>
          <motion.a
            href="/login"
            onClick={handleDownloadClick}
            whileHover={{ scale: 1.04, boxShadow: "0 16px 50px rgba(124,58,237,0.3)" }}
            whileTap={{ scale: 0.97 }}
            className="inline-flex items-center justify-center gap-2 px-7 py-3.5 text-sm font-bold text-white"
            style={{ borderRadius: 10, background: "linear-gradient(135deg, #7C3AED, #5b21b6)" }}
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
              <path d="M0 3.449L9.75 2.1v9.451H0m10.949-9.602L24 0v11.4H10.949M0 12.6h9.75v9.451L0 20.699M10.949 12.6H24V24l-12.9-1.801" />
            </svg>
            Download for Windows
          </motion.a>
        </motion.div>
      </section>

      <Footer />
    </div>
  );
};

export default About;
