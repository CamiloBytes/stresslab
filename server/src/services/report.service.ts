import PDFDocument from "pdfkit";
import type { Run, RunSummary, Scenario } from "../models/types.js";

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function number(value: number): string {
  return Number.isFinite(value) ? Math.round(value).toLocaleString("es-CO") : "No disponible";
}

function milliseconds(value: number): string {
  return Number.isFinite(value) ? `${Math.round(value)} ms` : "No disponible";
}

function percent(value: number): string {
  return Number.isFinite(value) ? `${(value * 100).toFixed(2)} %` : "No disponible";
}

function date(value: string | null): string {
  if (!value) return "No disponible";
  return new Intl.DateTimeFormat("es-CO", {
    dateStyle: "medium",
    timeStyle: "medium",
  }).format(new Date(value));
}

function loadDescription(scenario: Scenario): string {
  if (scenario.loadMode === "constant-arrival-rate") {
    return `${number(scenario.arrivalRate ?? 0)} solicitudes por segundo durante ${scenario.duration ?? "la duración configurada"}.`;
  }
  return scenario.stages
    .map((stage) => `${stage.duration}: ${number(stage.target)} usuarios`)
    .join(" → ");
}

function verdict(run: Run, summary: RunSummary | null): { title: string; text: string; className: string } {
  if (!summary || run.status === "failed") {
    return {
      title: "La prueba no fue concluyente",
      text: "No se pudo completar la corrida o no se obtuvo un resumen confiable. Revisa el error y repite la prueba con una carga menor.",
      className: "bad",
    };
  }
  const allThresholdsPassed = summary.thresholds.every((threshold) => threshold.passed);
  if (run.status === "completed" && summary.errors === 0 && allThresholdsPassed) {
    return {
      title: "La aplicación respondió bien",
      text: "La prueba terminó correctamente, no registró errores y cumplió los límites configurados.",
      className: "good",
    };
  }
  return {
    title: "La aplicación requiere atención",
    text: "La prueba terminó, pero se encontraron errores o uno o más límites de rendimiento no se cumplieron.",
    className: "warn",
  };
}

function positiveFindings(summary: RunSummary | null): string[] {
  if (!summary) return ["No hay métricas suficientes para confirmar aspectos positivos."];
  const findings: string[] = [];
  if (summary.errors === 0) findings.push("Todas las solicitudes terminaron sin errores registrados.");
  if (summary.checksRate >= 1) findings.push("Las validaciones del código de respuesta fueron exitosas.");
  if (summary.thresholds.length > 0 && summary.thresholds.every((threshold) => threshold.passed)) {
    findings.push("Se cumplieron todos los límites de rendimiento configurados.");
  }
  if (findings.length === 0) findings.push("La aplicación procesó solicitudes y produjo métricas para análisis.");
  return findings;
}

function findings(summary: RunSummary | null): string[] {
  if (!summary) return ["No fue posible obtener un resumen de k6."];
  const result: string[] = [];
  if (summary.errors > 0) {
    result.push(`Se registraron ${number(summary.errors)} errores, equivalentes al ${percent(summary.errorRate)} de las solicitudes.`);
  }
  for (const threshold of summary.thresholds.filter((item) => !item.passed)) {
    result.push(`No se cumplió el objetivo «${threshold.label}».`);
  }
  if (result.length === 0) result.push("No se encontraron fallos frente a los límites configurados.");
  return result;
}

function improvements(summary: RunSummary | null): string[] {
  if (!summary) {
    return ["Revisar el error de ejecución y repetir la prueba con una configuración válida."];
  }
  const result: string[] = [];
  if (summary.errorRate > 0) result.push("Investigar las respuestas fallidas y separar errores de aplicación, red y límites de infraestructura.");
  if (summary.p95Ms > 500) result.push("Revisar las operaciones lentas, consultas de base de datos y dependencias externas que afectan al 95 % de las respuestas.");
  if (summary.p99Ms > 1000) result.push("Analizar los casos extremos de latencia: colas, saturación, bloqueos y picos de concurrencia.");
  if (result.length === 0) result.push("Repetir la prueba con más usuarios y comparar el resultado para conocer el siguiente punto de saturación.");
  result.push("Complementar estas métricas con CPU, memoria, base de datos y logs del servicio evaluado.");
  return result;
}

