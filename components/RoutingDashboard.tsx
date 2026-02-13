
import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, Select, Button, Input, Checkbox } from './ui';
import { ArrowLeft, Upload, FileSpreadsheet, Trophy, CheckCircle, AlertTriangle, Zap, Activity, Filter, Target, X, Clock } from 'lucide-react';
import { toast } from 'sonner';
import { RegistryData } from '../types';

interface RoutingDashboardProps {
  onBack: () => void;
  registries: RegistryData;
}

interface StationData {
  name: string;
  startTime: string;
  endTime: string;
  startVolume: number;
  endVolume: number;
  increase: number;
  hoursDiff: number;
  pph: number;
  target: number;
  status: 'TOP' | 'OTIMO' | 'BOM' | 'MEDIO' | 'BAIXO';
}

interface RawStationRecord {
  isoDate: string;
  displayLabel: string;
  volume: number;
}

export const RoutingDashboard: React.FC<RoutingDashboardProps> = ({ onBack, registries }) => {
  const [report, setReport] = useState<StationData[] | null>(null);
  const [rawStationMap, setRawStationMap] = useState<Map<string, RawStationRecord[]> | null>(null);
  const [timeOptions, setTimeOptions] = useState<{value: string, label: string}[]>([]);
  const [selectedRange, setSelectedRange] = useState({ startIso: '', endIso: '' });
  const [globalTime, setGlobalTime] = useState({ startLabel: '', endLabel: '', hours: 0 });
  const [totals, setTotals] = useState({ start: 0, end: 0, increase: 0, pph: 0, avgTarget: 200 });

  const [hasBreak, setHasBreak] = useState(false);
  const [breakTime, setBreakTime] = useState({ start: '', end: '' });

  const parseDateTime = (dateStr: string, timeStr: string): Date | null => {
    try {
      if (dateStr.includes('/')) {
        const parts = dateStr.split('/');
        const day = parseInt(parts[0], 10);
        const month = parseInt(parts[1], 10) - 1;
        let year = parseInt(parts[2], 10);
        if (year < 100) year += 2000;
        const [hours, minutes] = timeStr.split(':').map(Number);
        return new Date(year, month, day, hours, minutes);
      }
      return new Date(`${dateStr}T${timeStr}`);
    } catch (e) {
      return null;
    }
  };

  const processCSV = (content: string) => {
    try {
      const lines = content.split('\n').map(l => l.trim()).filter(l => l.length > 0);
      const dataRows = lines.slice(1);
      const stationMap = new Map<string, RawStationRecord[]>();
      const uniqueTimesMap = new Map<string, string>(); 

      const separator = lines[0].includes(';') ? ';' : ',';

      dataRows.forEach(row => {
        const cols = row.split(separator).map(c => c.trim());
        if (cols.length < 9) return;
        const dateStr = cols[0];
        const timeStr = cols[1];
        const station = cols[2];
        const volume = parseInt(cols[8]) || 0;
        if (!timeStr.includes(':')) return;
        const dateObj = parseDateTime(dateStr, timeStr);
        if (!dateObj || isNaN(dateObj.getTime())) return;
        const isoDate = dateObj.toISOString();
        const day = dateObj.getDate().toString().padStart(2, '0');
        const month = (dateObj.getMonth() + 1).toString().padStart(2, '0');
        const hour = dateObj.getHours().toString().padStart(2, '0');
        const min = dateObj.getMinutes().toString().padStart(2, '0');
        const displayLabel = `${day}/${month} - ${hour}:${min}`;

        if (!stationMap.has(station)) stationMap.set(station, []);
        stationMap.get(station)?.push({ isoDate, displayLabel, volume });
        uniqueTimesMap.set(isoDate, displayLabel);
      });

      stationMap.forEach((records) => records.sort((a, b) => a.isoDate.localeCompare(b.isoDate)));
      const sortedOptions = Array.from(uniqueTimesMap.entries())
        .sort((a, b) => a[0].localeCompare(b[0]))
        .map(([iso, label]) => ({ value: iso, label }));
      
      if (sortedOptions.length < 2) {
        toast.error("O arquivo precisa conter pelo menos dois horários diferentes.");
        return;
      }

      setRawStationMap(stationMap);
      setTimeOptions(sortedOptions);

      const defaultStart = sortedOptions[0].value;
      const defaultEnd = sortedOptions[sortedOptions.length - 1].value;
      setSelectedRange({ startIso: defaultStart, endIso: defaultEnd });
      generateReport(stationMap, defaultStart, defaultEnd, sortedOptions, hasBreak, breakTime);
    } catch (e) {
      toast.error("Erro ao processar CSV.");
    }
  };

  const getRecordAtIso = (records: RawStationRecord[], targetIso: string): RawStationRecord => {
    const exact = records.find(r => r.isoDate === targetIso);
    if (exact) return exact;
    let best = records[0];
    for (const rec of records) {
      if (rec.isoDate <= targetIso) best = rec;
      else break;
    }
    return best;
  };

  const calculateHoursDiff = (startIso: string, endIso: string) => {
    const d1 = new Date(startIso);
    const d2 = new Date(endIso);
    return Math.max(0, (d2.getTime() - d1.getTime()) / (1000 * 60 * 60));
  };

  const calculateBreakHours = (start: string, end: string) => {
    if (!start || !end) return 0;
    const [h1, m1] = start.split(':').map(Number);
    const [h2, m2] = end.split(':').map(Number);
    let minutes = (h2 * 60 + m2) - (h1 * 60 + m1);
    if (minutes < 0) minutes += 24 * 60;
    return minutes / 60;
  };

  const generateReport = (
      map: Map<string, RawStationRecord[]>, 
      startIso: string, 
      endIso: string,
      options: {value: string, label: string}[],
      useBreak: boolean,
      breakCfg: { start: string, end: string }
    ) => {
    if (!map) return;
    const results: StationData[] = [];
    let hoursDiff = calculateHoursDiff(startIso, endIso);
    if (useBreak && breakCfg.start && breakCfg.end) {
      hoursDiff = Math.max(0, hoursDiff - calculateBreakHours(breakCfg.start, breakCfg.end));
    }

    map.forEach((records, name) => {
       const startRec = getRecordAtIso(records, startIso);
       const endRec = getRecordAtIso(records, endIso);
       if (startRec.isoDate > endRec.isoDate) return;
       const increase = endRec.volume - startRec.volume;
       const pph = hoursDiff > 0 ? Math.round(increase / hoursDiff) : 0;
       
       // Busca meta cadastrada - Case Insensitive e Trim
       const registered = registries.stations.find(s => 
          s.name.trim().toUpperCase() === name.trim().toUpperCase()
       );
       
       const target = registered ? registered.targetPPH : 200;

       let status: StationData['status'] = 'BAIXO';
       if (pph >= target * 1.5) status = 'TOP';
       else if (pph >= target) status = 'OTIMO';
       else if (pph >= target * 0.75) status = 'BOM';
       else if (pph >= target * 0.5) status = 'MEDIO';
       else status = 'BAIXO';

       results.push({ name, startTime: startRec.displayLabel, endTime: endRec.displayLabel, startVolume: startRec.volume, endVolume: endRec.volume, increase, hoursDiff, pph, target, status });
    });

    results.sort((a, b) => b.pph - a.pph);
    const totalStart = results.reduce((acc, r) => acc + r.startVolume, 0);
    const totalEnd = results.reduce((acc, r) => acc + r.endVolume, 0);
    const totalIncrease = results.reduce((acc, r) => acc + r.increase, 0);
    const totalPPH = hoursDiff > 0 ? Math.round(totalIncrease / hoursDiff) : 0;
    const avgTarget = results.length > 0 ? results.reduce((acc, r) => acc + r.target, 0) / results.length : 200;

    setReport(results);
    setGlobalTime({ 
      startLabel: options.find(o => o.value === startIso)?.label || '', 
      endLabel: options.find(o => o.value === endIso)?.label || '', 
      hours: hoursDiff 
    });
    setTotals({ start: totalStart, end: totalEnd, increase: totalIncrease, pph: totalPPH, avgTarget });
  };

  const handleRangeChange = (type: 'start' | 'end', value: string) => {
    const newRange = { 
      startIso: type === 'start' ? value : selectedRange.startIso,
      endIso: type === 'end' ? value : selectedRange.endIso
    };
    if (newRange.startIso >= newRange.endIso) toast.warning("Intervalo inválido.");
    setSelectedRange(newRange);
    if (rawStationMap) generateReport(rawStationMap, newRange.startIso, newRange.endIso, timeOptions, hasBreak, breakTime);
  };

  useEffect(() => {
    if (rawStationMap && selectedRange.startIso && selectedRange.endIso) {
       generateReport(rawStationMap, selectedRange.startIso, selectedRange.endIso, timeOptions, hasBreak, breakTime);
    }
  }, [hasBreak, breakTime]);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => typeof event.target?.result === 'string' && processCSV(event.target.result);
      reader.readAsText(file);
    }
  };

  const formatDuration = (hours: number) => {
    const h = Math.floor(hours);
    const m = Math.round((hours - h) * 60);
    return `${h}h${m.toString().padStart(2, '0')}`;
  };

  const getStatusBadge = (pph: number, target: number) => {
    let status: StationData['status'] = 'BAIXO';
    if (pph >= target * 1.5) status = 'TOP';
    else if (pph >= target) status = 'OTIMO';
    else if (pph >= target * 0.75) status = 'BOM';
    else if (pph >= target * 0.5) status = 'MEDIO';
    else status = 'BAIXO';

    switch (status) {
      case 'TOP': return <span className="inline-flex items-center gap-1 bg-yellow-100 text-yellow-700 px-2 py-0.5 rounded text-[10px] font-black uppercase"><Trophy size={10} /> TOP!</span>;
      case 'OTIMO': return <span className="inline-flex items-center gap-1 bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded text-[10px] font-black uppercase"><CheckCircle size={10} /> Ótimo</span>;
      case 'BOM': return <span className="inline-flex items-center gap-1 bg-blue-100 text-blue-700 px-2 py-0.5 rounded text-[10px] font-black uppercase"><CheckCircle size={10} /> Bom</span>;
      case 'MEDIO': return <span className="inline-flex items-center gap-1 bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded text-[10px] font-black uppercase"><Zap size={10} /> Médio</span>;
      case 'BAIXO': return <span className="inline-flex items-center gap-1 bg-red-100 text-red-700 px-2 py-0.5 rounded text-[10px] font-black uppercase"><AlertTriangle size={10} /> Baixo</span>;
    }
  };

  if (!report) {
    return (
      <div className="space-y-6 animate-fade-in pb-20">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-black text-gray-900 uppercase italic">Análise de <span className="text-indigo-600">Roteirização</span></h2>
          <button onClick={onBack} className="p-2 text-gray-400 hover:bg-gray-100 rounded-lg"><ArrowLeft size={18}/></button>
        </div>
        <Card className="border-dashed border-2 border-indigo-200 bg-indigo-50/50">
          <CardContent className="flex flex-col items-center justify-center py-16">
            <div className="bg-white p-4 rounded-full shadow-sm mb-4"><FileSpreadsheet className="w-10 h-10 text-indigo-600" /></div>
            <h3 className="text-lg font-bold text-gray-800 mb-2">Importar Relatório CSV</h3>
            <p className="text-sm text-gray-500 text-center max-w-xs mb-6">As metas PPH serão sincronizadas automaticamente dos seus cadastros.</p>
            <label className="cursor-pointer">
              <input type="file" accept=".csv" onChange={handleFileUpload} className="hidden" />
              <div className="bg-indigo-600 text-white px-6 py-3 rounded-xl font-bold flex items-center gap-2 hover:bg-indigo-700 transition-colors shadow-lg shadow-indigo-200">
                <Upload size={18} /> Selecionar Arquivo (CSV)
              </div>
            </label>
          </CardContent>
        </Card>
      </div>
    );
  }

  const aboveMeta = report.filter(r => r.pph >= r.target).map(r => r.name);
  const belowMeta = report.filter(r => r.pph < r.target).map(r => r.name);
  const critical = report.filter(r => r.pph < (r.target * 0.5));

  return (
    <div className="space-y-6 animate-fade-in pb-20">
      <div className="flex items-center justify-between mb-2">
        <h2 className="text-xl font-black text-gray-900 uppercase italic">Relatório <span className="text-indigo-600">PPH Real</span></h2>
        <div className="flex gap-2">
          <button onClick={() => { setReport(null); setRawStationMap(null); setHasBreak(false); }} className="text-xs font-black text-indigo-600 bg-indigo-50 hover:bg-indigo-100 px-3 py-2 rounded-lg border border-indigo-100">Nova Importação</button>
          <button onClick={onBack} className="p-2 text-gray-400 hover:bg-gray-100 rounded-lg"><ArrowLeft size={18}/></button>
        </div>
      </div>

      <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-200">
         <div className="flex items-center gap-2 mb-3 text-indigo-600">
            <Filter size={18} />
            <h3 className="text-sm font-black uppercase tracking-wide">Filtros de Período</h3>
         </div>
         <div className="flex gap-4 items-end mb-4">
            <div className="flex-1">
               <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1">Início</label>
               <Select label="" options={timeOptions} value={selectedRange.startIso} onChange={(e) => handleRangeChange('start', e.target.value)} className="mb-0 bg-gray-50 border-gray-200 font-bold text-sm" />
            </div>
            <div className="flex-1">
               <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1">Fim</label>
               <Select label="" options={timeOptions} value={selectedRange.endIso} onChange={(e) => handleRangeChange('end', e.target.value)} className="mb-0 bg-gray-50 border-gray-200 font-bold text-sm" />
            </div>
         </div>
         <div className="pt-3 border-t border-gray-100">
            <Checkbox label="Descontar Intervalo" checked={hasBreak} onChange={(e) => setHasBreak(e.target.checked)} />
            {hasBreak && (
              <div className="flex gap-4 items-center bg-gray-50 p-3 rounded-lg border border-gray-200 mt-2 animate-fade-in">
                 <Clock size={16} className="text-indigo-400" />
                 <div className="flex-1">
                    <input type="time" className="w-full bg-white border border-gray-300 rounded px-2 py-1 text-sm font-bold" value={breakTime.start} onChange={(e) => setBreakTime({...breakTime, start: e.target.value})} />
                 </div>
                 <div className="flex-1">
                    <input type="time" className="w-full bg-white border border-gray-300 rounded px-2 py-1 text-sm font-bold" value={breakTime.end} onChange={(e) => setBreakTime({...breakTime, end: e.target.value})} />
                 </div>
              </div>
            )}
         </div>
      </div>

      <div className="bg-slate-900 text-white rounded-xl p-4 shadow-xl border-t-4 border-indigo-500">
        <div className="flex justify-between items-end">
           <div>
             <span className="text-[10px] text-slate-400 font-black uppercase block mb-1">Tempo Líquido</span>
             <span className="text-2xl font-black text-white">{formatDuration(globalTime.hours)}</span>
           </div>
           <div className="text-right">
              <span className="text-[10px] text-slate-400 font-black uppercase block mb-1">PPH Médio Geral</span>
              <span className="text-2xl font-black text-emerald-400">{totals.pph}</span>
           </div>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr>
                <th className="px-3 py-3 text-left font-black text-gray-500 uppercase">Estação</th>
                <th className="px-2 py-3 text-center font-bold text-gray-400 bg-gray-50">Meta</th>
                <th className="px-3 py-3 text-center font-black text-indigo-600 bg-indigo-50/50">PPH Real</th>
                <th className="px-3 py-3 text-center font-bold text-gray-500">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {report.map((row, idx) => (
                <tr key={idx} className="hover:bg-gray-50 transition-colors">
                  <td className="px-3 py-3 font-bold text-gray-800 uppercase">{row.name}</td>
                  <td className="px-2 py-3 text-center text-gray-400 font-black bg-gray-50/50">{row.target}</td>
                  <td className="px-3 py-3 text-center font-black text-lg text-indigo-700 bg-indigo-50/30">{row.pph}</td>
                  <td className="px-3 py-3 text-center">{getStatusBadge(row.pph, row.target)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <Card className="bg-slate-50 border-indigo-100">
        <CardHeader title="Análise Automática de Metas" icon={Zap} />
        <CardContent className="space-y-3 pt-0">
          <div className="flex gap-2 items-start">
             <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 mt-1.5 shrink-0" />
             <p className="text-sm text-gray-600"><span className="font-bold text-gray-800">Acima da Meta ({aboveMeta.length}):</span> {aboveMeta.join(', ') || 'Nenhum'}.</p>
          </div>
          <div className="flex gap-2 items-start">
             <span className="w-1.5 h-1.5 rounded-full bg-orange-500 mt-1.5 shrink-0" />
             <p className="text-sm text-gray-600"><span className="font-bold text-gray-800">Abaixo da Meta ({belowMeta.length}):</span> {belowMeta.join(', ') || 'Nenhum'}.</p>
          </div>
          {critical.length > 0 && (
             <div className="flex gap-2 items-start bg-red-50 p-2 rounded-lg border border-red-100 mt-2">
                <AlertTriangle size={16} className="text-red-500 shrink-0 mt-0.5" />
                <p className="text-xs text-red-700 font-bold">Crítico ({"<"}50%): {critical.map(c => c.name).join(', ')}.</p>
             </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};
