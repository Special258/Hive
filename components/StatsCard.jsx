import React, { useEffect, useState } from "react";

const iconPaths = {
  sessions: <path d="M20 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h13a2 2 0 0 1 2 2z" />,
  rating: <path d="M12 2.5l2.95 5.98 6.6.96-4.78 4.66 1.13 6.58L12 17.58l-5.9 3.1 1.13-6.58-4.78-4.66 6.6-.96L12 2.5z" />,
  seu: <><circle cx="12" cy="12" r="9" /><path d="M8.5 12.25 10.75 14.5 15.75 9.5" /></>,
  skills: <><circle cx="8.5" cy="8.5" r="2.5" /><circle cx="16.5" cy="10.5" r="2.5" /><path d="M4 20v-.5A3.5 3.5 0 0 1 7.5 16H9M13 20v-.5a3.5 3.5 0 0 1 3.5-3.5H17" /></>
};

function useCountUp(value) {
  const [display, setDisplay] = useState("0");
  useEffect(() => {
    const target = Number(value), started = performance.now(), duration = 650;
    let frame;
    const tick = now => {
      const progress = Math.min((now - started) / duration, 1);
      const number = target * (1 - Math.pow(1 - progress, 3));
      setDisplay(Number.isInteger(target) ? String(Math.round(number)) : number.toFixed(1));
      if (progress < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [value]);
  return display;
}

export default function StatsCard({ icon, value, label, trend, tone = "violet", detail }) {
  const animatedValue = useCountUp(value);
  return <article className={`react-stat-card react-stat-${tone}`}>
    <div className="react-stat-top"><span className="react-stat-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">{iconPaths[icon]}</svg></span><span className={`react-stat-trend ${trend.startsWith("+") ? "positive" : "neutral"}`}>{trend}</span></div>
    <div className="react-stat-value">{animatedValue}</div><div className="react-stat-label">{label}</div><div className="react-stat-detail"><span></span>{detail}</div>
  </article>;
}
