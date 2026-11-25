/**
 * `ui/shell/graph-clipboard` — копирование графика в системный буфер обмена
 * (spec: app-shell / «Graph clipboard copy»).
 *
 * Текущий вид анализа — это SVG-график. В настольной сборке (Tauri) и в
 * современных браузерах изображение помещается в буфер через `ClipboardItem`
 * с PNG; если изображения недоступны, в буфер кладётся текст SVG (best-effort).
 * Работа с буфером вынесена за `ClipboardBackend`, чтобы тесты не трогали
 * системный буфер.
 */

/** Абстракция системного буфера обмена. */
export interface ClipboardBackend {
  /** Копирует PNG-изображение. */
  copyPng(blob: Blob): Promise<void>;
  /** Копирует текст (резервный путь). */
  copyText(text: string): Promise<void>;
}

/** Текущий бэк буфера обмена. */
let backend: ClipboardBackend | null = null;

/** Устанавливает бэк буфера обмена (тесты подменяют). */
export function setClipboardBackend(next: ClipboardBackend | null): void {
  backend = next;
}

/** Браузерный/Tauri-бэк: `navigator.clipboard` с `ClipboardItem`. */
const domClipboardBackend: ClipboardBackend = {
  async copyPng(blob) {
    const item = new ClipboardItem({ 'image/png': blob });
    await navigator.clipboard.write([item]);
  },
  async copyText(text) {
    await navigator.clipboard.writeText(text);
  },
};

/** Возвращает активный бэк буфера обмена. */
export function getClipboardBackend(): ClipboardBackend {
  return backend ?? domClipboardBackend;
}

/** Сериализует SVG-элемент в строку. */
export function serializeSvg(svg: SVGSVGElement): string {
  return new XMLSerializer().serializeToString(svg);
}

/** Растеризует SVG-разметку в PNG-блоб (если среда поддерживает canvas/Image). */
async function rasterize(svg: SVGSVGElement): Promise<Blob | null> {
  if (typeof document === 'undefined' || typeof Image === 'undefined') return null;
  const width = svg.viewBox?.baseVal?.width || svg.clientWidth || 640;
  const height = svg.viewBox?.baseVal?.height || svg.clientHeight || 480;
  // Проверяем поддержку canvas заранее: в средах без 2D-контекста (jsdom без
  // пакета `canvas`) попытка растеризации зависла бы на загрузке изображения.
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;
  const markup = serializeSvg(svg);
  try {
    const url = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(markup)}`;
    const image = await new Promise<HTMLImageElement>((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = reject;
      img.src = url;
    });
    ctx.drawImage(image, 0, 0, width, height);
    return await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/png'));
  } catch {
    return null;
  }
}

/**
 * Копирует график (SVG-элемент) в буфер обмена.
 *
 * @returns `true` при успехе; `false`, если скопировать не удалось
 */
export async function copyChartToClipboard(svg: SVGSVGElement): Promise<boolean> {
  const clip = getClipboardBackend();
  try {
    const png = await rasterize(svg);
    if (png) {
      await clip.copyPng(png);
      return true;
    }
    // Изображение не получилось — копируем разметку SVG как текст.
    await clip.copyText(serializeSvg(svg));
    return true;
  } catch {
    return false;
  }
}
