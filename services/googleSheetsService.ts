
import { ShiftData, RegistryData } from "../types";

/**
 * Salva os dados do turno na planilha via POST.
 */
export const saveShiftToGoogleSheets = async (scriptUrl: string, data: ShiftData) => {
  if (!scriptUrl || !scriptUrl.startsWith('http')) return { success: false };
  
  try {
    await fetch(scriptUrl, {
      method: "POST",
      mode: "no-cors",
      headers: { "Content-Type": "text/plain" },
      body: JSON.stringify({ action: 'SAVE_SHIFT', data }),
    });
    return { success: true };
  } catch (error) {
    console.error("Erro no saveShiftToGoogleSheets:", error);
    return { success: false };
  }
};

/**
 * Salva os cadastros na planilha via POST.
 */
export const saveRegistriesToCloud = async (scriptUrl: string, data: RegistryData) => {
  if (!scriptUrl || !scriptUrl.startsWith('http')) return { success: false };
  
  try {
    const hasData = Object.values(data).some(arr => Array.isArray(arr) && arr.length > 0);
    if (!hasData) return { success: false, message: 'Dados vazios' };

    await fetch(scriptUrl, {
      method: "POST",
      mode: "no-cors",
      headers: { "Content-Type": "text/plain" },
      body: JSON.stringify({ action: 'SAVE_REGISTRY', data }),
    });
    return { success: true };
  } catch (error) {
    console.error("Erro no saveRegistriesToCloud:", error);
    return { success: false };
  }
};

/**
 * Busca todos os dados da nuvem via GET.
 */
export const getAllDataFromCloud = async (scriptUrl: string) => {
  if (!scriptUrl || !scriptUrl.startsWith('http')) {
    return { result: 'error', message: 'URL da planilha inválida ou pendente.' };
  }
  
  try {
    const baseUrl = scriptUrl.split('?')[0];
    const finalUrl = `${baseUrl}?action=GET_ALL_DATA&_cb=${Date.now()}`;

    const response = await fetch(finalUrl);
    
    if (!response.ok) {
      throw new Error(`Servidor respondeu com status ${response.status}`);
    }

    const text = await response.text();
    
    if (text.trim().startsWith('<')) {
      throw new Error("A planilha retornou HTML. Verifique se o Script está publicado como 'Qualquer pessoa' (Anyone).");
    }

    try {
      return JSON.parse(text);
    } catch (e) {
      console.error("Erro ao processar JSON:", text.substring(0, 200));
      throw new Error("A resposta da planilha não é um JSON válido.");
    }
  } catch (error) {
    console.warn("Falha na sincronização:", error);
    
    let userMessage = "Erro de conexão com a planilha.";
    if (error instanceof TypeError && error.message.includes('fetch')) {
      userMessage = "Erro de CORS: Certifique-se de que o Script está publicado como 'Qualquer pessoa' e que você está online.";
    } else if (error instanceof Error) {
      userMessage = error.message;
    }

    return { result: 'error', message: userMessage };
  }
};

/**
 * Auxiliar para buscar dados do último turno que contenha tarefas.
 * Inverte o histórico para garantir que pega o MAIS RECENTE.
 */
export const getLastShiftData = async (scriptUrl: string, currentShiftId?: string) => {
  const res = await getAllDataFromCloud(scriptUrl);
  if (res && res.result === 'success' && Array.isArray(res.history)) {
    // Inverte o histórico: os novos estão no fim da planilha, queremos eles primeiro.
    const reversedHistory = [...res.history].reverse();
    
    // Busca o turno mais recente que tenha tarefas e NÃO seja o ID atual
    const lastWithTasks = reversedHistory.find(h => 
      h.id?.toString() !== currentShiftId?.toString() &&
      Array.isArray(h.tasks) && 
      h.tasks.length > 0
    );
    
    if (lastWithTasks) {
      return { success: true, data: lastWithTasks, history: res.history };
    }
  }
  return { success: false };
};
