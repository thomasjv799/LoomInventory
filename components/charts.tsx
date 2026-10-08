"use client";
import { useState } from "react";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  BarChart,
  Bar,
  ReferenceArea,
  ReferenceLine,
} from "recharts";
import { Button } from "./ui/button";
import { Table2, ChartNoAxesCombined } from "lucide-react";
export function ReportChart({
  data,
  x = "name",
  y = "units",
  label,
  kind = "bar",
  events = [],
}: {
  data: Record<string, any>[];
  x?: string;
  y?: string;
  label: string;
  kind?: "bar" | "area";
  events?: { start: string; end: string; name: string }[];
}) {
  const [table, setTable] = useState(false);
  return (
    <div className="chart-wrapper">
      <div className="chart-controls">
        <span>{label}</span>
        <Button
          size="sm"
          variant="ghost"
          onClick={() => setTable(!table)}
          aria-label={
            table ? "Show " + label + " chart" : "Show " + label + " data table"
          }
        >
          {table ? <ChartNoAxesCombined size={14} /> : <Table2 size={14} />}{" "}
          {table ? "Chart" : "Data table"}
        </Button>
      </div>
      {!data.length ? (
        <div className="empty-state">Insufficient data for this selection.</div>
      ) : table ? (
        <div className="table-scroll chart-data" tabIndex={0}>
          <table>
            <caption className="sr-only">{label}</caption>
            <thead>
              <tr>
                <th>{x}</th>
                <th>{y}</th>
              </tr>
            </thead>
            <tbody>
              {data.map((r, i) => (
                <tr key={i}>
                  <td>{String(r[x])}</td>
                  <td>{r[y]}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div
          className="chart"
          role="img"
          aria-label={label + ". Use the Data table button for the values."}
        >
          <ResponsiveContainer width="100%" height={220}>
            {kind === "area" ? (
              <AreaChart
                data={data}
                margin={{ top: 10, right: 12, left: -22, bottom: 0 }}
              >
                <defs>
                  <linearGradient id="bronze" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#946A35" stopOpacity={0.24} />
                    <stop
                      offset="100%"
                      stopColor="#946A35"
                      stopOpacity={0.015}
                    />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke="#EEECE6" vertical={false} />
                <XAxis
                  dataKey={x}
                  tickFormatter={(v) => (x === "date" ? String(v).slice(5) : v)}
                  tick={{ fill: "#657078", fontSize: 11 }}
                  axisLine={false}
                  tickLine={false}
                  minTickGap={35}
                />
                <YAxis
                  tick={{ fill: "#657078", fontSize: 11 }}
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip
                  contentStyle={{
                    borderRadius: 10,
                    border: "1px solid #E7E3DC",
                    fontSize: 12,
                  }}
                />
                {events.map((e, i) =>
                  e.start === e.end ? (
                    <ReferenceLine
                      key={i}
                      x={e.start}
                      stroke="#708E7B"
                      strokeDasharray="4 4"
                      label={{
                        value: e.name,
                        position: "insideTopRight",
                        fontSize: 9,
                      }}
                    />
                  ) : (
                    <ReferenceArea
                      key={i}
                      x1={e.start}
                      x2={e.end}
                      fill="#946A35"
                      fillOpacity={0.07}
                      label={{
                        value: e.name,
                        position: "insideTop",
                        fontSize: 9,
                      }}
                    />
                  ),
                )}
                <Area
                  type="monotone"
                  dataKey={y}
                  name="Units"
                  stroke="#946A35"
                  strokeWidth={2}
                  fill="url(#bronze)"
                  isAnimationActive={false}
                />
              </AreaChart>
            ) : (
              <BarChart
                data={data}
                margin={{ top: 10, right: 10, left: -22, bottom: 0 }}
              >
                <CartesianGrid stroke="#EEECE6" vertical={false} />
                <XAxis
                  dataKey={x}
                  tick={{ fill: "#657078", fontSize: 10 }}
                  axisLine={false}
                  tickLine={false}
                  interval={0}
                />
                <YAxis
                  tick={{ fill: "#657078", fontSize: 11 }}
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip
                  contentStyle={{
                    borderRadius: 10,
                    border: "1px solid #E7E3DC",
                    fontSize: 12,
                  }}
                />
                <Bar
                  dataKey={y}
                  name="Units"
                  fill="#946A35"
                  radius={[4, 4, 0, 0]}
                  maxBarSize={40}
                  isAnimationActive={false}
                />
              </BarChart>
            )}
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}
