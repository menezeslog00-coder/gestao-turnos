
import React, { useState } from 'react';
import { RegistryData, StationRegistry } from '../types';
import { Card, CardHeader, CardContent, Button } from '../components/ui';
import { Users, Building2, MapPin, Settings2, Trash2, Plus, UserCheck, Cloud, X, Target } from 'lucide-react';
import { toast } from 'sonner';

interface RegistryScreenProps {
  onBack: () => void;
  sheetsUrl: string;
  registries: RegistryData;
  onUpdateRegistries: (newRegs: RegistryData) => void;
}

export const RegistryScreen: React.FC<RegistryScreenProps> = ({ onBack, registries, onUpdateRegistries }) => {
  const [activeTab, setActiveTab] = useState<keyof RegistryData>('employees');
  const [newItem, setNewItem] = useState('');
  const [targetPPH, setTargetPPH] = useState<string>('200');

  const addItem = () => {
    if (!newItem.trim()) return;

    const updatedRegistries = { ...registries };

    if (activeTab === 'stations') {
      const pphValue = parseInt(targetPPH) || 0;
      if (registries.stations.some(s => s.name === newItem.trim())) {
        toast.warning("Estação já cadastrada.");
        return;
      }
      updatedRegistries.stations = [...registries.stations, { name: newItem.trim(), targetPPH: pphValue }].sort((a, b) => a.name.localeCompare(b.name));
    } else {
      const currentList = registries[activeTab] as string[];
      if (currentList.includes(newItem.trim())) {
        toast.warning("Item já existe nos cadastros.");
        return;
      }
      (updatedRegistries[activeTab] as string[]) = [...currentList, newItem.trim()].sort();
    }
    
    onUpdateRegistries(updatedRegistries);
    setNewItem('');
    toast.success("Adicionado com sucesso!");
  };

  const removeItem = (itemToRemove: string | StationRegistry) => {
    const updatedRegistries = { ...registries };
    
    if (activeTab === 'stations') {
      const nameToRemove = typeof itemToRemove === 'string' ? itemToRemove : itemToRemove.name;
      updatedRegistries.stations = registries.stations.filter(s => s.name !== nameToRemove);
    } else {
      (updatedRegistries[activeTab] as string[]) = (registries[activeTab] as string[]).filter(i => i !== itemToRemove);
    }
    
    onUpdateRegistries(updatedRegistries);
    toast.info("Item removido.");
  };

  const tabs: { id: keyof RegistryData; label: string; icon: any }[] = [
    { id: 'employees', label: 'Operadores', icon: Users },
    { id: 'supervisors', label: 'Supervisores', icon: UserCheck },
    { id: 'clients', label: 'Clientes', icon: Building2 },
    { id: 'stations', label: 'Estações', icon: MapPin },
    { id: 'processes', label: 'Processos', icon: Settings2 },
  ];

  return (
    <div className="space-y-6 animate-fade-in pb-20">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-black text-gray-900 uppercase italic">Cadastros <span className="text-indigo-600">Pro</span></h2>
        <button onClick={onBack} className="p-2 text-gray-400 hover:bg-gray-100 rounded-lg transition-all active:scale-90"><X size={20}/></button>
      </div>

      <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide no-scrollbar">
        {tabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-2 px-4 py-2 rounded-full text-[10px] font-black uppercase tracking-tight transition-all border whitespace-nowrap shrink-0 ${
              activeTab === tab.id 
                ? 'bg-indigo-600 text-white border-indigo-600 shadow-lg shadow-indigo-100' 
                : 'bg-white text-gray-500 border-gray-200'
            }`}
          >
            <tab.icon size={12} />
            {tab.label}
          </button>
        ))}
      </div>

      <Card className="border-indigo-50">
        <CardHeader 
          title={`Gerenciar ${tabs.find(t => t.id === activeTab)?.label}`} 
          icon={tabs.find(t => t.id === activeTab)?.icon} 
        />
        <CardContent>
          <div className="flex flex-col gap-3 mb-6 bg-slate-50 p-3 rounded-xl border border-slate-100">
            <div className="flex-1">
              <label className="block text-[10px] font-black text-slate-400 uppercase mb-1">Nome do Item</label>
              <input 
                value={newItem} 
                onChange={e => setNewItem(e.target.value)}
                placeholder="Digite o nome..."
                className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-sm font-bold focus:ring-2 focus:ring-indigo-500 outline-none"
              />
            </div>
            
            {activeTab === 'stations' && (
              <div className="flex-1">
                <label className="block text-[10px] font-black text-slate-400 uppercase mb-1">Meta PPH (Peças/Hora)</label>
                <div className="relative">
                  <Target size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-indigo-400" />
                  <input 
                    type="number"
                    value={targetPPH} 
                    onChange={e => setTargetPPH(e.target.value)}
                    className="w-full bg-white border border-slate-200 rounded-lg pl-9 pr-3 py-2 text-sm font-bold focus:ring-2 focus:ring-indigo-500 outline-none"
                  />
                </div>
              </div>
            )}
            
            <Button onClick={addItem} className="bg-indigo-600 h-10 w-full rounded-lg shadow-md mt-1"><Plus size={18}/> Adicionar Cadastro</Button>
          </div>

          <div className="space-y-1.5 max-h-[400px] overflow-y-auto pr-1">
            {activeTab === 'stations' ? (
              registries.stations.map(station => (
                <div key={station.name} className="flex justify-between items-center p-3 bg-white hover:bg-slate-50 rounded-xl border border-slate-100 transition-colors">
                  <div>
                    <span className="text-xs font-black text-slate-700 uppercase">{station.name}</span>
                    <div className="flex items-center gap-1 text-[9px] font-bold text-indigo-500 uppercase mt-0.5">
                      <Target size={10} /> Meta: {station.targetPPH} PPH
                    </div>
                  </div>
                  <button onClick={() => removeItem(station.name)} className="p-1.5 text-slate-300 hover:text-red-500 rounded-lg">
                    <Trash2 size={16} />
                  </button>
                </div>
              ))
            ) : (
              (registries[activeTab] as string[]).map(item => (
                <div key={item} className="flex justify-between items-center p-3 bg-white hover:bg-slate-50 rounded-xl border border-slate-100 transition-colors">
                  <span className="text-xs font-black text-slate-700 uppercase">{item}</span>
                  <button onClick={() => removeItem(item)} className="p-1.5 text-slate-300 hover:text-red-500 rounded-lg">
                    <Trash2 size={16} />
                  </button>
                </div>
              ))
            )}
            
            {(activeTab === 'stations' ? registries.stations.length : (registries[activeTab] as string[]).length) === 0 && (
              <div className="text-center py-10 text-slate-400">
                 <p className="text-xs font-bold uppercase tracking-widest">Lista Vazia</p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
