
import React from 'react';
import { ShiftData } from '../types';

export const MarkdownRenderer: React.FC<{ content: string; dark?: boolean }> = ({ content, dark = false }) => {
  if (!content) return null;
  const lines = content.split('\n');
  const elements: React.ReactNode[] = [];
  let tableBuffer: string[] = [];
  let inTable = false;

  const renderTable = (rows: string[], key: string) => {
    const parse = (r: string) => r.split('|').map(c => c.trim()).filter((c, i, a) => !(i === 0 && c === '') && !(i === a.length - 1 && c === ''));
    if (rows.length < 2) return null;
    const headers = parse(rows[0]);
    const body = rows.slice(2).map(parse);
    return (
      <div key={key} className={`overflow-x-auto my-6 rounded-2xl border shadow-sm ${dark ? 'border-slate-700' : 'border-slate-200'}`}>
        <table className={`min-w-full divide-y text-[11px] ${dark ? 'divide-slate-700' : 'divide-slate-200'}`}>
          <thead className={dark ? 'bg-slate-800' : 'bg-slate-50'}>
            <tr>{headers.map((h, i) => <th key={i} className={`px-3 py-2.5 text-left font-black uppercase tracking-widest ${dark ? 'text-slate-400' : 'text-slate-500'}`}>{h}</th>)}</tr>
          </thead>
          <tbody className={`divide-y ${dark ? 'divide-slate-700 bg-slate-800/50' : 'divide-slate-100 bg-white'}`}>
            {body.map((r, i) => <tr key={i} className={dark ? 'hover:bg-slate-700/50 transition-colors' : 'hover:bg-indigo-50/30 transition-colors'}>{r.map((c, ci) => <td key={ci} className={`px-3 py-2.5 font-bold ${dark ? 'text-slate-300' : 'text-slate-700'}`}>{c}</td>)}</tr>)}
          </tbody>
        </table>
      </div>
    );
  };

  const processInline = (text: string) => {
    const parts = text.split(/(\*\*.*?\*\*)/g);
    return parts.map((part, i) => {
      if (part.startsWith('**') && part.endsWith('**')) {
        return <strong key={i} className={dark ? 'text-white font-black' : 'text-slate-900 font-black'}>{part.slice(2, -2)}</strong>;
      }
      return part;
    });
  };

  lines.forEach((line, i) => {
    const t = line.trim();
    if (t.startsWith('|')) { 
      inTable = true; 
      tableBuffer.push(t); 
    } else {
      if (inTable) { 
        elements.push(renderTable(tableBuffer, `t-${i}`)); 
        tableBuffer = []; 
        inTable = false; 
      }
      
      if (t === '') {
        elements.push(<div key={i} className="h-2" />);
      } else if (t.startsWith('##')) {
        elements.push(<h3 key={i} className={`text-base font-black mt-6 mb-3 uppercase italic tracking-tight ${dark ? 'text-indigo-300' : 'text-indigo-900'}`}>{processInline(t.replace(/#/g, '').trim())}</h3>);
      } else if (t.startsWith('###')) {
        elements.push(<h4 key={i} className={`text-xs font-black mt-4 mb-2 uppercase tracking-widest ${dark ? 'text-indigo-400' : 'text-indigo-700'}`}>{processInline(t.replace(/#/g, '').trim())}</h4>);
      } else if (t.startsWith('- ')) {
        elements.push(<li key={i} className={`ml-4 list-disc text-xs mb-1 font-medium ${dark ? 'text-slate-300' : 'text-slate-600'}`}>{processInline(t.replace('- ', ''))}</li>);
      } else {
        elements.push(<p key={i} className={`text-xs leading-relaxed mb-3 font-medium ${dark ? 'text-slate-300' : 'text-slate-600'}`}>{processInline(t)}</p>);
      }
    }
  });

  return <div>{elements}</div>;
};

const formatDate = (dateStr: any) => {
  if (!dateStr) return '---';
  let str = String(dateStr);
  
  // Se já estiver formatado corretamente (DD/MM/AAAA), retorna direto
  if (/^\d{2}\/\d{2}\/\d{4}$/.test(str)) return str;

  // Extrai a parte da data de um ISO (YYYY-MM-DD...)
  const pure = str.includes('T') ? str.split('T')[0] : str;
  
  // Verifica se é YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(pure)) {
    const [y, m, d] = pure.split('-');
    return `${d}/${m}/${y}`;
  }
  
  return str;
};

export const PassagemDeTurnoCard: React.FC<{ data: ShiftData }> = ({ data }) => {
  const calcPerc = (a: number, e: number) => e > 0 ? Math.round((a/e)*100) : 0;
  return (
    <div className="bg-slate-900 text-white p-6 rounded-[2rem] shadow-2xl w-full border-t-[12px] border-indigo-600 relative overflow-hidden transition-all">
      <div className="absolute top-0 right-0 w-40 h-40 bg-indigo-600/20 rounded-full -mr-20 -mt-20 blur-3xl"></div>
      
      <div className="flex justify-between items-start mb-8 pb-4 border-b border-slate-800 relative z-10">
        <div>
          <h2 className="font-black text-2xl tracking-tighter text-indigo-400 leading-none">LOG<span className="text-white">REPORTE</span></h2>
          <p className="text-[10px] text-slate-500 font-bold uppercase mt-2 tracking-widest">{formatDate(data.date)} • {data.shift}</p>
        </div>
        <div className="text-right">
          <p className="text-[9px] text-slate-600 font-black uppercase tracking-widest mb-1">Responsável</p>
          <p className="text-sm font-bold text-white uppercase italic">{data.supervisorName || '---'}</p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 mb-6 relative z-10">
        <div className="bg-slate-800/40 p-3 rounded-2xl border border-slate-700/50 flex flex-col items-center">
          <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-1">Faltas</span>
          <span className="text-xl font-black text-white">{data.missingEmployeesCount || 0}</span>
        </div>
        <div className="bg-slate-800/40 p-3 rounded-2xl border border-slate-700/50 flex flex-col items-center">
          <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-1">EPI / Segurança</span>
          <span className={`text-[10px] font-black uppercase ${data.epiNotes ? 'text-indigo-400' : 'text-slate-600'}`}>
            {data.epiNotes ? 'Registrado' : 'Sem Notas'}
          </span>
        </div>
      </div>

      <div className="space-y-3 mb-8 relative z-10">
        {data.tasks && data.tasks.length > 0 ? (
          data.tasks.map(t => {
            const perc = calcPerc(t.actualVolume, t.expectedVolume);
            return (
              <div key={t.id} className="bg-slate-800/40 p-4 rounded-2xl border border-slate-700/50">
                <div className="flex justify-between items-center mb-2">
                  <span className="text-[10px] font-black bg-indigo-600 px-2.5 py-1 rounded-lg text-white uppercase tracking-wider">{t.station}</span>
                  <span className="text-[10px] font-mono text-slate-500 uppercase">{t.clientName}</span>
                </div>
                <div className="flex justify-between items-end">
                  <div>
                    <p className="text-sm font-bold text-slate-100">{t.employee}</p>
                    <p className="text-[10px] text-slate-500 font-bold uppercase tracking-tight mt-0.5">{t.processType}</p>
                  </div>
                  <div className="text-right">
                    <p className={`text-xl font-black ${perc >= 90 ? 'text-emerald-400' : 'text-orange-400'}`}>
                      {t.actualVolume} <span className="text-[10px] opacity-40 font-normal ml-1">/{t.expectedVolume}</span>
                    </p>
                    <div className="w-16 h-1 bg-slate-700 rounded-full mt-1 overflow-hidden ml-auto">
                      <div className={`h-full ${perc >= 90 ? 'bg-emerald-400' : 'bg-orange-400'}`} style={{width: `${Math.min(perc, 100)}%`}} />
                    </div>
                  </div>
                </div>
              </div>
            );
          })
        ) : (
          <p className="text-slate-500 text-xs italic text-center py-4">Sem tarefas registradas.</p>
        )}
      </div>

      <div className="grid grid-cols-2 gap-4 relative z-10">
        <div className="bg-slate-800/60 p-4 rounded-2xl border border-slate-700/50">
          <span className="text-slate-600 block font-black text-[9px] uppercase tracking-widest mb-2">Segurança</span>
          <div className="flex items-center gap-2">
             <div className={`w-2 h-2 rounded-full ${data.safetyIncident ? 'bg-red-500 animate-pulse' : 'bg-emerald-500'}`}></div>
             <span className={`text-[11px] font-black uppercase ${data.safetyIncident ? 'text-red-400' : 'text-emerald-400'}`}>
                {data.safetyIncident ? 'Incidente Registrado' : 'Zero Acidentes'}
             </span>
          </div>
        </div>
        <div className="bg-slate-800/60 p-4 rounded-2xl border border-slate-700/50">
          <span className="text-slate-600 block font-black text-[9px] uppercase tracking-widest mb-2">Qualidade 5S</span>
          <span className="text-[11px] font-black text-indigo-400 uppercase tracking-widest">{data.fiveSStatus || 'N/A'}</span>
        </div>
      </div>

      {data.aiAnalysis && (
        <div className="mt-8 pt-6 border-t border-slate-800 relative z-10 animate-fade-in">
           <h3 className="text-indigo-400 font-black text-[10px] uppercase tracking-widest mb-4 flex items-center gap-2">
             <span className="w-1.5 h-1.5 bg-indigo-500 rounded-full animate-pulse"/> Análise Inteligente do Turno
           </h3>
           <div className="bg-slate-800/50 p-4 rounded-xl border border-slate-700/50 shadow-inner">
              <MarkdownRenderer content={data.aiAnalysis} dark={true} />
           </div>
        </div>
      )}
    </div>
  );
};
