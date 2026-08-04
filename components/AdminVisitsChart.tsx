"use client";

import { useMemo, useState } from "react";
import type { VisitPoint } from "@/lib/analyticsStore";

type AdminVisitsChartProps = {
  visits: VisitPoint[];
};

const ranges = [
  { label: "Semanal", days: 7 },
  { label: "Mensual", days: 30 },
  { label: "90 dias", days: 90 }
];

export function AdminVisitsChart({ visits }: AdminVisitsChartProps) {
  const [days, setDays] = useState(30);
  const visibleVisits = useMemo(() => visits.slice(-days), [days, visits]);
  const maxVisits = Math.max(1, ...visibleVisits.map((item) => item.visits));
  const totalVisits = visibleVisits.reduce((sum, item) => sum + item.visits, 0);
  const averageVisits = visibleVisits.length ? Math.round(totalVisits / visibleVisits.length) : 0;

  return (
    <section className="adminPanel analyticsChartPanel visitsChartPanel">
      <div className="panelHead analyticsPanelHead">
        <div>
          <h2>Visitas por dia</h2>
          <span>Datos propios registrados por la tienda.</span>
        </div>
        <div className="analyticsRangeTabs" aria-label="Rango de visitas">
          {ranges.map((range) => (
            <button
              className={days === range.days ? "active" : ""}
              key={range.days}
              onClick={() => setDays(range.days)}
              type="button"
            >
              {range.label}
            </button>
          ))}
        </div>
      </div>

      <div className="visitChartStats">
        <article>
          <span>Visitas del periodo</span>
          <strong>{totalVisits}</strong>
        </article>
        <article>
          <span>Promedio diario</span>
          <strong>{averageVisits}</strong>
        </article>
        <article>
          <span>Mejor dia</span>
          <strong>{Math.max(...visibleVisits.map((item) => item.visits), 0)}</strong>
        </article>
      </div>

      <div className="visitsChart" aria-label="Grafico de visitas por dia">
        {visibleVisits.map((point) => (
          <div className="visitBar" key={point.date} title={`${point.label}: ${point.visits} visitas`}>
            <span>{point.visits}</span>
            <i style={{ height: `${Math.max(5, (point.visits / maxVisits) * 100)}%` }} />
            <small>{point.label}</small>
          </div>
        ))}
      </div>

      <div className="rawVisitData">
        {visibleVisits.map((point) => (
          <span key={`${point.date}-raw`}>
            {point.label}: <strong>{point.visits}</strong>
          </span>
        ))}
      </div>
    </section>
  );
}
