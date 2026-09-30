"use client";

import { BarElement, CategoryScale, Chart as ChartJS, LineElement, LinearScale, PointElement, Tooltip, type Plugin } from "chart.js";
import { useEffect, useState } from "react";
import { Bar, Line } from "react-chartjs-2";

ChartJS.register(BarElement, CategoryScale, LineElement, LinearScale, PointElement, Tooltip);

/** Явный контракт: сервер передаёт только подготовленные числа и подписи. */
export type FunnelChartProps = {
  labels: string[];
  /** Объём денег, дошедший до этапа и дальше. */
  sums: number[];
  counts: number[];
  colors: string[];
  /** Отказы выводятся отдельным числом, в воронку не входят. */
  refusals: { count: number; sum: number };
};
export type TrendChartProps = { title: string; labels: string[]; values: number[]; counts: number[]; color: string; stepLabel: string };

const rub = (n: number) => new Intl.NumberFormat("ru-RU", { style: "currency", currency: "RUB", maximumFractionDigits: 0 }).format(n);

/** Цвета текста берём из CSS-переменных темы, чтобы диаграммы читались и в тёмной теме. */
function useThemeColors() {
  const [colors, setColors] = useState({ text: "#3A2A1E", muted: "#85766A", line: "rgba(90,64,40,.12)" });
  useEffect(() => {
    const read = () => {
      const s = getComputedStyle(document.documentElement);
      setColors({
        text: s.getPropertyValue("--text").trim() || "#3A2A1E",
        muted: s.getPropertyValue("--text-muted").trim() || "#85766A",
        line: s.getPropertyValue("--line").trim() || "rgba(90,64,40,.12)",
      });
    };
    read();
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    mq.addEventListener("change", read);
    return () => mq.removeEventListener("change", read);
  }, []);
  return colors;
}

