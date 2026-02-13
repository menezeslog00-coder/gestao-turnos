
import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { ShiftData, ShiftTask, RegistryData } from '../types';
import { getRegistries } from '../services/registryService';
import { Card, CardContent, CardHeader, Input, TextArea, Button, AutocompleteInput, Select, Checkbox } from './ui';
import { Users, ClipboardList, Activity, AlertTriangle, Utensils, Trash2, DownloadCloud, Loader2, Pencil, X, Plus, Sparkles, FileSpreadsheet, Check, Package, Target, Clock, Settings2, CheckCircle2 } from 'lucide-react';
import { getLastShiftData } from '../services/googleSheetsService';
import { taskSchema, TaskFormData } from '../utils/validators/shiftSchema';
import { toast } from 'sonner';

interface StageProps {
  data: ShiftData;
  updateData: (updates: Partial<ShiftData>) => void;
  sheetsUrl?: string;
  registries?: RegistryData;
}

interface CsvRowData {
  date: string;
  time: string;
  station: string;
  metrics: {
    roteirizacao: number;
    carregamento: number;
    recebimento: number;
  };
}

const normalizeHeader = (h: string) => {
  return h.toUpperCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, ' ')
    .trim();
};

export const StartStage: React.FC<StageProps> = ({ data, updateData, sheetsUrl, registries }) => {
  const [isImporting, setIsImporting] = useState(false);
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null);
  const [tempName, setTempName] = useState('');
  
  const [showCsvModal, setShowCsvModal] = useState(false);
  const [csvSnapshots, setCsvSnapshots] = useState<string[]>([]);
  const [selectedSnapshot, setSelectedSnapshot] = useState('');
  const [parsedCsvData, setParsedCsvData] = useState<CsvRowData[]>([]);

  const regs = registries || getRegistries();
  const stationNames = regs.stations.map(s => s.name);

  const { register, handleSubmit, reset, setValue, watch } = useForm<TaskFormData>({
    resolver: zodResolver(taskSchema),
    defaultValues: {
      processType: '',
      clientName: '',
      station: '',
      employee: '',
      expectedVolume: 0
    }
  });

  const onSubmitTask = (formData: TaskFormData) => {
    const stationReg = regs.stations.find(s => s.name === formData.station);
    const task: ShiftTask = {
      id: Date.now().toString(),
      processType: formData.processType,
      clientName: formData.clientName,
      station: formData.station,
      employee: formData.employee,
      expectedVolume: formData.expectedVolume,
      actualVolume: 0,
      startTime: '',
      endTime: '',
      targetPPH: stationReg?.targetPPH
    };
    updateData({ tasks: [...data.tasks, task] });
    toast.success('Tarefa adicionada!');
    reset({ employee: '', expectedVolume: 0, clientName: formData.clientName, station: formData.station, processType: formData.processType });
  };

  const removeTask = (id: string) => {
    updateData({ tasks: data.tasks.filter(t => t.id !== id) });
  };

  const startEditing = (task: ShiftTask) => {
    setEditingTaskId(task.id);
    setTempName(task.employee);
  };

  const saveName = (id: string) => {
    if (!tempName.trim()) {
      toast.error("Nome não pode ser vazio");
      return;
    }
    updateData({
      tasks: data.tasks.map(t => t.id === id ? { ...t, employee: tempName.trim() } : t)
    });
    setEditingTaskId(null);
    toast.success("Colaborador atualizado");
  };

  const handleImportPending = async () => {
    if (isImporting || !sheetsUrl) return;
    setIsImporting(true);
    const toastId = toast.loading("Buscando turno anterior...");
    
    try {
      // Passamos data.id para ignorar o turno atual caso ele já esteja salvo
      const result = await getLastShiftData(sheetsUrl, data.id);
      
      if (result.success && result.data?.tasks) {
        const lastTasks = result.data.tasks;
        console.log("Tarefas encontradas no turno anterior:", lastTasks);

        // 1. Filtrar sobras reais (Meta > Realizado)
        const pending = lastTasks.filter((t: any) => {
          const exp = Number(t.expectedVolume) || 0;
          const act = Number(t.actualVolume) || 0;
          return exp > act;
        });

        if (pending.length === 0) {
          toast.dismiss(toastId);
          toast.info("O turno anterior não possui pendências (metas batidas 100%).");
          return;
        }

        // 2. Preparar as tarefas para importação
        const toAdd: ShiftTask[] = [];
        let duplicateCount = 0;

        pending.forEach((p: any, idx: number) => {
          const sobraName = p.employee.includes('(SOBRA)') ? p.employee : `${p.employee} (SOBRA)`;
          
          // Verifica se já existe EXATAMENTE essa sobra no turno atual
          const isDuplicate = data.tasks.some(curr => 
            curr.employee === sobraName && 
            curr.station === p.station && 
            curr.processType === p.processType
          );

          if (isDuplicate) {
            duplicateCount++;
          } else {
            const exp = Number(p.expectedVolume) || 0;
            const act = Number(p.actualVolume) || 0;
            const currentStation = regs.stations.find(s => s.name === p.station);

            toAdd.push({
              id: `sobra_${Date.now()}_${idx}`,
              processType: p.processType,
              clientName: p.clientName,
              station: p.station,
              employee: sobraName,
              expectedVolume: exp - act,
              actualVolume: 0,
              startTime: '',
              endTime: '',
              targetPPH: currentStation?.targetPPH || p.targetPPH
            });
          }
        });

        toast.dismiss(toastId);

        if (toAdd.length === 0) {
          toast.info(`${duplicateCount} sobras ignoradas: já estão na sua lista.`);
          return;
        }

        // Importação direta sem confirm() para evitar bloqueios de navegador
        updateData({ tasks: [...data.tasks, ...toAdd] });
        toast.success(`${toAdd.length} sobras importadas!`);
        console.log("Sobras adicionadas ao turno atual:", toAdd);

      } else {
        toast.dismiss(toastId);
        toast.error("Nenhum turno anterior com tarefas foi encontrado.");
      }
    } catch (err) {
      toast.dismiss(toastId);
      toast.error("Erro na comunicação com a planilha.");
      console.error("Erro handleImportPending:", err);
    } finally {
      setIsImporting(false);
    }
  };

  const handleCsvUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
      const text = evt.target?.result as string;
      const lines = text.split(/\r?\n/).map(l => l.trim()).filter(l => l.length > 0);
      if (lines.length < 2) return toast.error("CSV vazio.");

      const separator = lines[0].includes(';') ? ';' : ',';
      const rawHeaders = lines[0].replace(/^\uFEFF/, '').split(separator);
      const headers = rawHeaders.map(normalizeHeader);
      
      const idxDate = headers.findIndex(h => h.includes('DATA'));
      const idxTime = headers.findIndex(h => h.includes('HORA'));
      const idxStation = headers.findIndex(h => h.includes('ESTACAO') || h.includes('ESTACÃO') || h.includes('STATION'));
      
      const idxRoteirizar = headers.findIndex(h => h.includes('ROTEIRIZAR') || h.includes('ROTEIRIZACAO'));
      const idxEmRota = headers.findIndex(h => h.includes('EM ROTA'));
      const idxDescarregado = headers.findIndex(h => h.includes('DESCARREGADO'));
      const idxRecebido = headers.findIndex(h => h.includes('RECEBIDO') || h.includes('EMBARQUE RECEBIDO'));

      if (idxDate === -1 || idxTime === -1 || idxStation === -1) {
        return toast.error("Colunas essenciais (DATA, HORA, ESTAÇÃO) não encontradas.");
      }

      const rows: CsvRowData[] = [];
      const snapshots = new Set<string>();

      for (let i = 1; i < lines.length; i++) {
        const cols = lines[i].split(separator).map(c => c.trim());
        if (cols.length < headers.length) continue;

        const date = cols[idxDate];
        const time = cols[idxTime];
        const station = cols[idxStation];
        
        const parseNum = (v: string) => Math.floor(parseFloat(v.replace(/\./g, '').replace(',', '.')) || 0);

        const vRot = idxRoteirizar !== -1 ? parseNum(cols[idxRoteirizar]) : 0;
        const vRota = idxEmRota !== -1 ? parseNum(cols[idxEmRota]) : 0;
        const vRec = (idxDescarregado !== -1 ? parseNum(cols[idxDescarregado]) : 0) + 
                     (idxRecebido !== -1 ? parseNum(cols[idxRecebido]) : 0);

        if (date && time && station) {
          snapshots.add(`${date} ${time}`);
          rows.push({ date, time, station, metrics: { roteirizacao: vRot, carregamento: vRota, recebimento: vRec } });
        }
      }

      setParsedCsvData(rows);
      const sortedSnapshots = Array.from(snapshots).sort((a, b) => b.localeCompare(a));
      setCsvSnapshots(sortedSnapshots);
      if (sortedSnapshots.length > 0) setSelectedSnapshot(sortedSnapshots[0]);
      toast.success("Arquivo carregado com sucesso!");
    };
    reader.readAsText(file);
  };

  const generateAutoTasks = () => {
    if (!selectedSnapshot) return;
    const [selDate, selTime] = selectedSnapshot.split(' ');
    const relevant = parsedCsvData.filter(r => r.date === selDate && r.time === selTime);
    
    const newTasks: ShiftTask[] = [];
    relevant.forEach((row, idx) => {
      const stationReg = regs.stations.find(s => s.name === row.station);
      const target = stationReg?.targetPPH;

      if (row.metrics.roteirizacao > 0) newTasks.push({ id: `a_rot_${idx}_${Date.now()}`, processType: 'Roteirização', clientName: 'Total Express', station: row.station, employee: 'A definir', expectedVolume: row.metrics.roteirizacao, actualVolume: 0, startTime: '', endTime: '', targetPPH: target });
      if (row.metrics.carregamento > 0) newTasks.push({ id: `a_car_${idx}_${Date.now()}`, processType: 'Carregamento', clientName: 'Total Express', station: row.station, employee: 'A definir', expectedVolume: row.metrics.carregamento, actualVolume: 0, startTime: '', endTime: '', targetPPH: target });
      if (row.metrics.recebimento > 0) newTasks.push({ id: `a_rec_${idx}_${Date.now()}`, processType: 'Recebimento', clientName: 'Total Express', station: row.station, employee: 'A definir', expectedVolume: row.metrics.recebimento, actualVolume: 0, startTime: '', endTime: '', targetPPH: target });
    });

    if (newTasks.length > 0) {
      updateData({ tasks: [...data.tasks, ...newTasks] });
      setShowCsvModal(false);
      toast.success(`${newTasks.length} tarefas criadas!`);
    } else {
      toast.warning("Nenhum volume encontrado para este horário.");
    }
  };

  const totalExpected = data.tasks.reduce((sum, t) => sum + (t.expectedVolume || 0), 0);

  return (
    <div className="space-y-6 animate-fade-in">
      <Card>
        <CardHeader title="Identificação" icon={Users} />
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <AutocompleteInput label="Supervisor" value={data.supervisorName} onChange={(e) => updateData({ supervisorName: e.target.value })} options={regs.supervisors} listId="sup-list" />
            <AutocompleteInput label="Turno" value={data.shift} onChange={(e) => updateData({ shift: e.target.value })} options={['1º Turno', '2º Turno', '3º Turno']} listId="shf-list" />
            <Input label="Data" type="date" value={data.date} onChange={(e) => updateData({ date: e.target.value })} />
            <Input label="Início Global" type="time" value={data.globalStartTime} onChange={(e) => updateData({ globalStartTime: e.target.value })} />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader title="Planejamento" icon={ClipboardList} />
        <CardContent>
          <div className="flex flex-wrap gap-2 justify-end mb-4">
             <Button variant="secondary" type="button" onClick={() => setShowCsvModal(true)} className="text-[10px] h-8 font-black uppercase text-emerald-600 border-emerald-200 bg-emerald-50">
               <FileSpreadsheet className="w-3 h-3" /> Gerar via Histórico
             </Button>
             <Button variant="secondary" type="button" onClick={handleImportPending} disabled={isImporting} className="text-[10px] h-8 font-black uppercase text-indigo-600 border-indigo-200 bg-indigo-50">
               {isImporting ? <Loader2 className="animate-spin w-3 h-3" /> : <DownloadCloud className="w-3 h-3" />} Importar Sobras
             </Button>
          </div>

          <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 mb-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <AutocompleteInput label="Colaborador" {...register('employee')} value={watch('employee')} onChange={e => setValue('employee', e.target.value)} options={regs.employees} listId="emp-list" />
              <AutocompleteInput label="Cliente" {...register('clientName')} value={watch('clientName')} onChange={e => setValue('clientName', e.target.value)} options={regs.clients} listId="cli-list" />
              <AutocompleteInput label="Estação" {...register('station')} value={watch('station')} onChange={e => setValue('station', e.target.value)} options={stationNames} listId="sta-list" />
              <AutocompleteInput label="Processo" {...register('processType')} value={watch('processType')} onChange={e => setValue('processType', e.target.value)} options={regs.processes} listId="pro-list" />
              <Input label="Meta Volume" type="number" {...register('expectedVolume', { valueAsNumber: true })} />
              <Button type="button" onClick={handleSubmit(onSubmitTask)} className="h-[42px] mt-6 bg-indigo-600"><Plus size={18} /> Adicionar</Button>
            </div>
          </div>

          <div className="mb-4 flex items-center justify-between px-2">
            <h4 className="text-xs font-black uppercase tracking-widest text-slate-400">Tarefas do Turno</h4>
            <div className="flex items-center gap-2 bg-indigo-50 px-3 py-1 rounded-full border border-indigo-100">
               <Target size={12} className="text-indigo-600" />
               <span className="text-[10px] font-black text-indigo-700 uppercase tracking-tighter">Total Volume: <span className="text-sm">{totalExpected.toLocaleString()}</span></span>
            </div>
          </div>

          <div className="space-y-2">
            {data.tasks.map((t) => (
              <div key={t.id} className="flex justify-between items-center p-3 bg-white border rounded-lg shadow-sm">
                <div className="flex-1">
                  <div className="flex gap-2 mb-1">
                    <span className="text-[9px] font-bold px-1.5 py-0.5 bg-indigo-100 text-indigo-700 rounded uppercase">{t.station}</span>
                    <span className="text-[9px] font-bold px-1.5 py-0.5 bg-slate-100 text-slate-600 rounded uppercase">{t.processType}</span>
                    {t.targetPPH && <span className="text-[9px] font-black px-1.5 py-0.5 bg-amber-100 text-amber-700 rounded uppercase tracking-tighter">Meta: {t.targetPPH} PPH</span>}
                  </div>
                  
                  {editingTaskId === t.id ? (
                    <div className="flex gap-2 items-center mt-1">
                       <input 
                         list="emp-list-edit"
                         type="text"
                         value={tempName}
                         onChange={e => setTempName(e.target.value)}
                         className="text-sm font-bold border-b-2 border-indigo-500 outline-none flex-1 py-1 bg-transparent"
                         autoFocus
                         onKeyDown={e => e.key === 'Enter' && saveName(t.id)}
                       />
                       <datalist id="emp-list-edit">
                         {regs.employees.map((e, idx) => <option key={idx} value={e} />)}
                       </datalist>
                       <button onClick={() => saveName(t.id)} className="p-1.5 bg-emerald-50 text-emerald-600 rounded-lg hover:bg-emerald-100 transition-colors">
                          <Check size={16} />
                       </button>
                       <button onClick={() => setEditingTaskId(null)} className="p-1.5 bg-red-50 text-red-600 rounded-lg hover:bg-red-100 transition-colors">
                          <X size={16} />
                       </button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2 group cursor-pointer" onClick={() => startEditing(t)}>
                      <h4 className="font-bold text-slate-800 text-sm">{t.employee} <span className="font-normal text-slate-400">({t.clientName})</span></h4>
                      <Pencil size={12} className="text-slate-300 group-hover:text-indigo-400 opacity-0 group-hover:opacity-100 transition-all" />
                    </div>
                  )}
                  
                  <p className="text-xs text-slate-500 mt-0.5">Meta Volume: {t.expectedVolume}</p>
                </div>
                <button onClick={() => removeTask(t.id)} className="p-2 text-red-400 hover:bg-red-50 rounded-full ml-2"><Trash2 size={16} /></button>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {showCsvModal && (
        <div className="fixed inset-0 bg-slate-900/60 z-[60] flex items-center justify-center p-4 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white w-full max-w-md rounded-2xl shadow-2xl flex flex-col max-h-[90vh]">
             <div className="p-4 border-b flex justify-between items-center bg-gray-50 rounded-t-2xl">
                <div className="flex items-center gap-2 font-bold text-gray-800"><FileSpreadsheet className="text-emerald-600" size={20} /> Histórico CSV</div>
                <button onClick={() => setShowCsvModal(false)} className="p-2 text-gray-500"><X size={18}/></button>
             </div>
             <div className="p-6 space-y-6">
                {!csvSnapshots.length ? (
                  <label className="border-2 border-dashed border-slate-300 rounded-xl p-8 flex flex-col items-center justify-center bg-slate-50 cursor-pointer hover:bg-slate-100 transition-colors">
                     <input type="file" accept=".csv" onChange={handleCsvUpload} className="hidden" />
                     <DownloadCloud className="text-slate-400 mb-2" size={32} />
                     <span className="text-sm font-bold text-slate-600">Carregar Arquivo CSV</span>
                  </label>
                ) : (
                  <div className="space-y-4">
                     <Select label="Horário do Status" value={selectedSnapshot} onChange={e => setSelectedSnapshot(e.target.value)} options={csvSnapshots.map(s => ({ value: s, label: s }))} />
                     <Button type="button" onClick={generateAutoTasks} className="w-full bg-emerald-600"><Sparkles size={18} /> Gerar Tarefas</Button>
                     <button onClick={() => { setCsvSnapshots([]); setParsedCsvData([]); }} className="w-full text-xs text-slate-400 underline">Trocar Arquivo</button>
                  </div>
                )}
             </div>
          </div>
        </div>
      )}
    </div>
  );
};

export const ExecutionStage: React.FC<StageProps> = ({ data, updateData }) => {
  const updateTask = (id: string, updates: Partial<ShiftTask>) => {
    updateData({
      tasks: data.tasks.map(t => t.id === id ? { ...t, ...updates } : t)
    });
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <Card>
        <CardHeader title="Execução do Turno" icon={Activity} description="Registre o volume realizado e os horários de cada atividade" />
        <CardContent>
          <div className="space-y-4">
            {data.tasks.map((t) => (
              <div key={t.id} className="p-4 bg-slate-50 rounded-xl border border-slate-200">
                <div className="flex justify-between items-start mb-3">
                  <div>
                    <h4 className="font-bold text-slate-800">{t.employee}</h4>
                    <p className="text-[10px] text-slate-500 uppercase font-black">{t.station} • {t.processType} • {t.clientName}</p>
                  </div>
                  <div className="text-right">
                    <span className="text-[10px] font-black text-indigo-600 uppercase tracking-widest">Meta: {t.expectedVolume}</span>
                  </div>
                </div>
                
                <div className="grid grid-cols-2 gap-3">
                  <Input 
                    label="Realizado" 
                    type="number" 
                    value={t.actualVolume} 
                    onChange={e => updateTask(t.id, { actualVolume: Number(e.target.value) })} 
                  />
                  <div className="grid grid-cols-2 gap-2">
                    <Input 
                      label="Início" 
                      type="time" 
                      value={t.startTime} 
                      onChange={e => updateTask(t.id, { startTime: e.target.value })} 
                    />
                    <Input 
                      label="Fim" 
                      type="time" 
                      value={t.endTime} 
                      onChange={e => updateTask(t.id, { endTime: e.target.value })} 
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export const ClosingStage: React.FC<StageProps> = ({ data, updateData }) => {
  return (
    <div className="space-y-6 animate-fade-in">
      <Card>
        <CardHeader title="Fechamento e Segurança" icon={CheckCircle2} />
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Input 
              label="Término Global" 
              type="time" 
              value={data.globalEndTime} 
              onChange={e => updateData({ globalEndTime: e.target.value })} 
            />
            <div className="grid grid-cols-2 gap-2">
              <Input 
                label="Início Almoço" 
                type="time" 
                value={data.lunchStartTime} 
                onChange={e => updateData({ lunchStartTime: e.target.value })} 
              />
              <Input 
                label="Fim Almoço" 
                type="time" 
                value={data.lunchEndTime} 
                onChange={e => updateData({ lunchEndTime: e.target.value })} 
              />
            </div>
          </div>

          <div className="mt-6 space-y-4">
             <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Input 
                  label="Colaboradores Faltantes" 
                  type="number" 
                  value={data.missingEmployeesCount} 
                  onChange={e => updateData({ missingEmployeesCount: Number(e.target.value) })} 
                />
                <Select 
                  label="Status 5S" 
                  value={data.fiveSStatus} 
                  onChange={e => updateData({ fiveSStatus: e.target.value as any })}
                  options={[
                    { value: 'Otimo', label: 'Ótimo' },
                    { value: 'Bom', label: 'Bom' },
                    { value: 'Regular', label: 'Regular' },
                    { value: 'Ruim', label: 'Ruim' },
                  ]}
                />
             </div>

             <TextArea 
               label="Notas sobre EPI / Segurança" 
               value={data.epiNotes} 
               onChange={e => updateData({ epiNotes: e.target.value })} 
               placeholder="Ex: Todos os colaboradores utilizando EPI corretamente."
             />

             <div className="p-4 bg-red-50 rounded-xl border border-red-100">
               <Checkbox 
                 label="Houve Incidente de Segurança?" 
                 checked={data.safetyIncident} 
                 onChange={e => updateData({ safetyIncident: e.target.checked })} 
               />
               {data.safetyIncident && (
                 <TextArea 
                   label="Descrição do Incidente" 
                   value={data.safetyNotes} 
                   onChange={e => updateData({ safetyNotes: e.target.value })} 
                   className="mt-2"
                 />
               )}
             </div>

             <TextArea 
               label="Notas Gerais do Turno" 
               value={data.generalNotes} 
               onChange={e => updateData({ generalNotes: e.target.value })} 
             />
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
