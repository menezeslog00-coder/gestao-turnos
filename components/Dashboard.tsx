
import React, { useState } from 'react';
import { ShiftData } from '../types';
import { Card, CardContent, CardHeader, Button } from './ui';
import { BarChart3, TrendingUp, Users, Package, Star, ArrowLeft, X, Eye, RefreshCw } from 'lucide-react';
import { PassagemDeTurnoCard } from './ShiftSummary';

interface DashboardProps {
  history: ShiftData[];
  onBack: () => void;
  onRefresh?: () => void;
}

const formatDate = (dateStr: any) => {
  if (!dateStr) return '---';
  let str = String(dateStr);
  if (/^\d{2}\/\d{2}\/\d{4}$/.test(str)) return str;
  const pure = str.includes('T') ? str.split('T')[0] : str;
  if (/^\d{4}-\d{2}-\d{2}$/.test(pure)) {
    const [y, m, d] = pure.split('-');
    return `${d}/${m}/${y}`;
  }
  return str;
};

export const Dashboard: React.FC<DashboardProps> = ({ history, onBack, onRefresh }) => {
  const [selectedShift, setSelectedShift] = useState<ShiftData | null>(null);

  const safeHistory = Array.isArray(history) ? history : [];

  if (safeHistory.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-gray-500 bg-white rounded-2xl border border-dashed border-gray-300 mx-4">
        <BarChart3 size={48} className="mb-4 opacity-20" />
        <p className="font-bold text-slate-800">Nenhum histórico encontrado</p>
        <p className="text-xs opacity-60 px-10 text-center mt-1">Isso pode ser um erro de conexão ou ainda não há turnos salvos na planilha.</p>
        <div className="flex gap-2 mt-6">
           <button onClick={onBack} className="bg-slate-100 text-slate-600 px-6 py-2 rounded-full font-bold flex items-center gap-2 hover:bg-slate-200 transition-all text-xs">
              <ArrowLeft size={16}/> Voltar
           </button>
           {onRefresh && (
             <button onClick={onRefresh} className="bg-indigo-600 text-white px-6 py-2 rounded-full font-bold flex items-center gap-2 hover:bg-indigo-700 transition-all text-xs">
                <RefreshCw size={16}/> Sincronizar Agora
             </button>
           )}
        </div>
      </div>
    );
  }

  const latest = safeHistory[0];
  const tasks = latest && Array.isArray(latest.tasks) ? latest.tasks : [];
  
  const totalExpected = tasks.reduce((acc, t) => acc + (Number(t.expectedVolume) || 0), 0);
  const totalActual = tasks.reduce((acc, t) => acc + (Number(t.actualVolume) || 0), 0);
  const globalEfficiency = totalExpected > 0 ? (totalActual / totalExpected) * 100 : 0;

  const clientStats = tasks.reduce((acc, t) => {
    const name = t.clientName || 'Geral';
    if (!acc[name]) acc[name] = { exp: 0, act: 0 };
    acc[name].exp += (Number(t.expectedVolume) || 0);
    acc[name].act += (Number(t.actualVolume) || 0);
    return acc;
  }, {} as Record<string, { exp: number, act: number }>);

  const topEmployees = [...tasks]
    .filter(t => t.expectedVolume > 0)
    .sort((a, b) => {
      const effA = a.actualVolume / a.expectedVolume;
      const effB = b.actualVolume / b.expectedVolume;
      return effB - effA;
    })
    .slice(0, 3);

  return (
    <div className="space-y-6 animate-fade-in pb-20">
      <div className="flex items-center justify-between mb-2">
        <h2 className="text-2xl font-black text-gray-900 tracking-tight italic">DASH<span className="text-indigo-600">BOARD</span></h2>
        <div className="flex gap-2">
           {onRefresh && (
             <button onClick={onRefresh} title="Sincronizar" className="p-2 text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors active:scale-90">
               <RefreshCw size={20}/>
             </button>
           )}
           <button onClick={onBack} title="Voltar" className="p-2 text-gray-400 hover:bg-gray-100 rounded-lg transition-colors active:scale-90">
             <ArrowLeft size={20}/>
           </button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <Card className="bg-slate-900 text-white border-none shadow-xl">
          <CardContent className="p-4">
            <Package className="mb-2 text-indigo-400" size={20} />
            <p className="text-[10px] font-bold uppercase tracking-wider opacity-60">Total Realizado</p>
            <h3 className="text-2xl font-black">{totalActual.toLocaleString()}</h3>
            <p className="text-[10px] mt-1 opacity-40 italic">Meta: {totalExpected.toLocaleString()}</p>
          </CardContent>
        </Card>
        <Card className={`${globalEfficiency >= 90 ? 'bg-indigo-600' : 'bg-orange-600'} text-white border-none shadow-xl`}>
          <CardContent className="p-4">
            <TrendingUp className="mb-2 opacity-50" size={20} />
            <p className="text-[10px] font-bold uppercase tracking-wider opacity-80">Eficiência Geral</p>
            <h3 className="text-2xl font-black">{globalEfficiency.toFixed(1)}%</h3>
            <div className="w-full bg-white/20 h-1 rounded-full mt-2">
              <div className="bg-white h-full rounded-full transition-all duration-1000" style={{width: `${Math.min(globalEfficiency, 100)}%`}} />
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader title="Volume por Cliente" icon={Users} />
        <CardContent>
          <div className="space-y-4">
            {Object.entries(clientStats).length > 0 ? Object.entries(clientStats).map(([name, stats]) => {
              const s = stats as { exp: number; act: number };
              const eff = s.exp > 0 ? (s.act / s.exp) * 100 : 0;
              return (
                <div key={name}>
                  <div className="flex justify-between text-xs font-bold mb-1 uppercase tracking-tight">
                    <span className="text-gray-700">{name}</span>
                    <span className="text-gray-400 font-mono">{s.act} / {s.exp}</span>
                  </div>
                  <div className="w-full bg-gray-100 h-3 rounded-full overflow-hidden">
                     <div 
                       className={`h-full transition-all duration-700 ${eff >= 90 ? 'bg-indigo-600' : 'bg-orange-500'}`} 
                       style={{ width: `${Math.min(eff, 100)}%` }} 
                     />
                  </div>
                </div>
              );
            }) : <p className="text-xs text-gray-400 italic">Sem dados de clientes.</p>}
          </div>
        </CardContent>
      </Card>

      {topEmployees.length > 0 && (
        <Card>
          <CardHeader title="Destaques do Turno" icon={Star} />
          <CardContent className="p-0">
            {topEmployees.map((emp, idx) => {
              const eff = emp.expectedVolume > 0 ? (emp.actualVolume / emp.expectedVolume) * 100 : 0;
              return (
                <div key={emp.id || idx} className={`flex items-center justify-between p-4 ${idx !== topEmployees.length - 1 ? 'border-b' : ''}`}>
                  <div className="flex items-center gap-3">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center font-black text-xs ${idx === 0 ? 'bg-yellow-400 text-white shadow-lg shadow-yellow-100' : 'bg-slate-100 text-slate-600'}`}>
                      {idx + 1}º
                    </div>
                    <div>
                      <h4 className="text-sm font-bold text-gray-800">{emp.employee}</h4>
                      <p className="text-[10px] text-gray-400 uppercase font-medium">{emp.station} • {emp.clientName}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <span className={`text-sm font-black ${eff >= 100 ? 'text-indigo-600' : 'text-gray-700'}`}>{eff.toFixed(0)}%</span>
                    <p className="text-[9px] text-gray-400 font-bold uppercase tracking-widest">Perf.</p>
                  </div>
                </div>
              );
            })}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader title="Histórico de Turnos" icon={BarChart3} description="Toque para ver detalhes" />
        <CardContent className="p-0 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full text-xs">
              <thead className="bg-gray-50 text-gray-400 uppercase font-black border-b">
                <tr>
                  <th className="px-4 py-3 text-left">Data</th>
                  <th className="px-4 py-3 text-left">Turno</th>
                  <th className="px-4 py-3 text-center">Eficiência</th>
                  <th className="px-4 py-3 text-center">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {safeHistory.slice(0, 15).map((h) => {
                  const hTasks = Array.isArray(h.tasks) ? h.tasks : [];
                  const totExp = hTasks.reduce((a, t) => a + (Number(t.expectedVolume) || 0), 0);
                  const totAct = hTasks.reduce((a, t) => a + (Number(t.actualVolume) || 0), 0);
                  const eff = totExp > 0 ? (totAct / totExp) * 100 : 0;
                  return (
                    <tr key={h.id || Math.random()} onClick={() => setSelectedShift(h)} className="hover:bg-indigo-50 cursor-pointer transition-colors group">
                      <td className="px-4 py-3 font-bold text-gray-700">{formatDate(h.date)}</td>
                      <td className="px-4 py-3 text-gray-500 font-medium">{h.shift ? h.shift.split(' ')[0] : '---'}</td>
                      <td className="px-4 py-3 text-center">
                        <span className={`px-2 py-0.5 rounded-full font-black text-[10px] ${eff >= 90 ? 'bg-emerald-100 text-emerald-700' : 'bg-orange-100 text-orange-700'}`}>
                          {eff.toFixed(0)}%
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center">
                         <Eye size={16} className="text-gray-300 group-hover:text-indigo-500 mx-auto" />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {selectedShift && (
        <div className="fixed inset-0 bg-slate-900/60 z-[60] flex items-center justify-center p-4 backdrop-blur-sm animate-in fade-in duration-200">
           <div className="w-full max-w-2xl bg-white rounded-3xl max-h-[90vh] overflow-y-auto shadow-2xl relative">
              <button 
                onClick={() => setSelectedShift(null)} 
                className="absolute top-4 right-4 p-2 bg-white/50 rounded-full hover:bg-slate-100 z-50 text-slate-500"
              >
                <X size={24} />
              </button>
              
              <div className="p-2">
                 <PassagemDeTurnoCard data={selectedShift} />
              </div>
           </div>
        </div>
      )}
    </div>
  );
};
