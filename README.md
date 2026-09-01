# XML Invoice Validator

Herramienta técnica empresarial y portable para el diagnóstico, análisis y validación de facturas y documentos XML para integraciones Coupa.

## Cómo ejecutar

1. Copiar o descomprimir la carpeta `xml-invoice-validator` en cualquier computador.
2. Abrir el archivo `index.html` directamente haciendo doble clic o arrastrándolo a Google Chrome o Microsoft Edge.
3. No requiere instalación de ningún software ni configuración previa.

## Requisitos

- **Navegador web moderno:** Google Chrome o Microsoft Edge.
- **Sin dependencias adicionales:** No requiere Node.js, npm, servidores locales (Apache/Nginx/IIS), extensiones, ni conexión a Internet.
- **Ejecución vía `file://`:** Funciona de forma 100% autónoma en modo local.

## Privacidad y Seguridad

- **100% Local y Offline:** Todos los archivos XML cargados son procesados directamente en la memoria del navegador del usuario mediante la API estándar `FileReader`.
- **Sin telemetría ni subida de datos:** La aplicación no realiza peticiones de red (`fetch`, `XMLHttpRequest`, `WebSocket`), no consume APIs externas ni transmite información fuera del equipo.
- **Persistencia segura:** Únicamente se guarda la preferencia visual de tema (Light/Dark mode) en `localStorage`. Nunca se almacena el contenido XML ni datos confidenciales.

## Estructura del Proyecto

```text
xml-invoice-validator/
│
├── index.html                  # Punto de entrada autónomo (abrir en navegador)
│
├── css/
│   └── styles.css              # Estilos CSS con soporte Light/Dark theme y layout 50/50
│
├── data/
│   └── templates.js            # Plantillas de referencia Coupa (inicialmente vacío)
│
├── js/
│   ├── utils.js                # Funciones auxiliares de conteo y formateo
│   ├── xmlParser.js            # Módulo de parseo sintáctico objetivo
│   ├── xmlFormatter.js         # Módulo de formateo e indentación segura
│   ├── xmlAnalyzer.js          # Módulo de análisis estructural descriptivo
│   ├── ruleEngine.js           # Motor de evaluación de reglas
│   ├── validationRules.js      # Catálogo de reglas de validación
│   ├── templateComparator.js   # Comparador de diferencias contra plantillas
│   ├── treeRenderer.js         # Renderizador del árbol jerárquico XML
│   ├── ui.js                   # Controlador de pestañas, notificaciones y tema
│   └── app.js                  # Inicialización y gestión de eventos de la aplicación
│
└── README.md                   # Documentación de uso y arquitectura
```

## Estado Actual

**Fase 5 — XML Template Comparison Engine:**
- **Comparador Estructural Descriptivo (`XMLValidator.Comparator`):** Permite contrastar de forma neutral la estructura del XML analizado contra un XML de referencia sin convertir las diferencias en errores o warnings arbitrarios.
- **Identidad Agnóstica al Prefijo (Namespace-Aware):** Comparación basada en tuplas canónicas `(namespaceURI, localName)` para evitar falsos positivos ante prefijos XML arbitrarios o aliases de namespace.
- **Comparación Independiente del Orden de Hermanos:** Los elementos hermanos se agrupan canónicamente para no penalizar reordenamientos sintácticamente válidos.
- **Categorías de Diferencias Estructurales:**
  - `MISSING_ELEMENT`: Elementos presentes en la referencia y ausentes en el XML analizado.
  - `ADDITIONAL_ELEMENT`: Elementos presentes en el XML analizado y ausentes en la referencia.
  - `ATTRIBUTE_MISSING` / `ATTRIBUTE_ADDITIONAL`: Presencia o ausencia de atributos (los valores se omiten por defecto al ser datos transaccionales).
  - `OCCURRENCE_DIFFERENCE`: Diferencias en la cardinalidad o conteo de repetición de elementos.
  - `HIERARCHY_DIFFERENCE`: Detección de reubicación jerárquica de elementos dentro del documento.
- **Aislamiento e Importación Local:** Importación de XML de referencia vía `FileReader` nativo, rechazo de XML malformados sin alterar el documento principal, y limpieza independiente (`Clear Reference`).
- **Sincronización con el Visor de Árbol:** Enlace directo desde los hallazgos de comparación hacia los nodos del árbol (`View in XML Tree`).
- **Directiva de Procedencia (Provenance):** Soporte en fuentes de validación y plantillas para el atributo `publisher: "Coupa"` y tipologías estandarizadas (`OFFICIAL_DOCUMENTATION`, `SPECIFICATION`, `CUSTOM_REFERENCE`, `INTERNAL_CONFIRMED_RULE`).
- **Suite de Pruebas Autónomas (15 Tests):** Validación interna ejecutada y verificada con 100% de éxito en entorno de desarrollo.
- **Portabilidad 100% Offline:** Total compatibilidad con `file://`, sin dependencias externas, APIs de red ni llamadas `fetch`.