function list(items: string[]): string {
  return items.map((item) => `<li>${escapeHtml(item)}</li>`).join("");
}

export function buildRunReport(run: Run, scenario: Scenario): string {
  const summary = run.summary;
  const result = verdict(run, summary);
  const title = `Informe de prueba — ${escapeHtml(run.scenarioName)}`;
  const thresholds = summary?.thresholds.length
    ? summary.thresholds
        .map(
          (threshold) =>
            `<tr><td>${escapeHtml(threshold.label)}</td><td>${threshold.passed ? "Cumplido" : "No cumplido"}</td><td>${number(threshold.actual)}</td><td>${number(threshold.target)}</td></tr>`,
        )
        .join("")
    : `<tr><td colspan="4">No se configuraron límites.</td></tr>`;

  return `<!doctype html>
<html lang="es">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${title}</title>
  <style>
    :root { color-scheme: light; font-family: Arial, sans-serif; color: #172033; background: #f4f7fb; }
    body { margin: 0; padding: 32px; }
    main { max-width: 960px; margin: auto; background: white; padding: 40px; box-shadow: 0 8px 30px #17203318; }
    h1 { margin-top: 0; color: #14213d; } h2 { margin-top: 32px; color: #1d3557; border-bottom: 1px solid #dce4ef; padding-bottom: 8px; }
    .meta, .metrics { display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 12px; }
    .card { border: 1px solid #dce4ef; border-radius: 8px; padding: 14px; } .label { color: #64748b; font-size: 12px; } .value { display: block; margin-top: 5px; font-size: 20px; font-weight: bold; }
    .verdict { border-left: 5px solid #64748b; background: #f8fafc; padding: 16px; } .verdict.good { border-color: #16803c; } .verdict.warn { border-color: #c27b00; } .verdict.bad { border-color: #c53030; }
    table { width: 100%; border-collapse: collapse; } th, td { border-bottom: 1px solid #e5eaf0; padding: 10px 8px; text-align: left; } th { color: #64748b; font-size: 12px; }
    li { margin: 8px 0; line-height: 1.45; } .small { color: #64748b; font-size: 13px; } footer { margin-top: 40px; color: #64748b; font-size: 12px; }
    @media print { body { padding: 0; background: white; } main { box-shadow: none; } }
  </style>
</head>
<body>
<main>
  <h1>${title}</h1>
  <p class="small">Generado por StressLab el ${escapeHtml(date(new Date().toISOString()))}.</p>
  <section class="verdict ${result.className}">
    <h2>${result.title}</h2>
    <p>${result.text}</p>
  </section>

  <h2>Qué se intentó</h2>
  <div class="meta">
    <div class="card"><span class="label">Objetivo</span><strong class="value">${escapeHtml(scenario.method)} ${escapeHtml(scenario.url)}</strong></div>
    <div class="card"><span class="label">Tipo de carga</span><strong class="value">${scenario.loadMode === "ramping-vus" ? "Rampa de usuarios" : "Tasa constante"}</strong></div>
    <div class="card"><span class="label">Configuración</span><strong class="value">${escapeHtml(loadDescription(scenario))}</strong></div>
    <div class="card"><span class="label">Estado</span><strong class="value">${escapeHtml(run.status)}</strong></div>
  </div>
  <p>La prueba comenzó el <strong>${escapeHtml(date(run.startedAt))}</strong>${run.endedAt ? ` y terminó el <strong>${escapeHtml(date(run.endedAt))}</strong>` : ""}. Se esperaba el código HTTP <strong>${number(scenario.expectedStatus)}</strong>.</p>

  <h2>Cómo respondió</h2>
  ${
    summary
      ? `<div class="metrics">
          <div class="card"><span class="label">Solicitudes</span><strong class="value">${number(summary.requests)}</strong></div>
          <div class="card"><span class="label">RPS promedio</span><strong class="value">${number(summary.rps)}</strong></div>
          <div class="card"><span class="label">Latencia media</span><strong class="value">${milliseconds(summary.avgLatencyMs)}</strong></div>
          <div class="card"><span class="label">p95</span><strong class="value">${milliseconds(summary.p95Ms)}</strong></div>
          <div class="card"><span class="label">p99</span><strong class="value">${milliseconds(summary.p99Ms)}</strong></div>
          <div class="card"><span class="label">Errores</span><strong class="value">${number(summary.errors)} (${percent(summary.errorRate)})</strong></div>
        </div>`
      : "<p>No se generó un resumen de métricas.</p>"
  }

  <h2>Qué está bien</h2><ul>${list(positiveFindings(summary))}</ul>
  <h2>Qué se encontró</h2><ul>${list(findings(summary))}</ul>
  <h2>Oportunidades de mejora</h2><ul>${list(improvements(summary))}</ul>

  <h2>Límites evaluados</h2>
  <table><thead><tr><th>Regla</th><th>Resultado</th><th>Valor real</th><th>Objetivo</th></tr></thead><tbody>${thresholds}</tbody></table>
  ${run.error ? `<h2>Error de ejecución</h2><p>${escapeHtml(run.error)}</p>` : ""}
  <footer>Este informe describe el comportamiento HTTP observado durante esta corrida. No sustituye la observabilidad de CPU, memoria, base de datos o red.</footer>
</main>
</body>
</html>`;
}

