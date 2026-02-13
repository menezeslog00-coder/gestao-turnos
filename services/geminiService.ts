
import { GoogleGenAI } from "@google/genai";
import { ShiftData } from "../types";

const getHoursDiff = (start: string, end: string): number => {
  if (!start || !end) return 0;
  const d1 = new Date(`1970-01-01T${start}:00`);
  const d2 = new Date(`1970-01-01T${end}:00`);
  const diffMs = d2.getTime() - d1.getTime();
  return diffMs > 0 ? diffMs / (1000 * 60 * 60) : 0;
};

export const generateShiftAnalysis = async (data: ShiftData): Promise<string> => {
  // Inicializa o cliente imediatamente antes do uso
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

  try {
    const totalShiftHours = getHoursDiff(data.globalStartTime, data.globalEndTime);
    let breakHours = getHoursDiff(data.lunchStartTime, data.lunchEndTime);
    const netWorkedHours = Math.max(0.5, totalShiftHours - breakHours);

    // Formatação dos dados focada em PPH para a IA
    const tasksFormatted = data.tasks.map((t) => {
      let taskDuration = netWorkedHours;
      if (t.startTime && t.endTime) {
        taskDuration = getHoursDiff(t.startTime, t.endTime) || netWorkedHours;
      }

      const realPPH = Math.round(t.actualVolume / taskDuration);
      const targetPPH = t.targetPPH || 200; // Meta cadastrada
      const pphEfficiency = Math.round((realPPH / targetPPH) * 100);
      
      return `- Colaborador: ${t.employee} | Estação: ${t.station} | PPH Real: ${realPPH} | Meta PPH: ${targetPPH} | Eficiência: ${pphEfficiency}%`;
    }).join('\n');

    const prompt = `
      Atue como Gerente de Operações Logísticas Sênior. Sua análise deve ser baseada UNICAMENTE no PPH (Peças por Hora).
      Ignore o volume total bruto, pois ele não reflete a produtividade sem o contexto do PPH.

      CONTEXTO DO TURNO:
      - Supervisor: ${data.supervisorName} | Turno: ${data.shift}
      - Faltas: ${data.missingEmployeesCount}
      
      DADOS DE PERFORMANCE (REAL VS META):
      ${tasksFormatted}
      
      DADOS DE SEGURANÇA E QUALIDADE:
      - Status 5S: ${data.fiveSStatus}
      - Segurança/EPI: ${data.epiNotes || 'Nenhuma ocorrência'}
      - Notas Gerais: ${data.generalNotes}

      GERE O RELATÓRIO EM MARKDOWN:

      1. ## Eficiência Baseada em PPH
      Analise o PPH médio do turno em relação às metas estabelecidas. Mencione se as faltas impactaram a cadência.

      2. ## Tabela de Produtividade (Métricas PPH)
      | Colaborador | Estação | PPH Real | Meta | % Eficiência |
      | :--- | :--- | :--- | :--- | :--- |

      3. ## Top Performance e Gargalos
      - Destaque nominalmente quem superou a Meta PPH.
      - Identifique quem ficou abaixo da meta de PPH e aponte possíveis gargalos.

      4. ## Segurança e Conformidade
      Resumo sobre o 5S e o uso de EPIs relatado.

      DIRETRIZES:
      - Não use asteriscos excessivos. 
      - Foque na eficiência do tempo, não no volume bruto.
    `;

    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: [{ parts: [{ text: prompt }] }],
    });

    return response.text || "Análise concluída.";
  } catch (error) {
    console.error("Erro Gemini:", error);
    // Retorna o erro de forma legível para que o usuário saiba o que aconteceu
    throw new Error(`Falha na comunicação com a IA: ${error instanceof Error ? error.message : 'Erro desconhecido'}`);
  }
};
