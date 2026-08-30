import { useEffect } from "react";
import { motion } from "framer-motion";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
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
    desc: "System-wide integration. Gmail, VS Code, Slack, Word - any text field in any application on Windows or macOS.",
  },
  {
    icon: Heart,
    title: "Built With Passion",
    desc: "Jusay was built by a small team who were tired of typing. Every feature exists because it was needed.",
  },
];

const team = [
  {
    name: "Aishwanth M S",
    role: "Developer",
    phone: "+91 8667487210",
    email: "aishwanth.dev@gmail.com",
  },
  {
    name: "Vishwajeeth Rao B",
    role: "Developer",
    phone: "+91 8884543690",
    email: "vishwajeeth.rao.2021@gmail.com",
  },
  {
    name: "Govind D S",
    role: "Marketing & Frontend",
    phone: "+91 7892873535",
    email: "govind.dhondale@gmail.com",
  },
  {
    name: "Kalmadi Saisiddi",
    role: "Revenue & Frontend",
    phone: "+91 8792526242",
    email: "kalmadisaisiddi@gmail.com",
  },
];

const About = () => {
  useEffect(() => {
    document.title = "About Jusay - Meet the Founders | AI Voice Assistant";
    return () => { document.title = "Jusay"; };
  }, []);

  return (
    <div className="min-h-screen" style={{ backgroundColor: "#faf9ff" }}>
      <Navbar />

      {/* Hero */}
      <section
        style={{
          paddingTop: 140,
          paddingBottom: 80,
          background: "linear-gradient(180deg, #ede9fe 0%, #faf9ff 100%)",
        }}
      >
        <div style={{ maxWidth: 800, margin: "0 auto", padding: "0 24px", textAlign: "center" }}>
          <motion.span
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="badge-purple"
            style={{ marginBottom: 20, display: "inline-flex" }}
          >
            About Us
          </motion.span>
          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            style={{
              fontSize: 48,
              fontWeight: 800,
              letterSpacing: "-0.03em",
              lineHeight: 1.15,
              marginTop: 16,
              color: "#2e2d2d",
            }}
          >
            We're building the voice layer for every app
          </motion.h1>
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            style={{
              fontSize: 18,
              color: "rgba(46,45,45,0.6)",
              marginTop: 20,
              lineHeight: 1.7,
              maxWidth: 600,
              marginLeft: "auto",
              marginRight: "auto",
            }}
          >
            Jusay is a universal AI-powered voice assistant that works system-wide on Windows and macOS.
          </motion.p>
        </div>
      </section>

      {/* Story Section */}
      <section style={{ padding: "80px 24px", maxWidth: 800, margin: "0 auto" }}>
        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true }}
          variants={fadeUp}
          custom={0}
        >
          <h2 style={{ fontSize: 32, fontWeight: 700, marginBottom: 20, color: "#2e2d2d" }}>Our Story</h2>
          <div
            style={{
              fontSize: 16,
              lineHeight: 1.8,
              color: "#444",
              display: "flex",
              flexDirection: "column",
              gap: 16,
            }}
          >
            <p>
              Jusay was born out of frustration. As developers and content creators, we spend
              hours typing every day - emails, code comments, messages, documents. We thought:
              <em> why are we still typing when we can speak 3x faster?</em>
            </p>
            <p>
              Existing voice-to-text tools were either too expensive ($15+/month), didn't work
              system-wide, or lacked the intelligence to format text properly. So we built Jusay —
              a universal voice layer that works in <strong>any</strong> app, understands context,
              and intelligently formats your text based on what you're doing.
            </p>
            <p>
              Today, Jusay supports a wide range of languages, three distinct modes (AI, Grammar, Notes),
              custom dictionaries, text snippets, writing styles, and cloud sync - all in a
              lightweight desktop app that sits quietly in your system tray until you need it.
            </p>
          </div>
        </motion.div>
      </section>

      {/* Values Grid */}
      <section
        style={{
          padding: "80px 24px",
          backgroundColor: "#f5f3ff",
        }}
      >
        <div style={{ maxWidth: 900, margin: "0 auto" }}>
          <motion.h2
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            variants={fadeUp}
            custom={0}
            style={{ fontSize: 32, fontWeight: 700, textAlign: "center", marginBottom: 48, color: "#2e2d2d" }}
          >
            What We Believe
          </motion.h2>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
              gap: 24,
            }}
          >
            {values.map((v, i) => (
              <motion.div
                key={v.title}
                initial="hidden"
                whileInView="visible"
                viewport={{ once: true }}
                variants={fadeUp}
                custom={i + 1}
                style={{
                  padding: 32,
                  borderRadius: 16,
                  backgroundColor: "#fff",
                  border: "1px solid rgba(124,58,237,0.1)",
                  boxShadow: "0 2px 12px rgba(124,58,237,0.06)",
                }}
              >
                <div
                  style={{
                    width: 48,
                    height: 48,
                    borderRadius: 12,
                    backgroundColor: "rgba(124,58,237,0.1)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    marginBottom: 16,
                  }}
                >
                  <v.icon style={{ width: 22, height: 22, color: "#7C3AED" }} />
                </div>
                <h3 style={{ fontSize: 18, fontWeight: 700, marginBottom: 8, color: "#2e2d2d" }}>{v.title}</h3>
                <p style={{ fontSize: 14, color: "#555", lineHeight: 1.7 }}>
                  {v.desc}
                </p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Meet the Founders Section */}
      <section style={{ padding: "80px 24px", maxWidth: 960, margin: "0 auto" }}>
        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true }}
          variants={fadeUp}
          custom={0}
        >
          <h2 style={{ fontSize: 32, fontWeight: 700, marginBottom: 12, textAlign: "center", color: "#2e2d2d" }}>
            Meet the Team
          </h2>
          <p
            style={{
              fontSize: 16,
              color: "#666",
              textAlign: "center",
              marginBottom: 40,
              maxWidth: 560,
              marginLeft: "auto",
              marginRight: "auto",
            }}
          >
            We're a small, passionate team on a mission to make voice the fastest way to get text into any app.
          </p>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
              gap: 24,
            }}
          >
            {team.map((f, i) => (
              <motion.div
                key={f.name}
                initial="hidden"
                whileInView="visible"
                viewport={{ once: true }}
                variants={fadeUp}
                custom={i + 1}
                style={{
                  padding: 28,
                  borderRadius: 16,
                  backgroundColor: "#fff",
                  border: "1px solid rgba(124,58,237,0.1)",
                  boxShadow: "0 4px 20px rgba(124,58,237,0.08)",
                  display: "flex",
                  flexDirection: "column",
                  height: "100%",
                }}
              >
                <h3 style={{ fontSize: 20, fontWeight: 700, marginBottom: 4, color: "#2e2d2d" }}>{f.name}</h3>
                <p style={{ fontSize: 13, color: "#7C3AED", fontWeight: 600, marginBottom: 18 }}>
                  {f.role}
                </p>
                <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: "auto" }}>
                  <a
                    href={`tel:${f.phone.replace(/\s+/g, "")}`}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 8,
                      color: "#555",
                      fontSize: 14,
                      textDecoration: "none",
                    }}
                  >
                    <Phone style={{ width: 15, height: 15, color: "#7C3AED", flexShrink: 0 }} />
                    {f.phone}
                  </a>
                  <a
                    href={`mailto:${f.email}`}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 8,
                      color: "#555",
                      fontSize: 14,
                      textDecoration: "none",
                      wordBreak: "break-all",
                    }}
                  >
                    <Mail style={{ width: 15, height: 15, color: "#7C3AED", flexShrink: 0 }} />
                    {f.email}
                  </a>
                </div>
              </motion.div>
            ))}
          </div>
        </motion.div>
      </section>

      <Footer />
    </div>
  );
};

export default About;
