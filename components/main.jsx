import React, { useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import StatsCard from "./StatsCard.jsx";
import { api } from "../services/api.js";

const fallbackStats = [
  { icon: "sessions", value: 0, label: "Sessions this week", trend: "+0%", tone: "violet", detail: "0 sessions today" },
  { icon: "rating", value: 0.0, label: "Average rating", trend: "0%", tone: "pink", detail: "From 0 reviews" },
  { icon: "seu", value: 0, label: "SEU balance", trend: "+0", tone: "green", detail: "0 earned this week" },
  { icon: "skills", value: 0, label: "Skills active", trend: "Live", tone: "blue", detail: "0 learning · 0 teaching" }
];

function StatsGrid() {
  const [stats, setStats] = useState(fallbackStats);
  useEffect(() => {
    api.get('/dashboard')
    .then(data =>
      setStats([
        { ...fallbackStats[0], value: data.stats.sessions },
        { ...fallbackStats[1], value: data.stats.rating },
        { ...fallbackStats[2], value: data.stats.seu },
        { ...fallbackStats[3], value: data.stats.skills }
      ])
    )
    .catch(() => {});
}, []);
  return <section className="react-stats-grid" aria-label="Your HIVE statistics">{stats.map(stat => <StatsCard key={stat.label} {...stat} />)}</section>;
}
const root = document.getElementById("react-stats-root");
if (root) createRoot(root).render(<StatsGrid />);
