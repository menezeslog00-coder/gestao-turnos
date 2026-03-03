import React, { useState, useMemo, useRef } from 'react';
import { Card, CardContent, Select, Button } from '../components/ui';
import { 
  X, Table, Calendar, Clock, Upload, 
  FileSpreadsheet, Search, Filter, BarChart3, CheckCircle2, Timer 
} from 'lucide-react';
import { toast } from 'sonner';
import { RegistryData } from '../types';

interface CsvRow {
  date: string;
  time: string;
  station: string;
  transf: string;
  embarque: string;
  descarregado: string;
  recebido: string;
  totalRot: string;
  emRota: string;
  outros: string;
}

const normalizeHeader = (h: string) => {
  return h.toUpperCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, ' ')
    .trim();
};

const CircularProgress: React.FC<{ percent: number; color: string; bgColor?: string }> = ({ 
  percent, 
  color, 
  bgColor = 'rgba(255,255,255,0.08)' 
}) => {
  const radius = 28;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (percent / 100) * circumference;

  return (
    <div className="relative inline-flex items-center justify-center w-20 h-20 flex-shrink-0">
      <svg className="transform -rotate-90 w-full h-full">
        <circle cx="40" cy="40" r={radius} stroke={bgColor} strokeWidth="6" fill="transparent" />
        <circle
          cx="40" cy="40" r={radius}
          stroke={color} strokeWidth="6" fill="transparent"
          strokeDasharray={circumference} strokeDashoffset={offset}
          strokeLinecap="round" className="transition-all duration-1000 ease-out"
        />
      </svg>
      <span className="absolute text-xs font-bold tabular-nums">{percent}%</span>
    </div>
  );
};

