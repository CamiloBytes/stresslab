# Guía de uso de StressLab

StressLab permite generar carga HTTP contra una API o una página web y observar
el comportamiento del objetivo desde un tablero en vivo. Las pruebas se
ejecutan en el servidor de StressLab mediante k6; el navegador solo muestra
las métricas y la consola.

## 1. Iniciar StressLab

La forma recomendada es Docker:

```bash
docker compose up -d --build
```

Después abre <http://localhost:3000>. Para apagar la aplicación:

```bash
docker compose down
```

SQLite se guarda en `data/stresslab.db` y los scripts temporales de las corridas
se guardan en `data/runs`. Ambos sobreviven al reinicio porque `data/` está
montado como volumen del proyecto.

## 2. Crear un escenario

En **Escenarios**, crea un escenario con estos datos:

| Campo | Qué significa |
|---|---|
| Nombre | Identificador para reconocer la prueba. |
| Tipo API | Petición HTTP con método, headers y body configurables. |
| Tipo WEB | Petición HTTP a una página; no abre un navegador real. |
| URL | Dirección completa que recibirá la carga. |
| Método | GET, POST, PUT, PATCH, DELETE o HEAD. |
| Headers | Cabeceras como `Authorization` o `Content-Type`. |
| Body | JSON u otro cuerpo para métodos distintos de GET y HEAD. |
| Código esperado | Código HTTP que cuenta como respuesta correcta. |
| Think time | Pausa entre iteraciones de un usuario virtual. |
| Seguir redirecciones | Indica si k6 sigue respuestas 301/302. |
| TLS inseguro | Permite certificados autofirmados; úsalo solo en entornos controlados. |
| p95 / p99 | Límite máximo esperado para la latencia. |
| Error máximo | Tasa máxima permitida, expresada como decimal: `0.01` = 1 %. |

No agregues secretos permanentes en escenarios compartidos. Los headers y el body
se guardan en la base de datos de StressLab.

## 3. Ejemplo: URL pública

Para probar un endpoint público:

```text
Nombre:      Health API pública
Tipo:        API
URL:         https://api.ejemplo.com/health
Método:      GET
Código:      200
```

Una configuración de rampa sencilla:

```text
Etapa 1: 30s → 10 usuarios
Etapa 2: 1m  → 50 usuarios
Etapa 3: 30s → 0 usuarios
```

Esto sube progresivamente hasta 50 usuarios virtuales, mantiene la carga
durante un minuto y después la retira.

## 4. Ejemplo: URL privada o intranet

La URL debe ser accesible desde el contenedor o equipo donde corre k6, no
solamente desde el navegador.

### Servicio en el mismo equipo que Docker

Si la API está escuchando en el host, usa:

```text
http://host.docker.internal:8080/api/health
```

No uses `localhost` para referirte al host desde un contenedor. En Docker,
`localhost` significa el propio contenedor.

### Otro servicio en Docker Compose

Si el servicio se llama `backend` dentro de la misma red de Compose:

```text
http://backend:8080/api/health
```

### Servidor de una red privada

Si la máquina que ejecuta Docker tiene acceso a la red privada:

```text
http://192.168.1.40:8080/api/health
http://intranet.ejemplo.local/api/health
```

Verifica antes que el contenedor pueda resolver el hostname y conectarse al
puerto. Una URL privada no se vuelve accesible automáticamente por estar
configurada en StressLab.

## 5. Elegir el tipo de carga

### Rampa de usuarios virtuales (`ramping-vus`)

Úsala para responder: **¿cuántas sesiones concurrentes soporta mi aplicación?**

Cada usuario virtual ejecuta el escenario de forma independiente. Ejemplo para
probar 100 usuarios:

```text
Etapa 1: 30s → 20 usuarios
Etapa 2: 1m  → 100 usuarios
Etapa 3: 2m  → 100 usuarios
Etapa 4: 30s → 0 usuarios
```

Durante dos minutos se mantienen 100 usuarios virtuales activos. Esto no
significa necesariamente 100 solicitudes por segundo: depende de la latencia y
del `think time`.

### Tasa constante (`constant-arrival-rate`)

Úsala para responder: **¿cómo se comporta la aplicación a una tasa fija de
solicitudes?**

Ejemplo:

```text
Tasa:             50 solicitudes por segundo
Duración:         5m
VUs preasignados: 100
VUs máximos:      300
```

Si k6 necesita más usuarios virtuales para mantener 50 solicitudes por segundo,
los crea hasta el límite configurado. Si alcanza ese límite, la tasa solicitada
puede no cumplirse y debe interpretarse junto con las métricas y los mensajes
de k6.

## 6. Simular muchas personas iniciando sesión al mismo tiempo

### Lo que se puede hacer actualmente

Se puede crear un escenario `POST` contra el endpoint de login, por ejemplo:

```text
URL:    https://api.ejemplo.com/auth/login
Método: POST
Header: Content-Type = application/json
Body:
{
  "email": "usuario-prueba@example.com",
  "password": "contraseña-de-prueba"
}
Código esperado: 200
```

Después usa una rampa corta:

```text
Etapa 1: 10s → 500 usuarios
Etapa 2: 2m  → 500 usuarios
Etapa 3: 10s → 0 usuarios
```

Esto genera cientos de usuarios virtuales que ejecutan el login de forma
concurrente. No garantiza que todas las peticiones salgan en el mismo
milisegundo; una prueba de carga distribuye la llegada durante la ventana de
ejecución.

