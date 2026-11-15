/** Contenido de ejemplo para entregas de demostración (informes y código). */
export const REPORTS: Record<number, string[]> = {
  1: [
    'Introducción. En este laboratorio modelamos el rompecabezas de 8 piezas como un problema de búsqueda para un agente inteligente basado en objetivos.',
    'Formulación del problema. Los estados son las configuraciones del tablero de 3x3; las acciones mueven el espacio vacío arriba, abajo, izquierda o derecha; el estado inicial es una permutación aleatoria resoluble y la prueba de meta verifica la configuración ordenada. El costo de camino es uniforme: cada movimiento cuesta 1.',
    'Implementación. Implementamos BFS con una cola FIFO, DFS con una pila y límite de profundidad, y A* con una cola de prioridad ordenada por f(n) = g(n) + h(n). El código está organizado en módulos: problema.py, busqueda.py y experimentos.py, con funciones documentadas.',
    'Diseño de la heurística. Usamos la distancia Manhattan, que es admisible porque cada pieza debe moverse al menos su distancia Manhattan para llegar a su posición final, por lo que nunca sobreestima el costo real. También la comparamos con la heurística de piezas mal ubicadas, que es admisible pero menos informada.',
    'Análisis comparativo de resultados. En 30 instancias, A* con Manhattan expandió en promedio 1.250 nodos frente a 38.400 de BFS, con un tiempo 25 veces menor. DFS encontró soluciones no óptimas en el 70 % de los casos. La tabla 1 y la figura 2 resumen nodos expandidos, tiempo y longitud de la solución.',
    'Conclusiones. La búsqueda heurística reduce drásticamente el espacio explorado manteniendo la optimalidad cuando la heurística es admisible. Como trabajo futuro proponemos heurísticas de base de datos de patrones. Referencias: Russell y Norvig, Inteligencia Artificial: un enfoque moderno.',
  ],
  2: [
    'Introducción. Construimos un pipeline de aprendizaje supervisado para predecir la deserción de clientes a partir de un conjunto de datos con 7.000 registros.',
    'Análisis exploratorio y preprocesamiento. El análisis exploratorio mostró un 4 % de valores faltantes en la variable de cargos totales, que imputamos con la mediana. Escalamos las variables numéricas con StandardScaler y codificamos las categóricas con OneHotEncoder dentro de un ColumnTransformer para evitar fuga de datos.',
    'Entrenamiento de modelos. Entrenamos una regresión logística y un random forest. Ajustamos hiperparámetros con GridSearchCV sobre el número de árboles y la profundidad máxima, manteniendo todo dentro de un Pipeline reproducible con semilla fija.',
    'Evaluación con métricas y validación cruzada. Usamos validación cruzada estratificada de 5 particiones. El random forest obtuvo F1 de 0,62, precisión de 0,66 y recall de 0,58; la matriz de confusión muestra que los falsos negativos son el error más costoso para el negocio, por lo que priorizamos el recall.',
    'Conclusiones. El random forest supera a la regresión logística, aunque con menor interpretabilidad. Como limitación, el conjunto está desbalanceado; proponemos probar SMOTE y ajuste del umbral de decisión.',
  ],
  3: [
    'Introducción. Implementamos un perceptrón multicapa para clasificar dígitos manuscritos del conjunto MNIST usando Keras.',
    'Fundamentos de redes neuronales. Cada neurona calcula una combinación lineal de sus entradas seguida de una función de activación no lineal como ReLU. La función de pérdida de entropía cruzada mide el error y la retropropagación calcula el gradiente de la pérdida respecto a cada peso aplicando la regla de la cadena capa por capa; el optimizador Adam actualiza los pesos.',
    'Implementación y entrenamiento de la red. Probamos tres arquitecturas: una capa oculta de 64 neuronas, dos capas de 128 y tres capas de 256. La arquitectura de dos capas de 128 neuronas alcanzó 97,8 % de exactitud en validación con 15 épocas y tamaño de lote 64.',
    'Análisis de sobreajuste y regularización. Las curvas de aprendizaje de la red de tres capas mostraron sobreajuste a partir de la época 8: la pérdida de validación aumenta mientras la de entrenamiento disminuye. Al aplicar dropout de 0,3 y early stopping, la brecha se redujo y la exactitud de prueba subió de 97,1 % a 98,0 %.',
    'Conclusiones. La regularización es fundamental cuando aumenta la capacidad del modelo. Las gráficas de pérdida y exactitud se incluyen en el anexo.',
  ],
  4: [
    'Introducción. Desarrollamos un clasificador de sentimiento para reseñas de productos en español comparando dos representaciones de texto.',
    'Preprocesamiento de texto. Aplicamos tokenización con spaCy, normalización a minúsculas, eliminación de stopwords y lematización; conservamos las negaciones porque cambian la polaridad del sentimiento.',
    'Representaciones vectoriales. Implementamos TF-IDF con unigramas y bigramas y embeddings de oraciones con un modelo multilingüe. TF-IDF representa frecuencia ponderada de términos y es disperso, mientras que los embeddings capturan similitud semántica en un espacio denso.',
    'Clasificador de sentimiento. Entrenamos una regresión logística sobre cada representación. Con embeddings obtuvimos F1 macro de 0,86 frente a 0,81 con TF-IDF. El análisis de errores mostró fallas con ironía y sarcasmo.',
    'Análisis y conclusiones. Los embeddings generalizan mejor a sinónimos, pero heredan sesgos del corpus de preentrenamiento; discutimos esta limitación y la necesidad de evaluar por subgrupos.',
  ],
  5: [
    'Introducción. Construimos un asistente de preguntas y respuestas sobre los documentos del curso con un modelo de lenguaje y generación aumentada por recuperación (RAG).',
    'Ingeniería de prompts. Comparamos prompting zero-shot, few-shot con tres ejemplos y cadena de pensamiento. El prompt few-shot con instrucciones de citar la fuente redujo las respuestas sin sustento del 30 % al 8 % en nuestro conjunto de prueba.',
    'Implementación del pipeline RAG. Fragmentamos los documentos en bloques de 500 tokens con solapamiento de 50, generamos embeddings y los almacenamos en una base vectorial ChromaDB. En cada consulta se recuperan los 4 fragmentos más similares y se inyectan en el prompt del LLM; el pipeline es configurable mediante un archivo YAML.',
    'Evaluación de respuestas y alucinaciones. Definimos 40 preguntas con respuesta de referencia y medimos fidelidad y relevancia. La fidelidad promedio fue 0,87 y detectamos alucinaciones cuando la pregunta no tenía respaldo en los documentos.',
    'Ética y uso responsable. Analizamos riesgos de privacidad al indexar documentos con datos personales, sesgos del modelo y la necesidad de advertir al usuario que el asistente puede equivocarse; implementamos una respuesta de abstención cuando no hay contexto suficiente.',
  ],
  6: [
    'Introducción. Diseñamos un agente basado en LLM que planifica viajes usando herramientas externas mediante function calling.',
    'Diseño del agente. El agente sigue un ciclo razonamiento-acción: el LLM decide qué herramienta invocar, observa el resultado y continúa hasta responder. Dispone de herramientas de clima, conversión de moneda y búsqueda de lugares, y una memoria de conversación. La figura 1 presenta el diagrama de arquitectura.',
    'Integración de herramientas. Cada herramienta declara un esquema JSON de parámetros; validamos las entradas con Pydantic y manejamos errores de red con reintentos, devolviendo mensajes claros al modelo.',
    'Despliegue y pruebas. Expusimos el agente como servicio con FastAPI y lo desplegamos en un contenedor Docker. Escribimos pruebas automatizadas con pytest para las herramientas y el ciclo del agente usando un LLM simulado; las 12 pruebas pasan.',
    'Documentación y reflexión. Documentamos la arquitectura, las limitaciones y el uso de asistentes de IA: Claude y GitHub Copilot aceleraron la escritura de pruebas, pero tuvimos que corregir supuestos sobre el manejo de errores.',
  ],
};

