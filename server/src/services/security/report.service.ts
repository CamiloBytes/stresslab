import PDFDocument from "pdfkit";
import type {
  Project,
  SecurityAssessment,
  SecurityFinding,
} from "../../models/types.js";

import { printColors as COLORS } from '../pdf-palette.js';

const SEVERITY_COLOR: Record<string, string> = {
  critical: COLORS.rose,
  high: '#963e20',
  medium: COLORS.amber,
  low: COLORS.muted,
  info: COLORS.cyan,
};

const SEVERITY_LABEL: Record<string, string> = {
  critical: "Crítica",
  high: "Alta",
  medium: "Media",
  low: "Baja",
  info: "Informativa",
};

const STATUS_LABEL: Record<string, string> = {
  pending: "Pendiente de revisión",
  confirmed: "Confirmada",
  dismissed: "Descartada",
  remediated: "Remediada",
};

function date(value: string | null): string {
  if (!value) return "No disponible";
  return new Intl.DateTimeFormat("es-CO", { dateStyle: "medium", timeStyle: "short" }).format(
    new Date(value),
  );
}

function text(document: PDFKit.PDFDocument, value: string, color = COLORS.text, size = 10): void {
  document.fillColor(color).fontSize(size).font("Helvetica").text(value, { lineGap: 3 });
}

function section(document: PDFKit.PDFDocument, title: string, y: number): number {
  document.fillColor(COLORS.cyan).font("Helvetica-Bold").fontSize(13).text(title, 42, y);
  document
    .moveTo(42, y + 20)
    .lineTo(553, y + 20)
    .strokeColor(COLORS.line)
    .stroke();
  return y + 34;
}

function bullets(document: PDFKit.PDFDocument, items: string[], y: number): number {
  for (const item of items) {
    document.fillColor(COLORS.mint).font("Helvetica-Bold").fontSize(10).text("›", 48, y);
    document.fillColor(COLORS.text).font("Helvetica").fontSize(10).text(item, 62, y, {
      width: 485,
      lineGap: 3,
    });
    y += document.heightOfString(item, { width: 485, lineGap: 3 }) + 9;
  }
  return y;
}

function ensureSpace(document: PDFKit.PDFDocument, y: number, height: number, addPage: () => number): number {
  return y + height > 775 ? addPage() : y;
}

interface ReportInput {
  assessment: SecurityAssessment;
  findings: SecurityFinding[];
  project: Project | null;
  run: { scenarioName: string; summary: Record<string, unknown> | null; startedAt: string } | null;
}

