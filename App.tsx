
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { ShiftData, ShiftStage, INITIAL_SHIFT_DATA, RegistryData, INITIAL_REGISTRY, StationRegistry } from './types';
import { StartStage, ExecutionStage, ClosingStage } from './components/Stages';
import { Dashboard } from './components/Dashboard';
import { RegistryScreen } from './screens/RegistryScreen';
import { RoutingDashboard } from './components/RoutingDashboard';
import { PlanningViewScreen } from './screens/PlanningViewScreen';
import { PassagemDeTurnoCard } from './components/ShiftSummary';
import { generateShiftAnalysis } from './services/geminiService';
import { saveShiftToGoogleSheets, getAllDataFromCloud, saveRegistriesToCloud } from './services/googleSheetsService';
import { getRegistries, saveRegistries } from './services/registryService';
import { Button } from './components/ui';
import { 
  ChevronRight, RotateCcw, Loader2, Truck, 
  LayoutDashboard, ListChecks, Search, Table,
  CheckCircle2, FileSpreadsheet, Cloud, CloudOff, RefreshCw, AlertCircle, Save
} from 'lucide-react';
import { QueryClientProvider } from '@tanstack/react-query';
import { queryClient } from './config/queryClient';
import { Toaster, toast } from 'sonner';
import { startStageSchema } from './utils/validators/shiftSchema';
import { z } from 'zod';

const DEFAULT_SHEETS_URL = "https://script.google.com/macros/s/AKfycby5omxWsXawDUrlLnc5RvGeiEvMPMOUKLiKuoRw3XQttJgOccatI6IPZpwqUK2IrnQt/exec";

