const ANSI_ESCAPE = /\u001b\[[0-?]*[ -/]*[@-~]/g;

function formatNumber(value: string): string {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed.toLocaleString("es-ES") : value;
}

function translateProgress(line: string): string | null {
  const progress = line.match(/running\s+\(([^)]+)\),\s*(\d+)\/(\d+)\s+VUs?(?:,\s*(.*))?/i);
  if (!progress) return null;

  const [, elapsed, activeVus, totalVus, details] = progress;
  const detailsText = details ? ` ${details.trim()}.` : ".";
  return `Prueba en ejecución: ${activeVus}/${totalVus} usuarios virtuales activos; ${elapsed} transcurridos.${detailsText}`;
}

function translateSummary(line: string): string | null {
  const summary = line.match(/^\s*(http_reqs|http_req_duration|http_req_failed|iterations|checks)\s+(.+)$/i);
  if (!summary) return null;

  const labels: Record<string, string> = {
    http_reqs: "solicitudes HTTP",
    http_req_duration: "latencia de solicitudes HTTP",
    http_req_failed: "solicitudes HTTP fallidas",
    iterations: "iteraciones",
    checks: "validaciones",
  };
  return `Resumen de ${labels[summary[1].toLowerCase()] ?? summary[1]}: ${summary[2]}`;
}

export function translateK6Log(input: string): string {
  const line = input.replace(ANSI_ESCAPE, "").trim();
  if (!line) return "";

  if (/^ERRO(?:R)?\b/i.test(line)) {
    return `Error durante la prueba: ${line.replace(/^ERRO(?:R)?\s*/i, "")}`;
  }
  if (/^WARN(?:ING)?\b/i.test(line)) {
    return `Advertencia de k6: ${line.replace(/^WARN(?:ING)?\s*/i, "")}`;
  }
  if (/^\s*execution:/i.test(line)) {
    return `Configuración de ejecución: ${line.replace(/^\s*execution:\s*/i, "")}`;
  }
  if (/^\s*default\s+\[.*\]/i.test(line)) {
    return `Ejecutando escenario principal: ${line.trim()}`;
  }

  const progress = translateProgress(line);
  if (progress) return progress;

  const summary = translateSummary(line);
  if (summary) return summary;

  const received = line.match(/data_received[=:]\s*([\d.]+)\s*([kMGT]?B)/i);
  if (received) {
    return `Datos recibidos por el servicio: ${formatNumber(received[1])} ${received[2]}.`;
  }

  const sent = line.match(/data_sent[=:]\s*([\d.]+)\s*([kMGT]?B)/i);
  if (sent) {
    return `Datos enviados al servicio: ${formatNumber(sent[1])} ${sent[2]}.`;
  }

  if (/finished|test finished|done/i.test(line)) {
    return `Prueba finalizada: ${line}`;
  }

  return `Salida de k6: ${line}`;
}
