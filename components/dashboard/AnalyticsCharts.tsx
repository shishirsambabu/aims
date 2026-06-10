"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { Analytics } from "@/lib/data/analytics";

const BRAND = "#0070D2";
const SUCCESS = "#2E844A";
const DANGER = "#C23934";
const PALETTE = [
  "#0070D2", "#2E844A", "#FFB75D", "#9333EA", "#16325C",
  "#0EA5E9", "#C23934", "#14B8A6", "#F59E0B", "#6366F1",
];

function inrCompact(v: number): string {
  const abs = Math.abs(v);
  if (abs >= 1e7) return `₹${(v / 1e7).toFixed(2)}Cr`;
  if (abs >= 1e5) return `₹${(v / 1e5).toFixed(2)}L`;
  if (abs >= 1e3) return `₹${(v / 1e3).toFixed(1)}K`;
  return `₹${v}`;
}

function ChartCard({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">{title}</CardTitle>
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
}

const GRID = "hsl(var(--border))";
const axisProps = {
  tick: { fontSize: 11, fill: "hsl(var(--muted-foreground))" },
  stroke: "hsl(var(--border))",
};

export function AnalyticsCharts({ data }: { data: Analytics }) {
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <ChartCard title="Profit by Container">
        <ResponsiveContainer width="100%" height={300}>
          <BarChart
            data={data.profitByContainer}
            layout="vertical"
            margin={{ left: 8, right: 16 }}
          >
            <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke={GRID} />
            <XAxis type="number" tickFormatter={inrCompact} {...axisProps} />
            <YAxis
              type="category"
              dataKey="name"
              width={96}
              {...axisProps}
            />
            <Tooltip formatter={(value) => inrCompact(Number(value))} />
            <Bar dataKey="value" radius={[0, 3, 3, 0]}>
              {data.profitByContainer.map((d, i) => (
                <Cell key={i} fill={d.value >= 0 ? SUCCESS : DANGER} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </ChartCard>

      <ChartCard title="Profit by Supplier">
        {data.profitBySupplier.length === 0 ? (
          <Empty />
        ) : (
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie
                data={data.profitBySupplier}
                dataKey="value"
                nameKey="name"
                innerRadius={60}
                outerRadius={100}
                paddingAngle={2}
              >
                {data.profitBySupplier.map((_, i) => (
                  <Cell key={i} fill={PALETTE[i % PALETTE.length]} />
                ))}
              </Pie>
              <Tooltip formatter={(value) => inrCompact(Number(value))} />
            </PieChart>
          </ResponsiveContainer>
        )}
      </ChartCard>

      <ChartCard title="Containers by Port">
        <ResponsiveContainer width="100%" height={280}>
          <BarChart data={data.containersByPort} margin={{ left: -16 }}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={GRID} />
            <XAxis dataKey="name" {...axisProps} />
            <YAxis allowDecimals={false} {...axisProps} />
            <Tooltip />
            <Bar dataKey="value" radius={[3, 3, 0, 0]} fill={BRAND} />
          </BarChart>
        </ResponsiveContainer>
      </ChartCard>

      <ChartCard title="Monthly Volume">
        <ResponsiveContainer width="100%" height={280}>
          <LineChart data={data.monthlyVolume} margin={{ left: -16 }}>
            <CartesianGrid strokeDasharray="3 3" stroke={GRID} />
            <XAxis dataKey="month" {...axisProps} />
            <YAxis allowDecimals={false} {...axisProps} />
            <Tooltip />
            <Line
              type="monotone"
              dataKey="count"
              stroke={BRAND}
              strokeWidth={2}
              dot={{ r: 3 }}
            />
          </LineChart>
        </ResponsiveContainer>
      </ChartCard>

      <ChartCard title="Profit Trend">
        <ResponsiveContainer width="100%" height={280}>
          <LineChart data={data.profitTrend} margin={{ left: 8 }}>
            <CartesianGrid strokeDasharray="3 3" stroke={GRID} />
            <XAxis dataKey="month" {...axisProps} />
            <YAxis tickFormatter={inrCompact} width={70} {...axisProps} />
            <Tooltip formatter={(value) => inrCompact(Number(value))} />
            <Line
              type="monotone"
              dataKey="profit"
              stroke={SUCCESS}
              strokeWidth={2}
              dot={{ r: 3 }}
            />
          </LineChart>
        </ResponsiveContainer>
      </ChartCard>
    </div>
  );
}

function Empty() {
  return (
    <div className="flex h-[300px] items-center justify-center text-sm text-muted-foreground">
      No profit data yet.
    </div>
  );
}