const AppContent: React.FC = () => {
  const [stage, setStage] = useState<ShiftStage>(() => (localStorage.getItem('shift_stage') as ShiftStage) || 'START');
  const [data, setData] = useState<ShiftData>(() => {
    const s = localStorage.getItem('shift_data');
    return s ? JSON.parse(s) : { ...INITIAL_SHIFT_DATA, id: Date.now().toString() };
  });
  
  const [historyData, setHistoryData] = useState<ShiftData[]>([]);
  const [registries, setRegistriesState] = useState<RegistryData>(getRegistries());
  const [isLoading, setIsLoading] = useState(true);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [syncStatus, setSyncStatus] = useState<'synced' | 'syncing' | 'error' | 'idle'>('idle');
  const [sheetsUrl] = useState(DEFAULT_SHEETS_URL);
  
  const registrySyncTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const fetchCloudData = useCallback(async (silent = false) => {
    if (!silent) setIsLoading(true);
    setSyncStatus('syncing');
    
    try {
      const cloud = await getAllDataFromCloud(sheetsUrl);
      
      if (cloud && cloud.result === 'success') {
        setHistoryData(Array.isArray(cloud.history) ? cloud.history : []);
        
        if (cloud.registry) {
           const cloudRegistry = { ...cloud.registry } as RegistryData;
           if (Array.isArray(cloudRegistry.stations)) {
             cloudRegistry.stations = cloudRegistry.stations.map((s: any) => {
               if (typeof s === 'string') return { name: s, targetPPH: 200 };
               if (s && typeof s === 'object' && s.name) return s as StationRegistry;
               return { name: String(s), targetPPH: 200 };
             });
           }
           saveRegistries(cloudRegistry);
           setRegistriesState(cloudRegistry);
           if (!silent) toast.success("Dados sincronizados!");
        }
        setSyncStatus('synced');
      } else {
        throw new Error(cloud.message || "Erro na resposta da planilha.");
      }
    } catch (e) {
      console.error("Erro fetchCloudData:", e);
      setSyncStatus('error');
      if (!silent) toast.error("Falha ao carregar dados da nuvem.");
    } finally {
      if (!silent) setIsLoading(false);
    }
  }, [sheetsUrl]);

  useEffect(() => {
    fetchCloudData();
  }, [fetchCloudData]);

  const updateData = (u: Partial<ShiftData>) => {
    setData(prev => {
      const newData = { ...prev, ...u };
      localStorage.setItem('shift_data', JSON.stringify(newData));
      return newData;
    });
  };

  const updateRegistries = useCallback((newRegs: RegistryData) => {
    setRegistriesState(newRegs);
    saveRegistries(newRegs);

    if (registrySyncTimeoutRef.current) clearTimeout(registrySyncTimeoutRef.current);
    setSyncStatus('syncing');
    
    registrySyncTimeoutRef.current = setTimeout(async () => {
      const res = await saveRegistriesToCloud(sheetsUrl, newRegs);
      setSyncStatus(res.success ? 'synced' : 'error');
    }, 3000);
  }, [sheetsUrl]);

  useEffect(() => { 
    localStorage.setItem('shift_stage', stage); 
  }, [stage]);

  const handleNext = async () => {
    try {
      if (stage === 'START') {
        startStageSchema.parse(data);
        setStage('EXECUTION');
      } else if (stage === 'EXECUTION') {
        setStage('CLOSING');
      } else if (stage === 'CLOSING') {
        setIsAnalyzing(true);
        setSyncStatus('syncing');
        
        let aiAnalysis = "";
        try {
          aiAnalysis = await generateShiftAnalysis(data);
        } catch (aiErr) {
          console.error("Erro na IA:", aiErr);
          aiAnalysis = "Análise automática indisponível no momento. Os dados brutos foram salvos.";
        }

        const updatedData = { ...data, aiAnalysis };
        updateData({ aiAnalysis });

        const resSync = await saveShiftToGoogleSheets(sheetsUrl, updatedData);
        
        setIsAnalyzing(false);
        if (resSync.success) {
          setSyncStatus('synced');
          toast.success("Turno finalizado com sucesso!");
          setStage('SUMMARY');
          localStorage.removeItem('shift_data');
          localStorage.removeItem('shift_stage');
        } else {
          setSyncStatus('error');
          toast.error("Salvo localmente. Erro ao enviar para a nuvem.");
          setStage('SUMMARY');
        }
      }
    } catch (e: any) {
      if (e instanceof z.ZodError) {
        const firstError = e.issues[0]?.message || "Preencha os campos obrigatórios";
        toast.error("Verificação Necessária", { description: firstError });
      } else {
        toast.error("Erro inesperado");
      }
    }
  };

  const getSyncIndicator = () => {
    const styles = {
      syncing: "text-amber-500 bg-amber-50 animate-pulse border-amber-200",
      synced: "text-emerald-600 bg-emerald-50 border-emerald-200 shadow-sm",
      error: "text-red-600 bg-red-50 border-red-200",
      idle: "text-slate-400 bg-slate-50 border-slate-200"
    };
    const icons = { syncing: <RefreshCw size={10} className="animate-spin" />, synced: <Cloud size={10} />, error: <AlertCircle size={10} />, idle: <Cloud size={10} /> };

    return (
      <button onClick={() => fetchCloudData(false)} className={`flex items-center gap-1.5 px-3 py-1 rounded-full border ${styles[syncStatus]} transition-all active:scale-95`}>
        {icons[syncStatus]}
        <span className="text-[9px] font-black uppercase tracking-tighter">{syncStatus === 'syncing' ? 'Sincronizando...' : syncStatus === 'error' ? 'Offline' : 'Nuvem OK'}</span>
      </button>
    );
  };

  const isWideLayout = stage === 'PLANNING_VIEW' || stage === 'DASHBOARD' || stage === 'ROUTING';

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans text-slate-900 overflow-x-hidden">
      <Toaster position="top-right" richColors />
      
      <header className="bg-white border-b border-slate-200 px-6 h-16 flex items-center justify-between sticky top-0 z-50 shadow-sm safe-top">
        <div className="flex items-center gap-4">
          <div className="bg-indigo-600 p-2 rounded-xl shadow-lg shadow-indigo-100">
             <Truck className="text-white w-6 h-6" />
          </div>
          <div>
            <h1 className="font-black text-slate-900 text-lg leading-none uppercase italic tracking-tighter">Líder<span className="text-indigo-600">Pro</span></h1>
            <div className="mt-1">{getSyncIndicator()}</div>
          </div>
        </div>
        <div className="flex gap-2">
          {stage === 'START' && (
            <>
              <button onClick={() => setStage('PLANNING_VIEW')} className="p-3 text-slate-500 hover:bg-slate-50 rounded-xl transition-all" title="Planilha de Planejamento"><Table size={22}/></button>
              <button onClick={() => setStage('ROUTING')} className="p-3 text-indigo-600 bg-indigo-50 rounded-xl transition-all" title="Roteirização"><FileSpreadsheet size={22}/></button>
              <button onClick={() => setStage('REGISTRY')} className="p-3 text-slate-500 hover:bg-slate-50 rounded-xl transition-all" title="Cadastros"><ListChecks size={22}/></button>
              <button onClick={() => setStage('DASHBOARD')} className="p-3 text-indigo-600 hover:bg-slate-50 rounded-xl transition-all" title="Dashboard Geral"><LayoutDashboard size={22}/></button>
            </>
          )}
        </div>
      </header>

      <main className={`mx-auto w-full p-4 flex-1 pb-32 transition-all duration-500 ${isWideLayout ? 'max-w-7xl px-4 md:px-8' : 'max-w-2xl'}`}>
        {!isWideLayout && (
          <div className="mb-6 flex items-center gap-3">
             <div className={`h-1.5 flex-1 rounded-full transition-all duration-500 ${['START', 'EXECUTION', 'CLOSING', 'SUMMARY'].includes(stage) ? 'bg-indigo-600' : 'bg-slate-200'}`} />
             <div className={`h-1.5 flex-1 rounded-full transition-all duration-500 ${['EXECUTION', 'CLOSING', 'SUMMARY'].includes(stage) ? 'bg-indigo-600' : 'bg-slate-200'}`} />
             <div className={`h-1.5 flex-1 rounded-full transition-all duration-500 ${['CLOSING', 'SUMMARY'].includes(stage) ? 'bg-indigo-600' : 'bg-slate-200'}`} />
          </div>
        )}

        {stage === 'REGISTRY' && <RegistryScreen onBack={() => setStage('START')} sheetsUrl={sheetsUrl} registries={registries} onUpdateRegistries={updateRegistries} />}
        {stage === 'ROUTING' && <RoutingDashboard onBack={() => setStage('START')} registries={registries} />}
        {stage === 'PLANNING_VIEW' && <PlanningViewScreen onBack={() => setStage('START')} />}
        {stage === 'DASHBOARD' && <Dashboard history={historyData} onBack={() => setStage('START')} onRefresh={() => fetchCloudData(false)} />}
        
        {stage === 'START' && <StartStage data={data} updateData={updateData} sheetsUrl={sheetsUrl} registries={registries} />}
        {stage === 'EXECUTION' && <ExecutionStage data={data} updateData={updateData} registries={registries} />}
        {stage === 'CLOSING' && <ClosingStage data={data} updateData={updateData} />}
        
        {stage === 'SUMMARY' && (
          <div className="space-y-6 animate-fade-in max-w-2xl mx-auto">
             <PassagemDeTurnoCard data={data} />
             <Button variant="secondary" onClick={() => { setData({...INITIAL_SHIFT_DATA, id: Date.now().toString()}); setStage('START'); }} className="w-full h-14 rounded-2xl font-black uppercase text-xs shadow-lg">
                Novo Ciclo de Turno
             </Button>
          </div>
        )}

        {['START', 'EXECUTION', 'CLOSING'].includes(stage) && (
          <div className="fixed bottom-0 left-0 right-0 p-4 bg-white/90 backdrop-blur-md border-t border-slate-100 flex justify-center z-40 safe-bottom">
             <div className={`w-full flex gap-3 ${isWideLayout ? 'max-w-7xl' : 'max-w-2xl'}`}>
                {stage !== 'START' && <Button variant="secondary" onClick={() => setStage(stage==='CLOSING'?'EXECUTION':'START')} className="flex-1 h-14 rounded-2xl font-bold">Voltar</Button>}
                <Button onClick={handleNext} className={`flex-[2] h-14 font-black uppercase tracking-tight rounded-2xl shadow-xl transition-all active:scale-[0.98] ${stage === 'CLOSING' ? 'bg-emerald-600 shadow-emerald-100' : 'bg-indigo-600 shadow-indigo-100'}`}>
                  {isAnalyzing ? <Loader2 className="animate-spin" /> : stage === 'CLOSING' ? 'Salvar e Encerrar' : 'Próxima Etapa'} <ChevronRight size={20} className="ml-1"/>
                </Button>
             </div>
          </div>
        )}
      </main>
    </div>
  );
};

const App: React.FC = () => (
  <QueryClientProvider client={queryClient}>
    <AppContent />
  </QueryClientProvider>
);

export default App;
