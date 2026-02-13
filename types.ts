
export type ShiftStage = 'START' | 'EXECUTION' | 'CLOSING' | 'SUMMARY' | 'DASHBOARD' | 'REGISTRY' | 'ROUTING' | 'PLANNING_VIEW';

export type ShiftType = string;
export type ProcessType = string;

export interface StationRegistry {
  name: string;
  targetPPH: number;
}

export interface ShiftTask {
  id: string;
  processType: ProcessType;
  clientName: string;
  station: string;
  employee: string;
  expectedVolume: number;
  actualVolume: number;
  startTime: string;
  endTime: string;
  targetPPH?: number; // Armazena a meta no momento da criação da tarefa
}

export interface ShiftData {
  id: string;
  date: string;
  supervisorName: string;
  shift: ShiftType;
  globalStartTime: string;
  globalEndTime: string;
  tasks: ShiftTask[];
  lunchStartTime: string;
  lunchEndTime: string;
  lunchBreakMinutes: number;
  safetyChecklist: boolean;
  safetyIncident: boolean;
  safetyNotes: string;
  fiveSStatus: 'Otimo' | 'Bom' | 'Regular' | 'Ruim';
  fiveSNotes: string;
  generalNotes: string;
  missingEmployeesCount: number;
  epiNotes: string;
  aiAnalysis?: string;
}

export interface RegistryData {
  employees: string[];
  clients: string[];
  stations: StationRegistry[]; // Alterado de string[] para StationRegistry[]
  processes: string[];
  supervisors: string[];
}

const getLocalDate = () => {
  const now = new Date();
  const offset = now.getTimezoneOffset();
  const localDate = new Date(now.getTime() - (offset * 60 * 1000));
  return localDate.toISOString().split('T')[0];
};

export const INITIAL_REGISTRY: RegistryData = {
  employees: [],
  clients: ['Total Express', 'Imille', 'Anjun', 'Menezes'],
  stations: [],
  processes: ['Recebimento', 'Roteirização', 'Carregamento'],
  supervisors: []
};

export const INITIAL_SHIFT_DATA: ShiftData = {
  id: '',
  date: getLocalDate(),
  supervisorName: '',
  shift: '1º Turno',
  globalStartTime: '',
  globalEndTime: '',
  lunchStartTime: '',
  lunchEndTime: '',
  lunchBreakMinutes: 0,
  tasks: [],
  safetyChecklist: false,
  safetyIncident: false,
  safetyNotes: '',
  fiveSStatus: 'Bom',
  fiveSNotes: '',
  generalNotes: '',
  missingEmployeesCount: 0,
  epiNotes: '',
};