const PDF_COLORS = {
  background: "#070b14",
  panel: "#101627",
  line: "#24344a",
  text: "#d8f7ff",
  muted: "#7da5b5",
  cyan: "#00edff",
  mint: "#abffe3",
  rose: "#ff3bae",
  amber: "#ffd166",
};

function pdfText(document: PDFKit.PDFDocument, text: string, color = PDF_COLORS.text, size = 10): void {
  document.fillColor(color).fontSize(size).font("Helvetica").text(text, { lineGap: 3 });
}

function pdfSection(document: PDFKit.PDFDocument, title: string, y: number): number {
  document.fillColor(PDF_COLORS.cyan).font("Helvetica-Bold").fontSize(13).text(title, 42, y);
  document
    .moveTo(42, y + 20)
    .lineTo(553, y + 20)
    .strokeColor(PDF_COLORS.line)
    .stroke();
  return y + 34;
}

function pdfBullets(document: PDFKit.PDFDocument, items: string[], y: number, color = PDF_COLORS.text): number {
  for (const item of items) {
    document.fillColor(PDF_COLORS.mint).font("Helvetica-Bold").fontSize(10).text("›", 48, y);
    document.fillColor(color).font("Helvetica").fontSize(10).text(item, 62, y, { width: 485, lineGap: 3 });
    y += document.heightOfString(item, { width: 485, lineGap: 3 }) + 9;
  }
  return y;
}

function pdfMetric(
  document: PDFKit.PDFDocument,
  x: number,
  y: number,
  label: string,
  value: string,
  color = PDF_COLORS.text,
): void {
  document.roundedRect(x, y, 158, 58, 6).fillAndStroke(PDF_COLORS.panel, PDF_COLORS.line);
  document.fillColor(PDF_COLORS.muted).font("Helvetica").fontSize(8).text(label.toUpperCase(), x + 10, y + 10);
  document.fillColor(color).font("Helvetica-Bold").fontSize(16).text(value, x + 10, y + 27, { width: 138 });
}

