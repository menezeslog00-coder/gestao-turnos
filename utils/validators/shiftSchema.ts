
import { z } from 'zod';

// Validação para tarefas individuais
export const taskSchema = z.object({
  clientName: z.string().min(1, 'Selecione um cliente para a tarefa'),
  station: z.string().min(1, 'Selecione uma estação para a tarefa'),
  processType: z.string().min(1, 'Selecione um processo para a tarefa'),
  employee: z.string().min(2, 'Informe o nome do colaborador'),
  expectedVolume: z.number().min(1, 'A meta de volume deve ser informada'),
});

// Schema parcial para validação do estágio INICIAL
export const startStageSchema = z.object({
  supervisorName: z.string().min(2, 'Nome do supervisor é obrigatório'),
  shift: z.string().min(1, 'Selecione o turno de trabalho'),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Data informada é inválida'),
  globalStartTime: z.string().regex(/^\d{2}:\d{2}$/, 'Horário de início do turno é obrigatório'),
  tasks: z.array(z.any()).min(1, 'Adicione pelo menos uma tarefa ao planejamento para continuar'),
});

// Schema completo para fechamento
export const shiftSchema = startStageSchema.extend({
  globalEndTime: z.string().min(5, 'Horário de término do turno é obrigatório'),
  fiveSStatus: z.enum(['Otimo', 'Bom', 'Regular', 'Ruim']),
  safetyIncident: z.boolean(),
});

export type TaskFormData = z.infer<typeof taskSchema>;
