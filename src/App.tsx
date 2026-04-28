import { useEffect, useState } from 'react';
import { fetchApi } from './api';
import { Users, Globe, TrendingUp, DollarSign } from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  AreaChart, Area,
} from 'recharts';

interface DashboardData {
  kpis: { totalCustomers: number; countries: number; totalRevenue: number; recentCustomers: number };
  byCountry: { country: string; count: number }[];
  monthlyTrend: { month: string; customers: number }[];
  topCustomers: { name: string; email: string; country: string; charges: number; revenue: number }[];
}

function KpiCard({ icon: Icon, label, value, color }: { icon: typeof Users; label: string; value: string; color: string }) {
  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
      <div className="flex items-center gap-4">
        <div className={`p-3 rounded-lg ${color}`}>
          <Icon className="w-6 h-6 text-white" />
        </div>
        <div>
          <p className="text-sm text-gray-500 font-medium">{label}</p>
          <p className="text-2xl font-bold text-gray-900">{value}</p>
        </div>
      </div>
    </div>
  );
}

function formatCurrency(cents: number) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 0 }).format(cents / 100);
}

export default function App() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchApi<DashboardData>('/api/dashboard')
      .then(setData)
      .catch((err) => setError(String(err)));
  }, []);

  if (error) return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="bg-white p-8 rounded-xl shadow-sm border border-red-200 max-w-md">
        <h2 className="text-lg font-semibold text-red-600 mb-2">Error loading dashboard</h2>
        <p className="text-gray-600 text-sm">{error}</p>
      </div>
    </div>
  );

  if (!data) return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="flex flex-col items-center gap-3">
        <div className="w-8 h-8 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin" />
        <p className="text-gray-500 font-medium">Loading dashboard...</p>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-6 py-5 flex items-center gap-3">
          <div className="p-2 bg-indigo-600 rounded-lg">
            <Users className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-gray-900">Stripe Customers</h1>
            <p className="text-sm text-gray-500">Customer analytics dashboard</p>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-8 space-y-8">
        {/* KPI Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
          <KpiCard icon={Users} label="Total Customers" value={data.kpis.totalCustomers.toLocaleString()} color="bg-indigo-500" />
          <KpiCard icon={Globe} label="Countries" value={data.kpis.countries.toString()} color="bg-emerald-500" />
          <KpiCard icon={DollarSign} label="Total Revenue" value={formatCurrency(data.kpis.totalRevenue)} color="bg-amber-500" />
          <KpiCard icon={TrendingUp} label="Last 30 Days" value={`+${data.kpis.recentCustomers}`} color="bg-rose-500" />
        </div>

        {/* Charts Row */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Customers by Country */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
            <h2 className="text-base font-semibold text-gray-900 mb-4">Customers by Country</h2>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={data.byCountry.slice(0, 10)} layout="vertical" margin={{ left: 10, right: 20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis type="number" tick={{ fontSize: 12 }} />
                <YAxis dataKey="country" type="category" width={35} tick={{ fontSize: 12 }} />
                <Tooltip
                  contentStyle={{ borderRadius: '8px', border: '1px solid #e5e7eb', boxShadow: '0 2px 8px rgba(0,0,0,0.08)' }}
                />
                <Bar dataKey="count" fill="#6366f1" radius={[0, 4, 4, 0]} name="Customers" />
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Monthly Trend */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
            <h2 className="text-base font-semibold text-gray-900 mb-4">Monthly New Customers</h2>
            <ResponsiveContainer width="100%" height={300}>
              <AreaChart data={data.monthlyTrend} margin={{ left: 0, right: 20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="month" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} />
                <Tooltip
                  contentStyle={{ borderRadius: '8px', border: '1px solid #e5e7eb', boxShadow: '0 2px 8px rgba(0,0,0,0.08)' }}
                />
                <Area type="monotone" dataKey="customers" stroke="#6366f1" fill="#eef2ff" strokeWidth={2} name="New Customers" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Top Customers Table */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <h2 className="text-base font-semibold text-gray-900 mb-4">Top Customers by Revenue</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100">
                  <th className="text-left py-3 px-4 font-semibold text-gray-600">Customer</th>
                  <th className="text-left py-3 px-4 font-semibold text-gray-600">Email</th>
                  <th className="text-left py-3 px-4 font-semibold text-gray-600">Country</th>
                  <th className="text-right py-3 px-4 font-semibold text-gray-600">Charges</th>
                  <th className="text-right py-3 px-4 font-semibold text-gray-600">Revenue</th>
                </tr>
              </thead>
              <tbody>
                {data.topCustomers.map((c, i) => (
                  <tr key={i} className="border-b border-gray-50 hover:bg-gray-50 transition-colors">
                    <td className="py-3 px-4 font-medium text-gray-900">{c.name || '—'}</td>
                    <td className="py-3 px-4 text-gray-500">{c.email || '—'}</td>
                    <td className="py-3 px-4 text-gray-500">{c.country || '—'}</td>
                    <td className="py-3 px-4 text-right text-gray-700">{c.charges}</td>
                    <td className="py-3 px-4 text-right font-medium text-gray-900">{formatCurrency(c.revenue)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </main>
    </div>
  );
}