export function buildSecurityReportPdf(input: ReportInput): Promise<Buffer> {
  const { assessment, findings, project, run } = input;

  return new Promise((resolve, reject) => {
    const document = new PDFDocument({
      size: "A4",
      margin: 42,
      info: { Title: `Informe de evaluación de seguridad — ${assessment.name}` },
    });
    const chunks: Buffer[] = [];
    document.on("data", (chunk: Buffer) => chunks.push(chunk));
    document.on("end", () => resolve(Buffer.concat(chunks)));
    document.on("error", reject);

    const addPageBackground = () => {
      document.rect(0, 0, 595, 842).fill(COLORS.background);
      document.fillColor(COLORS.cyan).font("Helvetica-Bold").fontSize(9).text("STRESSLAB / EVALUACIÓN DE SEGURIDAD", 42, 28);
      document.fillColor(COLORS.muted).font("Helvetica").fontSize(8).text(assessment.id.slice(0, 8), 490, 28);
    };
    const newPage = () => {
      document.addPage();
      addPageBackground();
      return 58;
    };

    addPageBackground();
    let y = 70;

    document.fillColor(COLORS.text).font("Helvetica-Bold").fontSize(24).text("Evaluación de seguridad", 42, y);
    y += 32;
    document.fillColor(COLORS.mint).font("Helvetica-Bold").fontSize(14).text(assessment.name, 42, y);
    y += 26;

    const summary = assessment.severitySummary;
    const topSeverity =
      summary.critical > 0
        ? "critical"
        : summary.high > 0
          ? "high"
          : summary.medium > 0
            ? "medium"
            : summary.low > 0
              ? "low"
              : "info";
    const verdictColor = SEVERITY_COLOR[topSeverity];
    const verdictTitle =
      assessment.findingCount === 0
        ? "Sin hallazgos registrados"
        : `Riesgo detectado: ${SEVERITY_LABEL[topSeverity]}`;
    const verdictText =
      assessment.findingCount === 0
        ? "El escaneo no registró alertas. Esto no garantiza ausencia de vulnerabilidades."
        : `Se importaron ${assessment.findingCount} hallazgos del escáner. Presentan la severidad reportada por la herramienta y siguen pendientes de validación manual salvo que se indique lo contrario.`;

    document.roundedRect(42, y, 511, 74, 8).fillAndStroke(COLORS.panel, verdictColor);
    document.fillColor(verdictColor).font("Helvetica-Bold").fontSize(13).text(verdictTitle, 58, y + 14);
    document.fillColor(COLORS.text).font("Helvetica").fontSize(9.5).text(verdictText, 58, y + 36, {
      width: 475,
      lineGap: 3,
    });
    y += 98;

    y = section(document, "Contexto", y);
    const meta = [
      `Objetivo: ${assessment.targetUrl}`,
      `Proyecto: ${project?.name ?? "sin proyecto"} · Entorno: ${assessment.environment}`,
      `Origen del reporte: ${assessment.source} · Importado: ${date(assessment.createdAt)}`,
      `Alcance del escaneo: ${assessment.scopeKey}`,
    ];
    for (const line of meta) {
      text(document, line, COLORS.muted, 9.5);
      y += 17;
    }
    y += 8;

    y = section(document, "Resumen por severidad", y);
    const severities: Array<keyof typeof summary> = ["critical", "high", "medium", "low", "info"];
    let boxX = 42;
    for (const severity of severities) {
      document.roundedRect(boxX, y, 94, 52, 6).fillAndStroke(COLORS.panel, COLORS.line);
      document.fillColor(SEVERITY_COLOR[severity]).font("Helvetica-Bold").fontSize(8).text(
        SEVERITY_LABEL[severity].toUpperCase(),
        boxX + 10,
        y + 10,
      );
      document.fillColor(COLORS.text).font("Helvetica-Bold").fontSize(18).text(
        String(summary[severity] ?? 0),
        boxX + 10,
        y + 24,
      );
      boxX += 104;
    }
    y += 72;

    if (assessment.aiAnalysis) {
      y = ensureSpace(document, y, 160, newPage);
      y = section(document, "Análisis asistido por IA", y);
      const ai = assessment.aiAnalysis;
      text(document, `Nivel de riesgo: ${SEVERITY_LABEL[ai.riskLevel] ?? ai.riskLevel} · Modelo: ${ai.model}`, COLORS.muted, 9);
      y += 18;
      text(document, ai.summary, COLORS.text, 10);
      y += document.heightOfString(ai.summary, { width: 511, lineGap: 3 }) + 8;
      text(document, ai.executiveSummary, COLORS.text, 10);
      y += document.heightOfString(ai.executiveSummary, { width: 511, lineGap: 3 }) + 10;
      if (ai.technicalRecommendations.length > 0) {
        y = bullets(document, ai.technicalRecommendations, y);
      }
      y += 6;
    }

    if (run) {
      y = ensureSpace(document, y, 140, newPage);
      y = section(document, "Resultados de rendimiento vinculados", y);
      const summaryRun = run.summary as
        | { p95Ms?: number; p99Ms?: number; errorRate?: number; requests?: number }
        | null;
      text(document, `Escenario: ${run.scenarioName} · Corrida: ${date(run.startedAt)}`, COLORS.muted, 9.5);
      y += 18;
      if (summaryRun) {
        const lines = [
          `Solicitudes: ${summaryRun.requests ?? "—"}`,
          `p95: ${summaryRun.p95Ms !== undefined ? `${Math.round(summaryRun.p95Ms)} ms` : "—"}`,
          `p99: ${summaryRun.p99Ms !== undefined ? `${Math.round(summaryRun.p99Ms)} ms` : "—"}`,
          `Tasa de error: ${summaryRun.errorRate !== undefined ? `${(summaryRun.errorRate * 100).toFixed(2)} %` : "—"}`,
        ];
        for (const line of lines) {
          text(document, line, COLORS.text, 10);
          y += 16;
        }
      } else {
        text(document, "La corrida no produjo métricas.", COLORS.muted, 10);
        y += 16;
      }
      y += 8;
    }

    y = ensureSpace(document, y, 120, newPage);
    y = section(document, "Hallazgos", y);

    if (findings.length === 0) {
      text(document, "No hay hallazgos registrados en esta evaluación.", COLORS.muted, 10);
      y += 24;
    } else {
      for (const finding of findings) {
        y = ensureSpace(document, y, 90, newPage);
        const color = SEVERITY_COLOR[finding.severity] ?? COLORS.muted;
        document.roundedRect(42, y, 511, 3, 2).fill(color);
        y += 10;
        document.fillColor(color).font("Helvetica-Bold").fontSize(10.5).text(
          `${SEVERITY_LABEL[finding.severity]} · ${finding.title}`,
          42,
          y,
          { width: 380 },
        );
        document.fillColor(COLORS.muted).font("Helvetica").fontSize(8.5).text(
          STATUS_LABEL[finding.status] ?? finding.status,
          430,
          y,
          { width: 123, align: "right" },
        );
        y += 18;
        const location = [finding.method, finding.url, finding.parameter ? `parámetro: ${finding.parameter}` : ""]
          .filter(Boolean)
          .join(" ");
        if (location) {
          text(document, location.slice(0, 300), COLORS.muted, 8.5);
          y += 14;
        }
        if (finding.evidence) {
          text(document, `Evidencia: ${finding.evidence.slice(0, 400)}`, COLORS.text, 8.5);
          y += document.heightOfString(`Evidencia: ${finding.evidence.slice(0, 400)}`, { width: 511 }) + 6;
        }
        if (finding.aiAnalysis) {
          text(document, `Impacto (IA): ${finding.aiAnalysis.impact.slice(0, 500)}`, COLORS.text, 8.5);
          y += document.heightOfString(`Impacto (IA): ${finding.aiAnalysis.impact.slice(0, 500)}`, { width: 511 }) + 4;
          text(document, `Recomendación (IA): ${finding.aiAnalysis.recommendation.slice(0, 500)}`, COLORS.mint, 8.5);
          y += document.heightOfString(`Recomendación (IA): ${finding.aiAnalysis.recommendation.slice(0, 500)}`, { width: 511 }) + 4;
        } else if (finding.scannerSolution) {
          text(document, `Solución del escáner: ${finding.scannerSolution.slice(0, 400)}`, COLORS.mint, 8.5);
          y += document.heightOfString(`Solución del escáner: ${finding.scannerSolution.slice(0, 400)}`, { width: 511 }) + 4;
        }
        y += 10;
      }
    }

    y = ensureSpace(document, y, 110, newPage);
    y = section(document, "Límites de esta evaluación", y);
    y = bullets(
      document,
      [
        "Los hallazgos provienen de un escaneo automatizado y no equivalen a un pentest profesional.",
        "La IA explica y prioriza resultados; no ejecuta explotaciones ni confirma vulnerabilidades por sí sola.",
        "La ausencia de alertas no demuestra que la aplicación sea segura.",
        "Requiere validación manual de explotabilidad antes de cerrar cualquier hallazgo.",
      ],
      y,
    );

    document.fillColor(COLORS.muted).font("Helvetica").fontSize(8).text(
      `Generado por StressLab el ${date(new Date().toISOString())} · Automated Security Assessment`,
      42,
      790,
      { width: 511 },
    );

    if(assessment.responseContract){const c=assessment.responseContract;newPage();document.text('Contrato de respuesta',42,68);text(document,`HTTP esperado ${c.expected.status}; observado ${c.observed.status}. Content-Type observado: ${c.observed.mediaType??'ausente'}.`);if(c.version)text(document,`Versión ${c.version}`);for(const r of c.rules??[])text(document,`${r.label}: ${{pass:'cumple',fail:'no cumple',skip:'no evaluada'}[r.outcome]}`);}
    document.end();
  });
}
