// lib/pdf/buildActividadHtml.ts
export type ActividadData = {
    titulo: string;
    asignatura: string;
    fecha: string;
    umbralCE?: string;
    descripcion?: string;
    procedimientos?: string[];
    riesgos?: { titulo: string; mitigacion: string }[];
    roles?: string[];
    cronograma?: { hito: string; tiempo: string }[];
    rubrica?: { criterio: string; max: number }[];
    ceDetectados?: { codigo: string; descripcion: string; match: number }[];
  };
  
  export function buildActividadHtml(d: ActividadData): string {
    const proc = (d.procedimientos ?? []).map(p => `<li>${p}</li>`).join("");
    const roles = (d.roles ?? []).map(r => `<span class="kpi">${r}</span>`).join("");
    const cron = (d.cronograma ?? []).map(c => `<tr><td>${c.hito}</td><td>${c.tiempo}</td></tr>`).join("");
    const riesgos = (d.riesgos ?? []).map(r => `<tr><td><strong>${r.titulo}</strong></td><td>${r.mitigacion}</td></tr>`).join("");
    const rubrica = (d.rubrica ?? []).map(r => `<tr><td>${r.criterio}</td><td style="text-align:right">${r.max.toFixed(1)}</td></tr>`).join("");
    const ce = (d.ceDetectados ?? []).map(c => `<tr><td>${c.codigo}</td><td>${c.descripcion}</td><td style="text-align:right">${(c.match*100).toFixed(0)}%</td></tr>`).join("");
  
    return `
    <section>
      <h1>${d.titulo}</h1>
      <p class="meta"><strong>Asignatura:</strong> ${d.asignatura} &nbsp;·&nbsp; <strong>Fecha:</strong> ${d.fecha}${d.umbralCE ? ` &nbsp;·&nbsp; <strong>Umbral CE:</strong> ${d.umbralCE}` : ""}</p>
      <hr/>
      ${d.descripcion ? `<h2>Descripción</h2><p>${d.descripcion}</p>` : ""}
  
      ${proc ? `<h2>Procedimientos</h2><ol>${proc}</ol>` : ""}
  
      ${riesgos ? `<h2>Riesgos y mitigación</h2>
      <table><thead><tr><th>Riesgo</th><th>Mitigación</th></tr></thead><tbody>${riesgos}</tbody></table>` : ""}
  
      ${roles ? `<h2>Roles y responsables</h2><p>${roles}</p>` : ""}
  
      ${cron ? `<h2>Cronograma</h2>
      <table><thead><tr><th>Hito</th><th>Duración</th></tr></thead><tbody>${cron}</tbody></table>` : ""}
  
      ${rubrica ? `<h2>Rúbrica de evaluación</h2>
      <table><thead><tr><th>Criterio</th><th>Máx</th></tr></thead><tbody>${rubrica}</tbody></table>` : ""}
  
      ${ce ? `<h2>CE detectados</h2>
      <table><thead><tr><th>CE</th><th>Descripción</th><th>Match</th></tr></thead><tbody>${ce}</tbody></table>` : ""}
  
    </section>
    `;
  }