### Limitación importante

La versión actual genera una petición por iteración. Todavía no modela un flujo
completo de:

1. Iniciar sesión.
2. Extraer un token dinámico.
3. Enviar el token a otros endpoints.
4. Cerrar sesión.

Tampoco genera automáticamente un usuario y contraseña diferentes por cada
usuario virtual. Si todos usan las mismas credenciales, el resultado puede estar
afectado por bloqueos, sesiones duplicadas o límites del propio sistema.

## 7. Cómo validar cuántas personas soporta la aplicación

Haz varias corridas, aumentando gradualmente la cantidad de usuarios:

```text
Prueba A:  50 usuarios durante 5m
Prueba B: 100 usuarios durante 5m
Prueba C: 200 usuarios durante 5m
Prueba D: 500 usuarios durante 5m
```

Para cada corrida registra:

- **Requests**: cantidad total de solicitudes.
- **RPS**: solicitudes procesadas por segundo.
- **VUs activos**: usuarios virtuales concurrentes.
- **Latencia media**: promedio de duración.
- **p95**: el 95 % de las respuestas terminó en ese tiempo o menos.
- **p99**: el 99 % de las respuestas terminó en ese tiempo o menos.
- **Tasa de error**: proporción de solicitudes fallidas.
- **Código esperado**: permite detectar respuestas HTTP incorrectas.

Una capacidad aceptable debe definirse antes de probar. Por ejemplo:

```text
Aceptable:
- p95 menor a 500 ms
- p99 menor a 1000 ms
- errores menores a 1 %
- código HTTP esperado igual a 200
```

La mayor cantidad de usuarios que cumple esos criterios durante toda la
duración es una referencia de capacidad bajo ese escenario. No es una cifra
universal: cambia con el endpoint, el payload, la base de datos, la red y los
recursos disponibles.

## 8. Descargar y entender el informe

Cuando una corrida termina, abre su detalle en el tablero y pulsa
**Descargar PDF**. StressLab genera un archivo PDF con el mismo estilo visual
oscuro, cian y verde de la aplicación.

El informe está escrito para desarrollo, producto y operaciones. Incluye:

- **Qué se intentó**: URL, método, tipo de carga, duración y usuarios.
- **Cómo respondió**: solicitudes, RPS, latencia media, p95, p99 y errores.
- **Qué está bien**: condiciones que se cumplieron.
- **Qué se encontró**: errores o límites que no se cumplieron.
- **Oportunidades de mejora**: acciones sugeridas en lenguaje directo.
- **Conclusión**: si la prueba fue satisfactoria, requiere atención o no fue concluyente.

El informe explica el comportamiento HTTP de esa corrida. Para saber por qué
una respuesta fue lenta todavía hay que revisar los logs, CPU, memoria, base de
datos y red del servicio evaluado.

## 9. Qué mide StressLab actualmente

StressLab permite medir:

- Capacidad de respuesta HTTP.
- RPS y cantidad de solicitudes.
- Usuarios virtuales concurrentes.
- Latencia media, p95 y p99.
- Errores HTTP y fallos de conexión.
- Iteraciones y validaciones de estado.
- Resultado de umbrales configurados.
- Diferencias entre una rampa de concurrencia y una tasa fija.

## 10. Qué no mide actualmente

- Tiempo de renderizado de un navegador.
- Core Web Vitals.
- Consumo de CPU o memoria del servidor objetivo.
- Consultas lentas de la base de datos.
- Flujos de autenticación con tokens dinámicos.
- Usuarios diferentes cargados desde un archivo.
- Pruebas distribuidas desde varias regiones.
- Varias corridas simultáneas desde la misma instancia.

Para medir CPU, memoria, base de datos o red se necesita complementar StressLab
con observabilidad del sistema objetivo, por ejemplo métricas del proveedor
cloud, Prometheus, Grafana o el monitor de la base de datos.

## 11. Alcance de la fase 2

La fase 2 puede ampliar StressLab con:

1. **Flujos multi-paso**: login, extracción de tokens y llamadas encadenadas.
2. **Datos parametrizados**: CSV/JSON con usuarios y variables por VU.
3. **Perfiles de llegada**: todos al inicio, picos, horarios y distribución
   aleatoria.
4. **Pruebas de sesión**: medir login, navegación y logout como un flujo real.
5. **Límites de seguridad**: máximo de VUs, duración máxima y confirmación para
   evitar saturar producción accidentalmente.
6. **Pruebas distribuidas**: varios generadores k6 y agregación de resultados.
7. **Observabilidad integrada**: CPU, memoria, base de datos y trazas.
8. **Comparación de corridas**: detectar regresiones entre versiones.
9. **Usuarios simultáneos reales**: coordinación de una barrera para iniciar
   una etapa de usuarios en una ventana controlada.

Hasta implementar esa fase, StressLab debe considerarse un generador HTTP
controlado para pruebas autorizadas, no una plataforma completa de pruebas de
usuarios finales ni una herramienta de medición de infraestructura.

## 12. Recomendaciones de seguridad

- Prueba únicamente sistemas propios o con autorización explícita.
- Empieza con pocos usuarios y aumenta gradualmente.
- Evita ejecutar pruebas destructivas contra producción.
- Usa cuentas de prueba y datos no sensibles.
- Configura umbrales y una duración limitada.
- Vigila el servicio objetivo mientras corre la prueba.
- Detén la corrida si aparecen errores masivos o degradación inesperada.
