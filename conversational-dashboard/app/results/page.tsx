"use client";

import { useSearchParams } from "next/navigation";
import { useEffect, useState, Suspense } from "react";

// Force dynamic rendering for this page
export const dynamic = 'force-dynamic';

import {
  PieChart, Pie, Cell,
  BarChart, Bar,
  LineChart, Line,
  XAxis, YAxis, Tooltip, Legend,
  ResponsiveContainer
} from "recharts";

function ResultsContent() {
  const params = useSearchParams();
  const sql = params.get("sql") || "";

  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState("table");

  // ----------------------------------------------------
  // ALWAYS FETCH RESULTS FROM /api/run-query
  // ----------------------------------------------------
  useEffect(() => {
    async function load() {
      setLoading(true);
      const startTime = Date.now();
      console.log(`[Query Execution] Starting query: ${sql}`);

      const res = await fetch("/api/run-query", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sql }),  // IMPORTANT
      });

      const data = await res.json();
      const duration = Date.now() - startTime;

      console.log(`[Query Execution] Complete in ${duration}ms`);
      console.log(`[Query Execution] Returned ${data.rows?.length || 0} rows`);

      setRows(data.rows || []);
      setLoading(false);
    }

    load();
  }, [sql]);

  if (loading) {
    return (
      <div className="p-10 text-white min-h-screen">
        <h1 className="text-3xl font-bold mb-4">Query Results</h1>
        <p>Loading...</p>
      </div>
    );
  }

  const first = rows[0] || {};

  // ---------------------------------------------
  // BUILD CHART DATA (merchant/category detection)
  // ---------------------------------------------
  let chartData: any[] = [];
  let labelKey = "";
  let valueKey = "";

  if ("merchant_name" in first && "amount" in first) {
    // group by merchant
    const grouped: Record<string, number> = {};
    rows.forEach((r) => {
      grouped[r.merchant_name] = (grouped[r.merchant_name] || 0) + Number(r.amount);
    });

    chartData = Object.entries(grouped).map(([merchant_name, total]) => ({
      merchant_name,
      total,
    }));

    labelKey = "merchant_name";
    valueKey = "total";
  } else if ("label" in first && "value" in first) {
    // aggregated rows (SUM, GROUP BY)
    chartData = rows;
    labelKey = "label";
    valueKey = "value";
  } else {
    // fallback: count occurrences of first column
    const pk = Object.keys(first)[0];
    const counts: Record<string, number> = {};

    rows.forEach((r) => {
      const k = String(r[pk]);
      counts[k] = (counts[k] || 0) + 1;
    });

    chartData = Object.entries(counts).map(([label, value]) => ({ label, value }));
    labelKey = "label";
    valueKey = "value";
  }

  const COLORS = ["#00C49F", "#FFBB28", "#FF8042", "#8884d8", "#82ca9d"];

  return (
    <div className="min-h-screen bg-[#0b1120] text-white p-10">
      <h1 className="text-3xl font-bold mb-4">Query Results</h1>

      <p className="mb-4 text-blue-300">
        <strong>SQL:</strong> {sql}
      </p>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4 mb-8">
        <div className="bg-gray-800 p-4 rounded-lg">
          <p>Total Rows</p>
          <p className="text-2xl font-bold">{rows.length}</p>
        </div>
        <div className="bg-gray-800 p-4 rounded-lg">
          <p>Unique Labels</p>
          <p className="text-2xl font-bold">
            {new Set(chartData.map((d) => d[labelKey])).size}
          </p>
        </div>
        <div className="bg-gray-800 p-4 rounded-lg">
          <p>Numeric Field</p>
          <p className="text-2xl font-bold">{valueKey}</p>
        </div>
      </div>

      {/* View Switch */}
      <div className="mb-4">
        <label className="mr-3">View as:</label>
        <select
          value={view}
          onChange={(e) => setView(e.target.value)}
          className="bg-gray-800 p-2 rounded text-white"
        >
          <option value="table">Table</option>
          <option value="pie">Pie Chart</option>
          <option value="bar">Bar Chart</option>
          <option value="line">Line Chart</option>
        </select>
      </div>

      {/* Table */}
      {view === "table" && (
        <table className="w-full border border-gray-700">
          <thead className="bg-gray-700">
            <tr>
              {Object.keys(first).map((k) => (
                <th key={k} className="border px-3 py-2">{k}</th>
              ))}
            </tr>
          </thead>

          <tbody>
            {rows.map((row, i) => (
              <tr key={i} className="bg-gray-900">
                {Object.entries(row).map(([key, value], idx) => (
                  <td key={idx} className="px-3 py-2 border">
                    {String(value)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {/* Pie */}
      {view === "pie" && (
        <div className="w-full h-[400px] bg-gray-900 p-4 rounded">
          <ResponsiveContainer>
            <PieChart>
              <Pie data={chartData} dataKey={valueKey} nameKey={labelKey} outerRadius={150}>
                {chartData.map((_, i) => (
                  <Cell key={i} fill={COLORS[i % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Bar */}
      {view === "bar" && (
        <div className="w-full h-[400px] bg-gray-900 p-4 rounded">
          <ResponsiveContainer>
            <BarChart data={chartData}>
              <XAxis dataKey={labelKey} />
              <YAxis />
              <Tooltip />
              <Legend />
              <Bar dataKey={valueKey} fill="#82ca9d" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Line */}
      {view === "line" && (
        <div className="w-full h-[400px] bg-gray-900 p-4 rounded">
          <ResponsiveContainer>
            <LineChart data={chartData}>
              <XAxis dataKey={labelKey} />
              <YAxis />
              <Tooltip />
              <Legend />
              <Line type="monotone" dataKey={valueKey} stroke="#00C49F" strokeWidth={2} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}

export default function ResultsPage() {
  return (
    <Suspense fallback={
      <div className="p-10 text-white min-h-screen">
        <h1 className="text-3xl font-bold mb-4">Query Results</h1>
        <p>Loading...</p>
      </div>
    }>
      <ResultsContent />
    </Suspense>
  );
}
