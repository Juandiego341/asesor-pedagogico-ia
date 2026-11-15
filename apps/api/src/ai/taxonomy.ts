/** Taxonomía de categorías de IA usada para clasificar temáticas en el mapa mental. */
export const AI_CATEGORIES = [
  'Fundamentos de IA',
  'Datos y preprocesamiento',
  'Aprendizaje automático',
  'Aprendizaje profundo',
  'Procesamiento de lenguaje natural',
  'Visión por computador',
  'IA generativa y LLM',
  'Agentes, búsqueda y razonamiento',
  'Evaluación de modelos',
  'Ingeniería y despliegue de IA',
  'Ética y IA responsable',
] as const;
export type AiCategory = (typeof AI_CATEGORIES)[number];

const KEYWORDS: [AiCategory, RegExp][] = [
  ['Ética y IA responsable', /[eé]tica|sesgo|responsab|privacidad|explicab|transparen|regulaci/i],
  ['Agentes, búsqueda y razonamiento', /agente|b[uú]squeda|heur[ií]stic|\ba\*|minimax|planificaci|razonamiento|l[oó]gica|refuerzo|q-?learning|\bmcp\b|herramienta|function calling/i],
  ['Datos y preprocesamiento', /datos|preprocesa|limpieza|\beda\b|exploratori|normaliza|pandas|feature|caracter[ií]stica/i],
  ['Evaluación de modelos', /m[eé]trica|evaluaci[oó]n|validaci[oó]n cruzada|matriz de confusi|overfit|sobreajuste|curvas? de aprendizaje|precisi[oó]n|recall|\broc\b/i],
  ['Visión por computador', /visi[oó]n|imagen|\bcnn\b|convolucion|yolo|opencv|detecci[oó]n de objetos|segmentaci/i],
  ['Procesamiento de lenguaje natural', /lenguaje natural|\bpln\b|\bnlp\b|texto|token|sentimiento|tf-?idf|\bbert\b|spacy|nltk|embedding/i],
  ['Aprendizaje profundo', /red(es)? neuronal|deep|profundo|perceptr|backprop|retropropagaci|keras|pytorch|tensorflow|lstm|\brnn\b/i],
  ['IA generativa y LLM', /\bllm|gpt|prompt|generativ|\brag\b|recuperaci[oó]n|transformer|chatbot|langchain|fine.?tun|difusi[oó]n|\bgan\b|modelos? de lenguaje/i],
  ['Aprendizaje automático', /aprendizaje (autom[aá]tico|supervisado|no supervisado)|machine learning|regresi[oó]n|clasificaci[oó]n|clustering|k-?means|[aá]rbol|random forest|\bsvm\b|knn|scikit/i],
  ['Ingeniería y despliegue de IA', /despliegue|\bapi\b|docker|mlops|producci[oó]n|streamlit|gradio|fastapi|integraci[oó]n|nube|pruebas|software/i],
  ['Fundamentos de IA', /.*/],
];

export function classifyTopic(name: string): AiCategory {
  return KEYWORDS.find(([, re]) => re.test(name))![0];
}

export function masteryLabel(score: number | null) {
  if (score === null || Number.isNaN(score)) return 'Sin evidencia';
  if (score < 2) return 'Inicial';
  if (score < 3) return 'Básico';
  if (score < 4) return 'Intermedio';
  if (score < 4.6) return 'Avanzado';
  return 'Sobresaliente';
}