export function buildRunReportPdf(run: Run, scenario: Scenario): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const document = new PDFDocument({ size: "A4", margin: 42, info: { Title: `Informe StressLab - ${run.scenarioName}` } });
    const chunks: Buffer[] = [];
    document.on("data", (chunk: Buffer) => chunks.push(chunk));
    document.on("end", () => resolve(Buffer.concat(chunks)));
    document.on("error", reject);

    const addPageBackground = () => {
      document.rect(0, 0, 595, 842).fill(PDF_COLORS.background);
      document.fillColor(PDF_COLORS.cyan).font("Helvetica-Bold").fontSize(9).text("STRESSLAB / INFORME DE PRUEBA", 42, 28);
      document.fillColor(PDF_COLORS.muted).font("Helvetica").fontSize(8).text(run.id.slice(0, 8), 490, 28);
    };
    const newPage = () => {
      document.addPage();
      addPageBackground();
      return 58;
    };
    const ensureSpace = (y: number, height: number) => (y + height > 785 ? newPage() : y);

    addPageBackground();
    let y = 70;
    document.fillColor(PDF_COLORS.text).font("Helvetica-Bold").fontSize(25).text("Informe de prueba", 42, y);
    y += 34;
    document.fillColor(PDF_COLORS.mint).font("Helvetica-Bold").fontSize(14).text(run.scenarioName, 42, y);
    y += 28;

    const result = verdict(run, run.summary);
    const resultColor = result.className === "good" ? PDF_COLORS.mint : result.className === "bad" ? PDF_COLORS.rose : PDF_COLORS.amber;
    document.roundedRect(42, y, 511, 72, 8).fillAndStroke(PDF_COLORS.panel, resultColor);
    document.fillColor(resultColor).font("Helvetica-Bold").fontSize(14).text(result.title, 58, y + 14);
    document.fillColor(PDF_COLORS.text).font("Helvetica").fontSize(10).text(result.text, 58, y + 37, { width: 475, lineGap: 3 });
    y += 96;

    y = pdfSection(document, "Qué se intentó", y);
    pdfText(document, `${scenario.method} ${scenario.url}`, PDF_COLORS.text, 10);
    y += document.heightOfString(`${scenario.method} ${scenario.url}`, { width: 511, lineGap: 3 }) + 5;
    pdfText(document, `Carga: ${loadDescription(scenario)}`, PDF_COLORS.muted, 10);
    y += 20;
    pdfText(document, `Inicio: ${date(run.startedAt)}  |  Fin: ${date(run.endedAt)}  |  Código esperado: ${scenario.expectedStatus}`, PDF_COLORS.muted, 9);
    y += 28;

    y = pdfSection(document, "Cómo respondió", y);
    if (run.summary) {
      const summary = run.summary;
      pdfMetric(document, 42, y, "Solicitudes", number(summary.requests));
      pdfMetric(document, 218, y, "RPS promedio", number(summary.rps));
      pdfMetric(document, 394, y, "Errores", `${number(summary.errors)} (${percent(summary.errorRate)})`, summary.errors > 0 ? PDF_COLORS.rose : PDF_COLORS.mint);
      pdfMetric(document, 42, y + 70, "Latencia media", milliseconds(summary.avgLatencyMs));
      pdfMetric(document, 218, y + 70, "p95", milliseconds(summary.p95Ms));
      pdfMetric(document, 394, y + 70, "p99", milliseconds(summary.p99Ms));
      y += 148;
    } else {
      pdfText(document, "No se generó un resumen de métricas.", PDF_COLORS.rose);
      y += 30;
    }

    y = ensureSpace(y, 150);
    y = pdfSection(document, "Qué está bien", y);
    y = pdfBullets(document, positiveFindings(run.summary), y) + 10;

    y = ensureSpace(y, 150);
    y = pdfSection(document, "Qué se encontró", y);
    y = pdfBullets(document, findings(run.summary), y) + 10;

    y = ensureSpace(y, 150);
    y = pdfSection(document, "Oportunidades de mejora", y);
    y = pdfBullets(document, improvements(run.summary), y) + 10;

    if (run.summary?.thresholds.length) {
      y = ensureSpace(y, 150);
      y = pdfSection(document, "Límites evaluados", y);
      for (const threshold of run.summary.thresholds) {
        const color = threshold.passed ? PDF_COLORS.mint : PDF_COLORS.rose;
        document.fillColor(color).font("Helvetica-Bold").fontSize(10).text(threshold.passed ? "✓" : "✕", 48, y);
        pdfText(document, `${threshold.label}: ${threshold.passed ? "cumplido" : "no cumplido"} (real ${number(threshold.actual)}, objetivo ${number(threshold.target)})`, PDF_COLORS.text, 10);
        y += 20;
      }
    }

    y = ensureSpace(y, 65);
    y = pdfSection(document, "Conclusión", y);
    pdfText(
      document,
      run.error
        ? `La corrida terminó con un error: ${run.error}`
        : result.text,
      PDF_COLORS.text,
      10,
    );
    document.fillColor(PDF_COLORS.muted).font("Helvetica").fontSize(8).text(
      "Este informe describe el comportamiento HTTP observado. Para explicar causas de lentitud se requiere revisar CPU, memoria, base de datos, red y logs del servicio.",
      42,
      785,
      { width: 511 },
    );
    document.end();
  });
}
