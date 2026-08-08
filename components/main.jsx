import React, { useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import StatsCard from "./StatsCard.jsx";

const fallbackStats = [
  { icon: "sessions", value: 8, label: "Sessions this week", trend: "+12%", tone: "violet", detail: "2 sessions today" },
  { icon: "rating", value: 4.8, label: "Average rating", trend: "+4%", tone: "pink", detail: "From 18 reviews" },
  { icon: "seu", value: 320, label: "SEU balance", trend: "+18", tone: "green", detail: "120 earned this week" },
  { icon: "skills", value: 4, label: "Skills active", trend: "Live", tone: "blue", detail: "2 learning · 2 teaching" }
];

function StatsGrid() {
  const [stats, setStats] = useState(fallbackStats);
  useEffect(() => { fetch('http://localhost:3001/api/dashboard').then(response => response.ok ? response.json() : Promise.reject()).then(data => setStats([{ ...fallbackStats[0], value: data.stats.sessions }, { ...fallbackStats[1], value: data.stats.rating }, { ...fallbackStats[2], value: data.stats.seu }, { ...fallbackStats[3], value: data.stats.skills }])).catch(() => {}); }, []);
  return <section className="react-stats-grid" aria-label="Your HIVE statistics">{stats.map(stat => <StatsCard key={stat.label} {...stat} />)}</section>;
}
const root = document.getElementById("react-stats-root");
if (root) createRoot(root).render(<StatsGrid />);
