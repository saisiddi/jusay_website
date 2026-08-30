import { animate, motion, useInView } from "framer-motion";
import { Users, Crown } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { fetchPublicStats, type PublicStats } from "@/lib/stats";

/** Counts up from 0 → `to` the first time it scrolls into view. */
const CountUp = ({ to, duration = 1.6 }: { to: number; duration?: number }) => {
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true, margin: "-40px" });
  const [value, setValue] = useState(0);

  useEffect(() => {
    if (!inView) return;
    const controls = animate(0, to, {
      duration,
      ease: [0.22, 1, 0.36, 1],
      onUpdate: (v) => setValue(Math.floor(v)),
    });
    return () => controls.stop();
  }, [inView, to, duration]);

  return <span ref={ref}>{value.toLocaleString("en-IN")}</span>;
};

/** A tiny 5-bar equalizer, echoing the jusay voice mark. */
const MiniWave = ({ color }: { color: string }) => (
  <div className="flex items-end gap-[3px] h-4" aria-hidden>
    {[0, 1, 2, 3, 4].map((i) => (
      <motion.span
        key={i}
        className="w-[3px] rounded-full"
        style={{ background: color }}
        animate={{ height: ["30%", "100%", "45%"] }}
        transition={{
          duration: 1,
          repeat: Infinity,
          repeatType: "mirror",
          ease: "easeInOut",
          delay: i * 0.12,
        }}
      />
    ))}
  </div>
);

type StatCard = {
  key: string;
  icon: typeof Users;
  color: string;
  label: string;
  sub: string;
  value: number;
};

const CommunityStats = () => {
  const [stats, setStats] = useState<PublicStats | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetchPublicStats().then((s) => {
      if (cancelled) return;
      setStats(s);
      setLoaded(true);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  // Backend unreachable (e.g. stats functions not yet installed) → stay quiet
  // rather than render a broken section.
  if (loaded && !stats) return null;

  const meta: Omit<StatCard, "value">[] = [
    {
      key: "members",
      icon: Users,
      color: "#7C3AED",
      label: "Members and counting",
      sub: "Signed up with Google or email",
    },
    {
      key: "pro",
      icon: Crown,
      color: "#059669",
      label: "Pro members",
      sub: "People who upgraded and paid",
    },
  ];

  const valueFor = (key: string): number | null =>
    key === "members" ? stats?.members ?? null : stats?.proMembers ?? null;

  // While loading, show both placeholders; once loaded, drop any metric whose
  // RPC didn't return (e.g. the pro-member function isn't installed yet).
  const cards: StatCard[] = meta
    .filter((m) => !loaded || valueFor(m.key) !== null)
    .map((m) => ({ ...m, value: valueFor(m.key) ?? 0 }));

  if (cards.length === 0) return null;

  return (
    <section className="py-20 md:py-24 px-6 bg-white overflow-hidden">
      <div className="max-w-4xl mx-auto">
        {/* Heading */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-12"
        >
          <span className="badge-purple mb-4 inline-flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-[#7C3AED] animate-pulse" />
            Live count
          </span>
          <h2 className="text-3xl md:text-4xl font-extrabold tracking-tight text-[#2e2d2d] mt-4">
            A voice people keep choosing
          </h2>
          <p className="text-[#2e2d2d]/50 mt-3 text-lg">
            Real numbers, straight from our servers — updated as people download and go Pro.
          </p>
        </motion.div>

        {/* Stat cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
          {cards.map((card, i) => {
            const Icon = card.icon;
            return (
              <motion.div
                key={card.key}
                initial={{ opacity: 0, y: 24 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.12 }}
                whileHover={{ y: -4, boxShadow: `0 18px 44px ${card.color}22` }}
                className="relative p-7 md:p-8 rounded-3xl bg-white border border-[rgba(124,58,237,0.12)] shadow-card transition-all duration-300"
              >
                <div className="flex items-center justify-between mb-5">
                  <div
                    className="w-11 h-11 rounded-2xl flex items-center justify-center"
                    style={{ background: `${card.color}14` }}
                  >
                    <Icon className="w-5 h-5" style={{ color: card.color }} strokeWidth={2.4} />
                  </div>
                  <MiniWave color={card.color} />
                </div>

                <p
                  className="text-5xl md:text-6xl font-black tracking-tight leading-none"
                  style={{ color: card.color }}
                >
                  {loaded ? <CountUp to={card.value} /> : <span className="opacity-30">0</span>}
                </p>

                <p className="mt-3 text-base font-bold text-[#2e2d2d]">{card.label}</p>
                <p className="text-sm text-[#2e2d2d]/45 leading-snug">{card.sub}</p>
              </motion.div>
            );
          })}
        </div>
      </div>
    </section>
  );
};

export default CommunityStats;
