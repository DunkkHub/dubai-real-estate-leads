"use client";

import { Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

const colors = ["#047857", "#0e7490", "#b45309", "#be123c", "#4338ca", "#57534e"];

export function SourcePerformanceChart({ data }: { data: Array<{ source: string; opportunities: number; leads: number }> }) {
  return (
    <div className="h-72 w-full" role="img" aria-label="Source performance bar chart">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
          <CartesianGrid stroke="#e7e5e4" vertical={false} />
          <XAxis dataKey="source" tick={{ fontSize: 12 }} />
          <YAxis tick={{ fontSize: 12 }} allowDecimals={false} />
          <Tooltip />
          <Bar dataKey="opportunities" fill="#0e7490" radius={[4, 4, 0, 0]} />
          <Bar dataKey="leads" fill="#047857" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export function LeadStagesChart({ data }: { data: Array<{ stage: string; count: number }> }) {
  return (
    <div className="h-72 w-full" role="img" aria-label="Lead stages pie chart">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie data={data} dataKey="count" nameKey="stage" innerRadius={58} outerRadius={92} paddingAngle={2}>
            {data.map((_, index) => (
              <Cell key={index} fill={colors[index % colors.length]} />
            ))}
          </Pie>
          <Tooltip />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}
