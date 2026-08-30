import { useEffect } from "react";
import { motion } from "framer-motion";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import ShinyText from "@/components/ShinyText";
import { Zap, Globe, Heart, Phone, Mail } from "lucide-react";

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
        className="bg-grid px-6 pt-36 pb-20 text-center"
        style={{ background: "linear-gradient(180deg, #ede9fe 0%, #faf9ff 100%)" }}
      >
        <div className="max-w-3xl mx-auto">
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

          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {team.map((m, i) => (
              <motion.div
                key={m.name}
                initial="hidden"
                whileInView="visible"
                viewport={{ once: true }}
                variants={fadeUp}
                custom={i + 1}
                whileHover={{ y: -4 }}
                className="flex flex-col rounded-2xl bg-white border border-[rgba(124,58,237,0.1)] shadow-card p-6 transition-all duration-300"
              >
                <div
                  className="w-12 h-12 rounded-full flex items-center justify-center text-sm font-black mb-4"
                  style={{ background: "rgba(124,58,237,0.1)", color: "#7C3AED" }}
                >
                  {initials(m.name)}
                </div>
                <h3 className="text-base font-bold text-[#2e2d2d] leading-tight">{m.name}</h3>
                <span
                  className="inline-flex self-start mt-2 mb-4 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider"
                  style={{ background: "rgba(124,58,237,0.1)", color: "#7C3AED" }}
                >
                  {m.role}
                </span>
                <div className="mt-auto flex flex-col gap-2">
                  <a href={`tel:${m.phone.replace(/\s+/g, "")}`} className="flex items-center gap-2 text-[13px] text-[#2e2d2d]/65 hover:text-[#7C3AED] transition-colors">
                    <Phone className="w-4 h-4 shrink-0" style={{ color: "#7C3AED" }} />
                    {m.phone}
                  </a>
                  <a href={`mailto:${m.email}`} className="flex items-center gap-2 text-[13px] text-[#2e2d2d]/65 hover:text-[#7C3AED] transition-colors break-all">
                    <Mail className="w-4 h-4 shrink-0" style={{ color: "#7C3AED" }} />
                    {m.email}
                  </a>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
};

export default About;