/** Короткая запись денег: 8,94 млн ₽, 450 тыс ₽. */
function compactRub(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toLocaleString("ru-RU", { maximumFractionDigits: 2 })} млн ₽`;
  if (n >= 1_000) return `${Math.round(n / 1_000).toLocaleString("ru-RU")} тыс ₽`;
  return `${Math.round(n)} ₽`;
}

function pluralDeals(n: number): string {
  const m10 = n % 10;
  const m100 = n % 100;
  if (m10 === 1 && m100 !== 11) return `${n} сделка`;
  if (m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14)) return `${n} сделки`;
  return `${n} сделок`;
}

/** Светлый или тёмный текст поверх цвета столбца. */
function textOn(hex: string): string {
  const n = parseInt(hex.slice(1), 16);
  const lum = 0.299 * ((n >> 16) & 255) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255);
  return lum > 150 ? "#3A2A1E" : "#FFFFFF";
}

export function FunnelChart({ labels, sums, counts, colors, refusals }: FunnelChartProps) {
  const theme = useThemeColors();
  const max = Math.max(...sums, 1);
  // Минимальная ширина столбца, чтобы подпись помещалась даже у маленьких объёмов.
  const widths = sums.map((v) => Math.max(v, max * 0.16));

  const valueLabels: Plugin<"bar"> = {
    id: "funnelValueLabels",
    afterDatasetsDraw(chart) {
      const { ctx } = chart;
      chart.getDatasetMeta(0).data.forEach((bar, i) => {
        const center = (bar as BarElement).getCenterPoint();
        if (center.x === null || center.y === null) return;
        const { x, y } = center;
        ctx.save();
        ctx.fillStyle = textOn(colors[i] ?? "#6F97A8");
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.font = "600 15px Inter, system-ui, sans-serif";
        ctx.fillText(compactRub(sums[i] ?? 0), x, y - 8);
        ctx.font = "400 11px Inter, system-ui, sans-serif";
        ctx.fillText(pluralDeals(counts[i] ?? 0), x, y + 10);
        ctx.restore();
      });
    },
  };

  return (
    <div
      className="chart-frame"
      role="img"
      aria-label={`Воронка продаж по объёму денег: ${labels.map((l, i) => `${l} ${compactRub(sums[i] ?? 0)}`).join(", ")}. Отказы: ${compactRub(refusals.sum)}, ${pluralDeals(refusals.count)}`}
    >
      <div className="chart-fill">
      <Bar
        plugins={[valueLabels]}
        data={{
          labels,
          datasets: [{ label: "Объём, ₽", data: widths.map((w) => [-w / 2, w / 2]), backgroundColor: colors, borderRadius: 6, barPercentage: 0.86, categoryPercentage: 1 }],
        }}
        options={{
          indexAxis: "y",
          responsive: true,
          maintainAspectRatio: false,
          layout: { padding: { bottom: 40 } },
          plugins: {
            legend: { display: false },
            tooltip: {
              callbacks: {
                label: (ctx) => `Объём: ${rub(sums[ctx.dataIndex] ?? 0)}`,
                afterLabel: (ctx) => pluralDeals(counts[ctx.dataIndex] ?? 0),
              },
            },
          },
          scales: {
            x: { display: false, min: -max * 0.55, max: max * 0.55 },
            y: { ticks: { color: theme.muted, font: { size: 12 } }, grid: { display: false }, border: { display: false } },
          },
        }}
      />
      </div>
      <div className="chart-badge" title="Проигранные сделки в воронку не входят">
        Отказы: <b>{compactRub(refusals.sum)}</b> · {pluralDeals(refusals.count)}
      </div>
    </div>
  );
}

export function TrendChart({ title, labels, values, counts, color, stepLabel }: TrendChartProps) {
  const theme = useThemeColors();
  // При большом числе точек (шаг «по дням») уменьшаем маркеры и подписываем значения, только если их немного.
  const dense = labels.length > 16;
  const nonZero = values.filter((v) => v > 0).length;
  const showValueLabels = !dense || nonZero <= 6;

  const pointLabels: Plugin<"line"> = {
    id: "trendPointLabels",
    afterDatasetsDraw(chart) {
      const { ctx } = chart;
      chart.getDatasetMeta(0).data.forEach((point, i) => {
        const v = values[i] ?? 0;
        if (v <= 0 || !showValueLabels) return;
        ctx.save();
        ctx.fillStyle = theme.text;
        ctx.textAlign = "center";
        ctx.textBaseline = "bottom";
        ctx.font = "500 10px Inter, system-ui, sans-serif";
        ctx.fillText(compactRub(v).replace(" ₽", ""), point.x, point.y - 7);
        ctx.restore();
      });
    },
  };

  return (
    <div className="trend">
      <h3 className="trend-title" style={{ color }}>
        {title}
      </h3>
      <div style={{ height: 150 }} role="img" aria-label={`Динамика объёма на этапе «${title}» ${stepLabel}: ${labels.map((l, i) => `${l} ${compactRub(values[i] ?? 0)}`).join(", ")}`}>
        <Line
          plugins={[pointLabels]}
          data={{
            labels,
            datasets: [
              { label: "Объём, ₽", data: values, borderColor: color, backgroundColor: color, pointBackgroundColor: color, pointRadius: dense ? 2 : 4, pointHoverRadius: 6, borderWidth: 2.5, tension: 0.2 },
            ],
          }}
          options={{
            responsive: true,
            maintainAspectRatio: false,
            layout: { padding: { top: 16, left: 22, right: 22 } },
            plugins: {
              legend: { display: false },
              tooltip: { callbacks: { label: (ctx) => `Объём: ${rub(values[ctx.dataIndex] ?? 0)}`, afterLabel: (ctx) => pluralDeals(counts[ctx.dataIndex] ?? 0) } },
            },
            scales: {
              x: { ticks: { color: theme.muted, font: { size: 10 }, maxRotation: 0, autoSkip: true, maxTicksLimit: 10 }, grid: { color: theme.line } },
              y: { beginAtZero: true, ticks: { display: false }, grid: { color: theme.line }, border: { display: false }, grace: "15%" },
            },
          }}
        />
      </div>
    </div>
  );
}