export const PlanningViewScreen: React.FC<{ onBack: () => void; registries: RegistryData }> = ({ onBack, registries }) => {
  const [rawData, setRawData] = useState<CsvRow[]>([]);
  const [selectedDate, setSelectedDate] = useState<string>('');
  const [selectedTime, setSelectedTime] = useState<string>('');
  const [showFilters, setShowFilters] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
      const text = evt.target?.result as string;
      const lines = text.split(/\r?\n/).map(l => l.trim()).filter(l => l.length > 0);
      if (lines.length < 2) return toast.error("Arquivo inválido.");

      const separator = lines[0].includes(';') ? ';' : ',';
      const rawHeaders = lines[0].replace(/^\uFEFF/, '').split(separator);
      const headers = rawHeaders.map(normalizeHeader);
      
      const findIdx = (names: string[]) => headers.findIndex(h => names.some(n => h.includes(n)));

      const idx = {
        date: findIdx(['DATA']),
        time: findIdx(['HORA']),
        station: findIdx(['ESTACAO', 'ESTACÃO']),
        transf: findIdx(['TRANSFERENCIA PARA']),
        embarque: findIdx(['EMBARQUE RECEBIDO']),
        descarregado: findIdx(['DESCARREGADO']),
        recebido: findIdx(['RECEBIDO CD DE']),
        totalRot: findIdx(['TOTAL PARA ROTEIRIZAR']),
        emRota: findIdx(['EM ROTA']),
        outros: findIdx(['OUTROS STATUS'])
      };

      const rows: CsvRow[] = [];
      for (let i = 1; i < lines.length; i++) {
        const cols = lines[i].split(separator).map(c => c.trim());
        if (cols.length < headers.length) continue;
        rows.push({
          date: cols[idx.date] || '',
          time: cols[idx.time] || '',
          station: cols[idx.station] || '',
          transf: idx.transf !== -1 ? cols[idx.transf] : '0',
          embarque: idx.embarque !== -1 ? cols[idx.embarque] : '0',
          descarregado: idx.descarregado !== -1 ? cols[idx.descarregado] : '0',
          recebido: idx.recebido !== -1 ? cols[idx.recebido] : '0',
          totalRot: idx.totalRot !== -1 ? cols[idx.totalRot] : '0',
          emRota: idx.emRota !== -1 ? cols[idx.emRota] : '0',
          outros: idx.outros !== -1 ? cols[idx.outros] : '0',
        });
      }

      setRawData(rows);
      toast.success(`${rows.length} registros carregados.`);
      const dates = Array.from(new Set(rows.map(r => r.date))).sort((a,b) => b.localeCompare(a));
      if (dates.length > 0) {
        setSelectedDate(dates[0]);
        const times = Array.from(new Set(rows.filter(r => r.date === dates[0]).map(r => r.time))).sort();
        if (times.length > 0) setSelectedTime(times[0]);
      }
    };
    reader.readAsText(file);
  };

  const availableDates = useMemo(() => Array.from(new Set(rawData.map(r => r.date))).sort((a, b) => (b as string).localeCompare(a as string)), [rawData]);
  const availableTimes = useMemo(() => selectedDate ? Array.from(new Set(rawData.filter(r => r.date === selectedDate).map(r => r.time))).sort() : [], [rawData, selectedDate]);
  const filteredRows = useMemo(() => selectedDate && selectedTime ? rawData.filter(r => r.date === selectedDate && r.time === selectedTime) : [], [rawData, selectedDate, selectedTime]);

  const totals = useMemo(() => {
    const parse = (v: string) => parseInt(v.replace(/\./g, '').replace(',', '.')) || 0;
    return filteredRows.reduce((acc, r) => ({
      totalRot: acc.totalRot + parse(r.totalRot),
      emRota: acc.emRota + parse(r.emRota),
      transf: acc.transf + parse(r.transf),
      recebido: acc.recebido + parse(r.recebido)
    }), { totalRot: 0, emRota: 0, transf: 0, recebido: 0 });
  }, [filteredRows]);

  const totalCD = totals.totalRot + totals.emRota;
  const percRot = totalCD > 0 ? Math.round((totals.totalRot / totalCD) * 100) : 0;
  const percRota = totalCD > 0 ? Math.round((totals.emRota / totalCD) * 100) : 0;

  // Converte horas decimais (ex: 5.3) para formato HH:MM (ex: 05:18)
  const formatHoursToHHMM = (decimalHours: number): string => {
    const h = Math.floor(decimalHours);
    const m = Math.round((decimalHours - h) * 60);
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
  };

  const calculateTimeToFinish = (totalRotStr: string, stationName: string) => {
    const totalRot = parseInt(totalRotStr.replace(/\./g, '').replace(',', '.')) || 0;
    if (totalRot <= 0) return '—';

    const station = registries.stations.find(s => s.name.trim().toUpperCase() === stationName.trim().toUpperCase());
    const targetPPH = station ? station.targetPPH : 200;

    const totalHours = totalRot / targetPPH;
    const days = Math.floor(totalHours / 8);
    const remainingHours = totalHours % 8;

    if (days > 0) {
      return `${days}d ${formatHoursToHHMM(remainingHours)}`;
    }
    return formatHoursToHHMM(remainingHours);
  };

  return (
    <div className="min-h-screen bg-neutral-50 p-6 md:p-8 lg:p-10">
      <div className="max-w-[1920px] mx-auto space-y-8">
        
        {/* Header Minimalista */}
        <header className="flex items-center justify-between">
          <div className="flex items-center gap-5">
            <div className="w-12 h-12 rounded-full bg-blue-600 flex items-center justify-center shadow-sm">
              <BarChart3 className="text-white w-5 h-5" strokeWidth={2.5} />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-neutral-900 tracking-tight">Snapshot</h1>
              <p className="text-sm text-neutral-500 font-medium mt-0.5">Análise Operacional</p>
            </div>
          </div>
          
          <div className="flex items-center gap-3">
            {rawData.length > 0 && (
              <button 
                onClick={() => setShowFilters(!showFilters)} 
                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all ${
                  showFilters 
                    ? 'bg-blue-600 text-white' 
                    : 'bg-white text-neutral-700 border border-neutral-200 hover:border-neutral-300'
                }`}
              >
                <Filter size={16} strokeWidth={2.5} />
                {showFilters ? 'Ocultar' : 'Filtros'}
              </button>
            )}
            <button 
              onClick={onBack} 
              className="p-2 bg-white border border-neutral-200 text-neutral-500 hover:text-neutral-700 hover:border-neutral-300 rounded-lg transition-all"
            >
              <X size={20} strokeWidth={2.5} />
            </button>
          </div>
        </header>

        {/* Filtros */}
        {showFilters && rawData.length > 0 && (
          <div className="bg-white rounded-xl border border-neutral-200 p-6 animate-fade-in">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <div>
                <label className="block text-xs font-semibold text-neutral-600 mb-2 uppercase tracking-wide">Data</label>
                <Select 
                  label=""
                  value={selectedDate} 
                  onChange={(e) => { setSelectedDate(e.target.value); setSelectedTime(''); }} 
                  options={availableDates.map(d => ({ value: d, label: d }))} 
                  className="h-11 bg-neutral-50 border-neutral-200 rounded-lg"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-neutral-600 mb-2 uppercase tracking-wide">Horário</label>
                <Select 
                  label=""
                  value={selectedTime} 
                  onChange={(e) => setSelectedTime(e.target.value)} 
                  disabled={!selectedDate} 
                  options={availableTimes.map(t => ({ value: t, label: t }))} 
                  className="h-11 bg-neutral-50 border-neutral-200 rounded-lg"
                />
              </div>
              <div className="lg:col-span-2 flex gap-3 items-end">
                <Button 
                  onClick={() => setShowFilters(false)} 
                  className="flex-1 bg-blue-600 hover:bg-blue-700 h-11 rounded-lg text-sm font-semibold"
                >
                  Aplicar
                </Button>
                <Button 
                  variant="secondary" 
                  onClick={() => setRawData([])} 
                  className="px-5 h-11 rounded-lg text-sm font-semibold border-neutral-200 hover:border-neutral-300"
                >
                  Trocar CSV
                </Button>
              </div>
            </div>
          </div>
        )}

        {!rawData.length ? (
          /* Estado de Upload */
          <div className="bg-white rounded-xl border-2 border-dashed border-neutral-200 p-16 text-center">
            <div className="max-w-md mx-auto">
              <div className="w-16 h-16 rounded-full bg-blue-100 flex items-center justify-center mx-auto mb-6">
                <FileSpreadsheet className="w-8 h-8 text-blue-600" strokeWidth={2} />
              </div>
              <h3 className="text-2xl font-bold text-neutral-900 mb-3">Importar Dados</h3>
              <p className="text-neutral-500 mb-8 leading-relaxed">
                Carregue um arquivo CSV para visualizar métricas e análises operacionais
              </p>
              <input type="file" accept=".csv" onChange={handleFileUpload} className="hidden" ref={fileInputRef} />
              <Button 
                onClick={() => fileInputRef.current?.click()} 
                className="bg-blue-600 hover:bg-blue-700 h-12 px-8 rounded-lg text-base font-semibold inline-flex items-center gap-3"
              >
                <Upload size={20} strokeWidth={2.5} />
                Selecionar Arquivo
              </Button>
            </div>
          </div>
        ) : (
          /* Layout Principal */
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            
            {/* Tabela (9 colunas) */}
            <div className="lg:col-span-9">
              {filteredRows.length > 0 ? (
                <div className="bg-white rounded-xl border border-neutral-200 overflow-hidden">
                  <div className="px-6 py-4 border-b border-neutral-200 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <Table size={18} className="text-blue-600" strokeWidth={2.5} />
                      <h3 className="text-base font-semibold text-neutral-900">Detalhamento por Estação</h3>
                    </div>
                    <div className="flex items-center gap-1.5 text-sm">
                      <Clock size={14} className="text-neutral-400" strokeWidth={2.5} />
                      <span className="font-semibold text-blue-600">{selectedTime}</span>
                      <span className="text-neutral-300">•</span>
                      <span className="font-medium text-neutral-600">{selectedDate}</span>
                    </div>
                  </div>
                  
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead>
                        <tr className="border-b border-neutral-100">
                          <th className="px-6 py-3 text-left text-xs font-semibold text-neutral-600 uppercase tracking-wide">Estação</th>
                          <th className="px-4 py-3 text-center text-xs font-semibold text-neutral-600 uppercase tracking-wide">Transf</th>
                          <th className="px-4 py-3 text-center text-xs font-semibold text-neutral-600 uppercase tracking-wide">Embarque</th>
                          <th className="px-4 py-3 text-center text-xs font-semibold text-neutral-600 uppercase tracking-wide">Desc.</th>
                          <th className="px-6 py-3 text-right text-xs font-semibold text-blue-700 uppercase tracking-wide bg-blue-50/50">P/ Roteirizar</th>
                          <th className="px-6 py-3 text-right text-xs font-semibold text-indigo-700 uppercase tracking-wide bg-indigo-50/50">Tempo p/ Finalizar</th>
                          <th className="px-6 py-3 text-right text-xs font-semibold text-emerald-700 uppercase tracking-wide bg-emerald-50/50">Em Rota</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-neutral-100">
                        {filteredRows.map((row, idx) => (
                          <tr key={idx} className="hover:bg-neutral-50 transition-colors group">
                            <td className="px-6 py-3.5 font-semibold text-neutral-900 group-hover:text-blue-600 transition-colors">
                              {row.station}
                            </td>
                            <td className="px-4 py-3.5 text-center text-neutral-500 font-medium tabular-nums">{row.transf}</td>
                            <td className="px-4 py-3.5 text-center text-neutral-500 font-medium tabular-nums">{row.embarque}</td>
                            <td className="px-4 py-3.5 text-center text-neutral-500 font-medium tabular-nums">{row.descarregado}</td>
                            <td className="px-6 py-3.5 text-right font-bold text-neutral-900 bg-blue-50/30 tabular-nums">
                              {row.totalRot === '0' ? <span className="text-neutral-300">—</span> : row.totalRot}
                            </td>
                            <td className="px-6 py-3.5 text-right font-bold text-indigo-700 bg-indigo-50/30 tabular-nums">
                              {calculateTimeToFinish(row.totalRot, row.station)}
                            </td>
                            <td className="px-6 py-3.5 text-right font-bold text-neutral-900 bg-emerald-50/30 tabular-nums">
                              {row.emRota === '0' ? <span className="text-neutral-300">—</span> : row.emRota}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              ) : (
                <div className="bg-white rounded-xl border border-neutral-200 p-24 text-center">
                  <Search size={48} className="text-neutral-200 mx-auto mb-4" strokeWidth={1.5} />
                  <p className="text-lg font-semibold text-neutral-400">Selecione um período</p>
                </div>
              )}
            </div>

            {/* Cards de Métricas (3 colunas) */}
            <div className="lg:col-span-3 space-y-4">
              
              {/* Card 1: Volume para Roteirizar */}
              <div className="bg-neutral-900 rounded-xl p-6 text-white">
                <div className="flex items-start justify-between mb-6">
                  <div className="flex-1">
                    <p className="text-xs font-semibold text-neutral-500 uppercase tracking-wide mb-1">P/ Roteirizar</p>
                    <h2 className="text-4xl font-bold tabular-nums tracking-tight">{totals.totalRot.toLocaleString()}</h2>
                  </div>
                  <CircularProgress percent={percRot} color="#3b82f6" bgColor="rgba(255,255,255,0.1)" />
                </div>
                <div className="pt-4 border-t border-neutral-800">
                  <p className="text-xs text-neutral-500 font-medium">Volume Pendente</p>
                </div>
              </div>

              {/* Card 2: Status Em Rota */}
              <div className="bg-blue-600 rounded-xl p-6 text-white">
                <div className="flex items-start justify-between mb-6">
                  <div className="flex-1">
                    <p className="text-xs font-semibold text-blue-200 uppercase tracking-wide mb-1">Em Rota</p>
                    <h2 className="text-4xl font-bold tabular-nums tracking-tight">{totals.emRota.toLocaleString()}</h2>
                  </div>
                  <CircularProgress percent={percRota} color="#ffffff" bgColor="rgba(255,255,255,0.2)" />
                </div>
                <div className="pt-4 border-t border-blue-500">
                  <p className="text-xs text-blue-200 font-medium">Volume em Trânsito</p>
                </div>
              </div>

              {/* Card 3: Total Consolidado */}
              <div className="bg-white rounded-xl border-2 border-neutral-200 p-6">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-xs font-semibold text-neutral-600 uppercase tracking-wide">Total CD</p>
                  <div className="w-9 h-9 rounded-full bg-emerald-100 flex items-center justify-center">
                    <CheckCircle2 size={18} className="text-emerald-600" strokeWidth={2.5} />
                  </div>
                </div>
                <h2 className="text-4xl font-bold text-neutral-900 tabular-nums tracking-tight mb-4">
                  {totalCD.toLocaleString()}
                </h2>
                <div className="pt-4 border-t border-neutral-200">
                  <p className="text-xs text-neutral-500 font-medium">Consolidado Geral</p>
                </div>
              </div>

              {/* Info Card */}
              <div className="bg-neutral-50 rounded-xl border border-neutral-200 p-5">
                <div className="space-y-3">
                  <div className="flex justify-between items-center pb-3 border-b border-neutral-200">
                    <span className="text-xs font-semibold text-neutral-500 uppercase tracking-wide">Snapshot</span>
                    <span className="text-sm font-bold text-blue-600 tabular-nums">{selectedTime || '—'}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-xs font-semibold text-neutral-500 uppercase tracking-wide">Data</span>
                    <span className="text-sm font-bold text-neutral-900 tabular-nums">{selectedDate || '—'}</span>
                  </div>
                </div>
              </div>
            </div>

          </div>
        )}
      </div>
    </div>
  );
};
