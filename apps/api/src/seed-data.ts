import type { RubricContent } from './rubrics/rubric';

export interface LabSeed { cohort: number; order: number; title: string; description: string; objectives: string; topics: string[]; criteria: [string, string, string, number, string[]][] }
// criteria: [competencia, nombre, descripción, peso, descriptores (Excelente, Bueno, Aceptable, Insuficiente)]

export const LABS: LabSeed[] = [
  {
    cohort: 1, order: 1, title: 'Laboratorio 1 · Agentes inteligentes y algoritmos de búsqueda',
    description: 'Modelar un problema como espacio de estados y resolverlo con un agente que usa búsqueda no informada (BFS, DFS) y búsqueda heurística (A*), comparando su desempeño.',
    objectives: 'Formular problemas como búsqueda; implementar BFS, DFS y A*; diseñar heurísticas admisibles; comparar nodos expandidos y tiempo.',
    topics: ['Agentes inteligentes', 'Búsqueda no informada', 'Búsqueda heurística A*', 'Heurísticas admisibles'],
    criteria: [
      ['Comprensión conceptual', 'Formulación del problema', 'Define estados, acciones, estado inicial, prueba de meta y costo de camino.', 20, ['Formulación completa, formal y justificada del espacio de estados.', 'Formulación correcta con detalles menores faltantes.', 'Formulación parcial o con imprecisiones.', 'No formula el problema como búsqueda.']],
      ['Implementación técnica', 'Implementación de algoritmos de búsqueda', 'Implementa BFS, DFS y A* correctamente en Python.', 30, ['Los tres algoritmos funcionan, con código modular y documentado.', 'Los algoritmos funcionan con deficiencias menores de diseño.', 'Implementación incompleta o con errores.', 'No implementa los algoritmos o no ejecutan.']],
      ['Implementación técnica', 'Diseño de la heurística', 'Propone una heurística admisible y argumenta su admisibilidad.', 20, ['Heurística admisible demostrada y comparada con alternativas.', 'Heurística admisible con argumentación básica.', 'Heurística sin justificar su admisibilidad.', 'No propone heurística.']],
      ['Análisis y comunicación', 'Análisis comparativo de resultados', 'Compara nodos expandidos, tiempo y optimalidad con tablas o gráficas.', 20, ['Análisis cuantitativo riguroso con conclusiones sustentadas.', 'Comparación correcta con conclusiones generales.', 'Comparación superficial.', 'No presenta análisis.']],
      ['Análisis y comunicación', 'Calidad del informe', 'Estructura, redacción, referencias y claridad del informe.', 10, ['Informe claro, completo y con referencias.', 'Informe claro con detalles por mejorar.', 'Informe desorganizado o incompleto.', 'Informe ausente o ilegible.']],
    ],
  },
  {
    cohort: 1, order: 2, title: 'Laboratorio 2 · Aprendizaje supervisado con scikit-learn',
    description: 'Construir un pipeline de aprendizaje supervisado: análisis exploratorio, preprocesamiento, entrenamiento de al menos dos modelos de clasificación y evaluación con validación cruzada.',
    objectives: 'Aplicar preprocesamiento de datos; entrenar modelos de clasificación; evaluar con métricas adecuadas y validación cruzada; interpretar resultados.',
    topics: ['Preprocesamiento de datos', 'Clasificación supervisada', 'Métricas de evaluación', 'Validación cruzada'],
    criteria: [
      ['Comprensión conceptual', 'Análisis exploratorio y preprocesamiento', 'Explora los datos, trata valores faltantes, escala y codifica variables.', 25, ['EDA completo con decisiones de preprocesamiento justificadas.', 'EDA y preprocesamiento correctos con justificación parcial.', 'Preprocesamiento básico sin análisis.', 'No realiza preprocesamiento.']],
      ['Implementación técnica', 'Entrenamiento de modelos', 'Entrena y ajusta al menos dos modelos de clasificación.', 30, ['Dos o más modelos con ajuste de hiperparámetros y pipeline reproducible.', 'Dos modelos entrenados correctamente.', 'Un solo modelo o entrenamiento con errores.', 'No entrena modelos.']],
      ['Análisis y comunicación', 'Evaluación con métricas y validación cruzada', 'Usa precisión, recall, F1, matriz de confusión y validación cruzada.', 30, ['Evaluación rigurosa con validación cruzada e interpretación de métricas.', 'Métricas adecuadas con interpretación general.', 'Solo exactitud o evaluación sin validación.', 'No evalúa los modelos.']],
      ['Análisis y comunicación', 'Conclusiones y calidad del informe', 'Conclusiones basadas en evidencia y redacción clara.', 15, ['Conclusiones sólidas, limitaciones y trabajo futuro.', 'Conclusiones correctas.', 'Conclusiones vagas.', 'Sin conclusiones.']],
    ],
  },
  {
    cohort: 1, order: 3, title: 'Laboratorio 3 · Redes neuronales artificiales',
    description: 'Implementar un perceptrón multicapa para un problema de clasificación, analizar el efecto de la arquitectura y la regularización sobre el sobreajuste.',
    objectives: 'Comprender la retropropagación; entrenar una red neuronal con Keras o PyTorch; analizar curvas de aprendizaje; aplicar regularización.',
    topics: ['Redes neuronales', 'Retropropagación', 'Sobreajuste y regularización', 'Curvas de aprendizaje'],
    criteria: [
      ['Comprensión conceptual', 'Fundamentos de redes neuronales', 'Explica neuronas, funciones de activación, pérdida y retropropagación.', 25, ['Explicación precisa y formal de los fundamentos.', 'Explicación correcta con imprecisiones menores.', 'Explicación superficial.', 'No explica los fundamentos.']],
      ['Implementación técnica', 'Implementación y entrenamiento de la red', 'Implementa y entrena la red con una arquitectura justificada.', 35, ['Red bien diseñada, entrenada y con experimentos de arquitectura.', 'Red funcional con una sola configuración.', 'Red con errores de entrenamiento.', 'No implementa la red.']],
      ['Análisis y comunicación', 'Análisis de sobreajuste y regularización', 'Analiza curvas de aprendizaje y aplica dropout, L2 o early stopping.', 25, ['Análisis comparativo con y sin regularización.', 'Aplica regularización con análisis básico.', 'Menciona el sobreajuste sin analizarlo.', 'No aborda el sobreajuste.']],
      ['Análisis y comunicación', 'Calidad del informe', 'Estructura, gráficas y conclusiones.', 15, ['Informe completo con gráficas interpretadas.', 'Informe correcto.', 'Informe incompleto.', 'Informe ausente.']],
    ],
  },
  {
    cohort: 2, order: 4, title: 'Laboratorio 4 · Procesamiento de lenguaje natural y embeddings',
    description: 'Construir un clasificador de sentimiento comparando representaciones TF-IDF y embeddings, con el preprocesamiento de texto adecuado.',
    objectives: 'Aplicar tokenización y normalización de texto; comparar TF-IDF y embeddings; evaluar un clasificador de sentimiento.',
    topics: ['Procesamiento de lenguaje natural', 'TF-IDF', 'Embeddings', 'Análisis de sentimiento'],
    criteria: [
      ['Comprensión conceptual', 'Preprocesamiento de texto', 'Tokenización, normalización, stopwords y lematización justificadas.', 20, ['Preprocesamiento completo y justificado.', 'Preprocesamiento correcto.', 'Preprocesamiento mínimo.', 'Sin preprocesamiento.']],
      ['Implementación técnica', 'Representaciones vectoriales', 'Implementa TF-IDF y embeddings y explica sus diferencias.', 30, ['Ambas representaciones implementadas y comparadas conceptualmente.', 'Ambas implementadas con explicación básica.', 'Solo una representación.', 'Sin representación vectorial.']],
      ['Implementación técnica', 'Clasificador de sentimiento', 'Entrena y evalúa el clasificador con métricas.', 30, ['Clasificador evaluado con métricas y análisis de errores.', 'Clasificador evaluado con métricas.', 'Evaluación incompleta.', 'No hay clasificador.']],
      ['Análisis y comunicación', 'Análisis y conclusiones', 'Compara resultados y discute limitaciones y sesgos.', 20, ['Discusión profunda de resultados, sesgos y limitaciones.', 'Discusión correcta.', 'Discusión superficial.', 'Sin discusión.']],
    ],
  },
  {
    cohort: 2, order: 5, title: 'Laboratorio 5 · Modelos de lenguaje, prompting y RAG',
    description: 'Desarrollar un asistente de preguntas y respuestas sobre documentos del curso usando un LLM con generación aumentada por recuperación (RAG) y técnicas de ingeniería de prompts.',
    objectives: 'Diseñar prompts efectivos; implementar RAG con embeddings y base vectorial; evaluar la calidad de las respuestas y riesgos de alucinación.',
    topics: ['Modelos de lenguaje (LLM)', 'Ingeniería de prompts', 'Generación aumentada por recuperación (RAG)', 'Embeddings', 'IA responsable'],
    criteria: [
      ['Comprensión conceptual', 'Ingeniería de prompts', 'Diseña y compara estrategias de prompting (zero-shot, few-shot, cadena de pensamiento).', 20, ['Compara estrategias con evidencia y criterios claros.', 'Aplica varias estrategias.', 'Usa un único prompt sin análisis.', 'No aborda el prompting.']],
      ['Implementación técnica', 'Implementación del pipeline RAG', 'Fragmentación, embeddings, base vectorial y recuperación integradas con el LLM.', 35, ['Pipeline RAG completo, modular y configurable.', 'Pipeline funcional con limitaciones menores.', 'Pipeline incompleto.', 'No implementa RAG.']],
      ['Análisis y comunicación', 'Evaluación de respuestas y alucinaciones', 'Define un conjunto de preguntas y mide fidelidad y relevancia.', 25, ['Evaluación sistemática con métricas de fidelidad.', 'Evaluación con ejemplos representativos.', 'Evaluación anecdótica.', 'Sin evaluación.']],
      ['Análisis y comunicación', 'Ética y uso responsable', 'Discute privacidad, sesgos y límites del asistente.', 20, ['Análisis ético sólido con medidas de mitigación.', 'Discusión ética adecuada.', 'Mención superficial.', 'No aborda la ética.']],
    ],
  },
  {
    cohort: 2, order: 6, title: 'Laboratorio 6 · Agentes con LLM y despliegue de soluciones de IA',
    description: 'Construir un agente basado en LLM que use herramientas (function calling) para resolver tareas, desplegarlo como servicio web y documentar su arquitectura.',
    objectives: 'Diseñar agentes con herramientas; orquestar llamadas a funciones; desplegar un servicio de IA; documentar arquitectura y pruebas.',
    topics: ['Agentes con LLM', 'Uso de herramientas (function calling)', 'Despliegue de modelos de IA', 'Pruebas de software de IA'],
    criteria: [
      ['Comprensión conceptual', 'Diseño del agente', 'Arquitectura del agente: ciclo razonamiento-acción, herramientas y memoria.', 25, ['Diseño claro con diagrama y justificación de decisiones.', 'Diseño correcto.', 'Diseño poco claro.', 'Sin diseño.']],
      ['Implementación técnica', 'Integración de herramientas', 'Implementa function calling con validación de entradas y manejo de errores.', 30, ['Herramientas robustas, validadas y probadas.', 'Herramientas funcionales.', 'Integración parcial.', 'Sin herramientas.']],
      ['Implementación técnica', 'Despliegue y pruebas', 'Expone el agente como servicio y lo acompaña de pruebas automatizadas.', 25, ['Servicio desplegado con pruebas automatizadas que pasan.', 'Servicio funcional con pruebas básicas.', 'Despliegue local sin pruebas.', 'No se despliega.']],
      ['Análisis y comunicación', 'Documentación y reflexión', 'Documenta arquitectura, limitaciones y uso de asistentes de IA.', 20, ['Documentación completa y reflexiva.', 'Documentación adecuada.', 'Documentación mínima.', 'Sin documentación.']],
    ],
  },
];

const LEVELS: [string, string, number][] = [['N-excelente', 'Excelente', 5], ['N-bueno', 'Bueno', 4], ['N-aceptable', 'Aceptable', 3], ['N-insuficiente', 'Insuficiente', 1]];

export function rubricFor(l: LabSeed): RubricContent {
  const comps = [...new Set(l.criteria.map((c) => c[0]))];
  return {
    title: `Rúbrica · ${l.title.split('·')[1]?.trim() ?? l.title}`,
    competencies: comps.map((c, i) => ({ id: `C${i + 1}`, name: c, description: '' })),
    criteria: l.criteria.map((c, i) => ({
      id: `K${i + 1}`, competencyId: `C${comps.indexOf(c[0]) + 1}`, name: c[1], description: c[2], weight: c[3],
      levels: LEVELS.map(([id, name, score], j) => ({ id, name, score, descriptor: c[4][j] })),
    })),
  };
}
