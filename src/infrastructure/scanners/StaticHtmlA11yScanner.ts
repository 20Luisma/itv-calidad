import type { Finding } from '../../domain/types.js';
import { walkRepoFiles } from '../fs/RepoFileWalker.js';

const VIEW_EXTENSIONS = new Set(['.html', '.htm', '.php', '.jsx', '.tsx', '.vue']);

function lineNumberAt(content: string, index: number): number {
  return content.slice(0, index).split(/\r?\n/).length;
}

function hasMarkup(content: string): boolean {
  return /<(?:html|body|main|div|section|img|button|input|a|h[1-6])\b/i.test(content);
}

export async function scanStaticHtmlAccessibility(repoPath: string): Promise<{
  filesScanned: number;
  findings: Finding[];
}> {
  const candidates = await walkRepoFiles(repoPath, VIEW_EXTENSIONS, 200);
  const files = candidates.filter((file) => {
    const isPureHtml = file.relativePath.endsWith('.html') || file.relativePath.endsWith('.htm');
    return isPureHtml || hasMarkup(file.content);
  });

  const findings: Finding[] = [];

  for (const file of files) {
    const content = file.content;

    // 1. Etiqueta <html ...> sin atributo lang
    const htmlTagMatch = /<html\b[^>]*>/i.exec(content);
    if (htmlTagMatch && !/\blang\s*=\s*["'{][^"'}]+["'}]/i.test(htmlTagMatch[0])) {
      findings.push({
        severity: 'warning',
        title: 'Documento HTML sin atributo lang',
        file: file.relativePath,
        line: lineNumberAt(content, htmlTagMatch.index),
        reason: 'Los lectores de pantalla necesitan `<html lang="es">` (o el idioma correspondiente) para pronunciar bien el contenido (WCAG 3.1.1).',
        howToFix: 'Agregá `lang="es"` en la etiqueta raíz `<html>`.'
      });
    }

    // 2. Imágenes sin atributo alt
    const imgRegex = /<img\b[^>]*>/gi;
    let imgMatch: RegExpExecArray | null;
    while ((imgMatch = imgRegex.exec(content)) !== null) {
      if (!/\balt\s*=\s*(?:["'][^"']*["']|\{[^}]+\})/i.test(imgMatch[0])) {
        findings.push({
          severity: 'error',
          title: 'Imagen <img> sin atributo alt',
          file: file.relativePath,
          line: lineNumberAt(content, imgMatch.index),
          reason: 'Una imagen sin `alt` es invisible o confusa para usuarios con lectores de pantalla (WCAG 1.1.1).',
          howToFix: 'Agregá un texto alternativo descriptivo `alt="..."` o `alt=""` si la imagen es puramente decorativa.'
        });
      }
    }

    // 3. Inputs interactivos sin label accesible (ni id ni aria-label/aria-labelledby)
    const inputRegex = /<input\b[^>]*>/gi;
    let inputMatch: RegExpExecArray | null;
    while ((inputMatch = inputRegex.exec(content)) !== null) {
      const tag = inputMatch[0];
      if (/\btype\s*=\s*["'](?:hidden|submit|button|reset)["']/i.test(tag)) {
        continue;
      }
      const hasAccessibleBinding =
        /\b(?:aria-label|aria-labelledby|id)\s*=\s*(?:["'][^"']+["']|\{[^}]+\})/i.test(tag);
      if (!hasAccessibleBinding) {
        findings.push({
          severity: 'warning',
          title: 'Campo <input> sin etiqueta accesible',
          file: file.relativePath,
          line: lineNumberAt(content, inputMatch.index),
          reason: 'El placeholder desaparece al escribir y no reemplaza a `<label for="...">` ni a `aria-label` (WCAG 3.3.2).',
          howToFix: 'Asociá un `<label for="mi-campo">` con `id="mi-campo"` o agregá `aria-label="..."`.'
        });
      }
    }

    // 4. Botones sin texto visible ni aria-label
    const buttonRegex = /<button\b([^>]*)>([\s\S]*?)<\/button>/gi;
    let btnMatch: RegExpExecArray | null;
    while ((btnMatch = buttonRegex.exec(content)) !== null) {
      const attrs = btnMatch[1] ?? '';
      const innerText = (btnMatch[2] ?? '').replace(/<[^>]+>/g, '').trim();
      const hasAria = /\b(?:aria-label|aria-labelledby|title)\s*=\s*(?:["'][^"']+["']|\{[^}]+\})/i.test(attrs);
      if (!innerText && !hasAria) {
        findings.push({
          severity: 'error',
          title: 'Botón <button> sin nombre accesible',
          file: file.relativePath,
          line: lineNumberAt(content, btnMatch.index),
          reason: 'Un botón con solo ícono y sin `aria-label` no indica su acción a tecnologías asistivas (WCAG 4.1.2).',
          howToFix: 'Agregá texto visible dentro del `<button>` o un atributo `aria-label="Descripción de la acción"`.'
        });
      }
    }

    // 5. Enlaces <a> sin texto ni aria-label
    const anchorRegex = /<a\b([^>]*)>([\s\S]*?)<\/a>/gi;
    let anchorMatch: RegExpExecArray | null;
    while ((anchorMatch = anchorRegex.exec(content)) !== null) {
      const attrs = anchorMatch[1] ?? '';
      const innerRaw = anchorMatch[2] ?? '';
      const innerText = innerRaw.replace(/<[^>]+>/g, '').trim();
      const hasImgAlt = /<img\b[^>]*\balt\s*=\s*["'][^"']+["']/i.test(innerRaw);
      const hasAria = /\b(?:aria-label|aria-labelledby|title)\s*=\s*(?:["'][^"']+["']|\{[^}]+\})/i.test(attrs);
      if (!innerText && !hasAria && !hasImgAlt) {
        findings.push({
          severity: 'error',
          title: 'Enlace <a> sin nombre accesible',
          file: file.relativePath,
          line: lineNumberAt(content, anchorMatch.index),
          reason: 'Un enlace vacío (o con solo ícono/SVG sin texto) no indica a dónde lleva al navegar con teclado o lector de pantalla (WCAG 2.4.4).',
          howToFix: 'Agregá texto descriptivo dentro del enlace o `aria-label="Destino del enlace"`.'
        });
      }
    }

    // 6. Saltos bruscos en jerarquía de headings (ej. h1 -> h4)
    const headingRegex = /<h([1-6])\b/gi;
    let prevLevel = 0;
    let headingMatch: RegExpExecArray | null;
    while ((headingMatch = headingRegex.exec(content)) !== null) {
      const level = Number(headingMatch[1]);
      if (prevLevel > 0 && level > prevLevel + 1) {
        findings.push({
          severity: 'warning',
          title: `Salto de jerarquía de encabezados (<h${prevLevel}> a <h${level}>)`,
          file: file.relativePath,
          line: lineNumberAt(content, headingMatch.index),
          reason: 'Saltar niveles de encabezados desorienta a usuarios que navegan la página por estructura de títulos (WCAG 1.3.1).',
          howToFix: `Usá <h${prevLevel + 1}> en lugar de <h${level}> y ajustá el tamaño visual con CSS.`
        });
      }
      prevLevel = level;
    }
  }

  return {
    filesScanned: files.length,
    findings
  };
}