export const CODE: Record<number, Record<string, string>> = {
  1: {
    'README.md': '# Lab 1 · Búsqueda\nEjecutar `python experimentos.py`. Pruebas: `pytest`.',
    'requirements.txt': 'pytest\n',
    'busqueda.py': `"""Algoritmos de búsqueda para el 8-puzzle."""
from collections import deque
import heapq

META = (1, 2, 3, 4, 5, 6, 7, 8, 0)

def vecinos(estado):
    """Genera los estados alcanzables moviendo el espacio vacío."""
    i = estado.index(0)
    fila, col = divmod(i, 3)
    for df, dc in ((-1, 0), (1, 0), (0, -1), (0, 1)):
        f, c = fila + df, col + dc
        if 0 <= f < 3 and 0 <= c < 3:
            j = f * 3 + c
            s = list(estado)
            s[i], s[j] = s[j], s[i]
            yield tuple(s)

def manhattan(estado):
    """Heurística admisible: suma de distancias Manhattan."""
    d = 0
    for i, v in enumerate(estado):
        if v:
            meta = META.index(v)
            d += abs(i // 3 - meta // 3) + abs(i % 3 - meta % 3)
    return d

def bfs(inicio):
    """Búsqueda en anchura. Retorna (camino, nodos_expandidos)."""
    frontera = deque([(inicio, [inicio])])
    visitados = {inicio}
    expandidos = 0
    while frontera:
        estado, camino = frontera.popleft()
        expandidos += 1
        if estado == META:
            return camino, expandidos
        for v in vecinos(estado):
            if v not in visitados:
                visitados.add(v)
                frontera.append((v, camino + [v]))
    return None, expandidos

def a_estrella(inicio, h=manhattan):
    """Búsqueda A* con f(n) = g(n) + h(n)."""
    frontera = [(h(inicio), 0, inicio, [inicio])]
    mejor_g = {inicio: 0}
    expandidos = 0
    while frontera:
        f, g, estado, camino = heapq.heappop(frontera)
        expandidos += 1
        if estado == META:
            return camino, expandidos
        for v in vecinos(estado):
            ng = g + 1
            if ng < mejor_g.get(v, float('inf')):
                mejor_g[v] = ng
                heapq.heappush(frontera, (ng + h(v), ng, v, camino + [v]))
    return None, expandidos
`,
    'test_busqueda.py': `from busqueda import a_estrella, bfs, manhattan, META

def test_manhattan_meta_es_cero():
    assert manhattan(META) == 0

def test_a_estrella_optimo():
    inicio = (1, 2, 3, 4, 5, 6, 0, 7, 8)
    camino, _ = a_estrella(inicio)
    assert len(camino) - 1 == 2

def test_bfs_y_a_estrella_coinciden():
    inicio = (1, 2, 3, 4, 0, 6, 7, 5, 8)
    assert len(bfs(inicio)[0]) == len(a_estrella(inicio)[0])
`,
  },
  2: {
    'README.md': '# Lab 2 · Clasificación supervisada',
    'requirements.txt': 'scikit-learn\npandas\n',
    'pipeline.py': `"""Pipeline de clasificación con validación cruzada."""
from sklearn.compose import ColumnTransformer
from sklearn.ensemble import RandomForestClassifier
from sklearn.linear_model import LogisticRegression
from sklearn.model_selection import GridSearchCV, StratifiedKFold, cross_validate
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import OneHotEncoder, StandardScaler
from sklearn.impute import SimpleImputer

def construir_preprocesador(numericas, categoricas):
    """Imputa, escala y codifica dentro de un ColumnTransformer."""
    num = Pipeline([("imp", SimpleImputer(strategy="median")), ("esc", StandardScaler())])
    return ColumnTransformer([("num", num, numericas), ("cat", OneHotEncoder(handle_unknown="ignore"), categoricas)])

def evaluar(modelo, X, y):
    """Validación cruzada estratificada con F1, precisión y recall."""
    cv = StratifiedKFold(n_splits=5, shuffle=True, random_state=42)
    return cross_validate(modelo, X, y, cv=cv, scoring=["f1", "precision", "recall"])

def random_forest_ajustado(pre):
    grid = {"clf__n_estimators": [100, 300], "clf__max_depth": [None, 10]}
    pipe = Pipeline([("pre", pre), ("clf", RandomForestClassifier(random_state=42))])
    return GridSearchCV(pipe, grid, scoring="f1", cv=3)

def regresion_logistica(pre):
    return Pipeline([("pre", pre), ("clf", LogisticRegression(max_iter=1000))])
`,
  },
  3: {
    'red.py': `"""Perceptrón multicapa con Keras."""
from tensorflow import keras

def construir_modelo(capas=(128, 128), dropout=0.3):
    """Construye un MLP con dropout para regularización."""
    modelo = keras.Sequential([keras.layers.Input((784,))])
    for n in capas:
        modelo.add(keras.layers.Dense(n, activation="relu"))
        modelo.add(keras.layers.Dropout(dropout))
    modelo.add(keras.layers.Dense(10, activation="softmax"))
    modelo.compile(optimizer="adam", loss="sparse_categorical_crossentropy", metrics=["accuracy"])
    return modelo

def entrenar(modelo, x, y, epocas=15):
    parada = keras.callbacks.EarlyStopping(patience=3, restore_best_weights=True)
    return modelo.fit(x, y, epochs=epocas, batch_size=64, validation_split=0.1, callbacks=[parada])
`,
    'requirements.txt': 'tensorflow\n',
  },
  4: {
    'sentimiento.py': `"""Clasificador de sentimiento: TF-IDF vs embeddings."""
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import f1_score

def tfidf_modelo(textos, etiquetas):
    vec = TfidfVectorizer(ngram_range=(1, 2), min_df=2)
    X = vec.fit_transform(textos)
    clf = LogisticRegression(max_iter=1000).fit(X, etiquetas)
    return vec, clf

def evaluar(clf, X, y):
    """F1 macro del clasificador."""
    return f1_score(y, clf.predict(X), average="macro")
`,
    'README.md': '# Lab 4 · PLN',
  },
  5: {
    'rag.py': `"""Pipeline RAG configurable."""
import yaml

def fragmentar(texto, tam=500, solape=50):
    """Divide el texto en fragmentos con solapamiento."""
    palabras = texto.split()
    paso = tam - solape
    return [" ".join(palabras[i:i + tam]) for i in range(0, max(1, len(palabras)), paso)]

def construir_prompt(pregunta, contextos):
    """Prompt few-shot que obliga a citar la fuente o abstenerse."""
    ctx = "\\n\\n".join(f"[{i+1}] {c}" for i, c in enumerate(contextos))
    return (
        "Responde solo con base en el contexto y cita la fuente entre corchetes. "
        "Si el contexto no contiene la respuesta, di que no lo sabes.\\n\\n"
        f"Contexto:\\n{ctx}\\n\\nPregunta: {pregunta}"
    )

def cargar_config(ruta):
    with open(ruta) as f:
        return yaml.safe_load(f)
`,
    'test_rag.py': `from rag import fragmentar, construir_prompt

def test_fragmentar_solapamiento():
    partes = fragmentar(" ".join(str(i) for i in range(1000)), tam=500, solape=50)
    assert len(partes) == 3

def test_prompt_incluye_abstencion():
    assert "no lo sabes" in construir_prompt("¿Qué es RAG?", ["contexto"])
`,
    'config.yaml': 'top_k: 4\nchunk_size: 500\n',
    'requirements.txt': 'chromadb\npyyaml\n',
  },
  6: {
    'agente.py': `"""Agente con herramientas (function calling)."""
from pydantic import BaseModel, ValidationError

class ConversionArgs(BaseModel):
    monto: float
    origen: str
    destino: str

TASAS = {("USD", "COP"): 4000.0, ("EUR", "COP"): 4300.0}

def convertir_moneda(args: dict) -> dict:
    """Herramienta: convierte moneda validando la entrada."""
    try:
        a = ConversionArgs(**args)
    except ValidationError as e:
        return {"error": str(e)}
    tasa = TASAS.get((a.origen, a.destino))
    if tasa is None:
        return {"error": "Par de monedas no soportado"}
    return {"resultado": round(a.monto * tasa, 2)}

HERRAMIENTAS = {"convertir_moneda": convertir_moneda}

def ejecutar_agente(llm, mensaje, max_pasos=5):
    """Ciclo razonamiento-acción: el LLM elige herramientas hasta responder."""
    historial = [{"rol": "usuario", "contenido": mensaje}]
    for _ in range(max_pasos):
        decision = llm(historial)
        if decision.get("herramienta"):
            obs = HERRAMIENTAS[decision["herramienta"]](decision.get("argumentos", {}))
            historial.append({"rol": "herramienta", "contenido": obs})
        else:
            return decision["respuesta"]
    return "No fue posible completar la tarea"
`,
    'test_agente.py': `from agente import convertir_moneda, ejecutar_agente

def test_conversion_valida():
    assert convertir_moneda({"monto": 2, "origen": "USD", "destino": "COP"}) == {"resultado": 8000.0}

def test_conversion_invalida():
    assert "error" in convertir_moneda({"monto": "x", "origen": "USD", "destino": "COP"})

def test_ciclo_agente():
    pasos = iter([{"herramienta": "convertir_moneda", "argumentos": {"monto": 1, "origen": "EUR", "destino": "COP"}}, {"respuesta": "4300 COP"}])
    assert ejecutar_agente(lambda h: next(pasos), "convierte 1 EUR") == "4300 COP"
`,
    'requirements.txt': 'pydantic\nfastapi\n',
    'README.md': '# Lab 6 · Agente con herramientas\nDocker: `docker build -t agente .`',
  },
};
