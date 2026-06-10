# CodeSynapse

## Plataforma de Inteligencia Visual 100% Local

CodeSynapse es una plataforma de análisis semántico y visualización de código diseñada para funcionar completamente en local. A diferencia de las soluciones basadas en cloud (como OpenAI o Pinecone), CodeSynapse procesa, indexa y consulta tu código en tu propia máquina, garantizando máxima privacidad y velocidad.

## 🚀 Características

- **Indexado Semántico Local:** Utiliza embeddings generados localmente.
- **Búsqueda Vectorial:** Motor de búsqueda rápido con SQLite.
- **Chat Contextual con SSE:** Respuestas en tiempo real integradas con el contexto del código.
- **Grafo de Dependencias (Nuevo!):** Visualización interactiva de tu proyecto. Los archivos son nodos, y los imports/exports son las aristas.
- **Análisis de Complejidad Ciclomática:** Los nodos en el grafo cambian de color (verde, amarillo, rojo) según la complejidad del código.
- **100% Local:** Sin APIs externas, sin filtrado de datos a la nube.

## 🏗️ Arquitectura

```mermaid
graph TD
    A[Parser (Babel)] --> B[Embeddings Model]
    B --> C[(VectorDB - SQLite)]
    C --> D[RAG Engine]
    A --> E[Grafo de Dependencias]
    D --> F[Chat Contextual]
    E --> G[Visualización Interactiva]
    F <--> G
```

## ⚡ Benchmark

- **Indexado de 150 archivos:** ~18s
- **Query semántica:** ~2.7s
- **Grafo 80 nodos:** ~60fps continuos

## ¿Por qué 100% Local?

1. **Privacidad:** Tu código es tu propiedad intelectual. No enviamos ni un solo bit a servidores de terceros.
2. **Latencia:** Al no depender de la red, las respuestas de modelos locales y búsquedas vectoriales son inmediatas.
3. **Costo:** Sin suscripciones a APIs de IA o bases de datos vectoriales.

## 🛠️ Deploy

El proyecto se puede desplegar fácilmente con Docker:
- **Backend (API):** `Dockerfile` en `codesynapse-api` (Node 20).
- **Frontend (Web):** `Dockerfile` multi-stage (Node 20 + Nginx) en `codesynapse-web`.

Desplegado en Railway y Vercel.

## 🎨 Demo

![Demo Grafo](https://via.placeholder.com/800x400.png?text=CodeSynapse+Graph+Demo)
*(Imagínate un GIF mostrando chat + grafo + click en chip en 10s)*
