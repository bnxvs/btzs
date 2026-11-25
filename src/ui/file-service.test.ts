/**
 * Тесты браузерного файлового бэкенда (dev без Tauri).
 *
 * Chrome открывает диалог выбора файла только при наличии кратковременной
 * активации пользователя. Пока пользователь искал предыдущий файл, активация
 * может истечь — тогда программный `input.click()` молча игнорируется.
 * Проверяем, что бэкенд в этом случае показывает запрос с кнопкой (её нажатие
 * даёт свежий жест), а не «зависает».
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { getFileBackend } from './file-service';

/** Задаёт состояние кратковременной активации страницы в jsdom. */
function setActivation(isActive: boolean): void {
  Object.defineProperty(navigator, 'userActivation', {
    configurable: true,
    get: () => ({ isActive, hasBeenActive: isActive }),
  });
}

/** Последний созданный бэкендом `<input type=file>`. */
let captured: HTMLInputElement | null = null;
const originalClick = HTMLInputElement.prototype.click;

/** Помещает файл в перехваченный input и сообщает о выборе. */
function deliver(name: string, bytes: Uint8Array): void {
  if (!captured) throw new Error('файловый input ещё не создан');
  const file = new File([bytes as BlobPart], name) as File & {
    arrayBuffer?: () => Promise<ArrayBuffer>;
  };
  // В jsdom у `File` может отсутствовать `arrayBuffer` — добавляем вручную.
  if (!file.arrayBuffer) {
    file.arrayBuffer = async () => bytes.buffer.slice(0) as ArrayBuffer;
  }
  Object.defineProperty(captured, 'files', { configurable: true, value: [file] });
  captured.dispatchEvent(new Event('change'));
}

beforeEach(() => {
  captured = null;
  HTMLInputElement.prototype.click = function () {
    // Реальный системный диалог в jsdom не открывается; запоминаем input.
    if (this.type === 'file') captured = this as HTMLInputElement;
  };
});

afterEach(() => {
  HTMLInputElement.prototype.click = originalClick;
  Reflect.deleteProperty(navigator, 'userActivation');
  document.querySelectorAll('[data-testid="file-prompt"]').forEach((n) => n.remove());
  document.querySelectorAll('input[type=file]').forEach((n) => n.remove());
});

describe('Браузерный бэкенд выбора файла', () => {
  it('при активной странице открывает input сразу, без запроса', async () => {
    setActivation(true);
    const opened = getFileBackend().openFile({ filters: [{ label: 'Film', patterns: ['*.pfc'] }] });
    expect(captured).not.toBeNull();
    expect(document.querySelector('[data-testid="file-prompt"]')).toBeNull();
    deliver('film.pfc', new Uint8Array([1, 2, 3]));
    await expect(opened).resolves.toMatchObject({ path: 'film.pfc' });
  });

  it('без активации показывает запрос, а кнопка даёт свежий жест', async () => {
    setActivation(false);
    const opened = getFileBackend().openFile({
      filters: [{ label: 'Paper', patterns: ['*.ppc'] }],
      title: 'Выберите файл бумаги',
    });
    const prompt = document.querySelector('[data-testid="file-prompt"]');
    expect(prompt).not.toBeNull();
    expect(prompt?.textContent).toContain('Выберите файл бумаги');
    // Диалог ещё не открыт: программный click не вызывался.
    expect(captured).toBeNull();
    (document.querySelector('[data-testid="file-pick"]') as HTMLButtonElement).click();
    expect(captured).not.toBeNull();
    expect(document.querySelector('[data-testid="file-prompt"]')).toBeNull();
    deliver('paper.ppc', new Uint8Array([4, 5, 6]));
    await expect(opened).resolves.toMatchObject({ path: 'paper.ppc' });
  });

  it('отмена выбора (событие cancel) возвращает null', async () => {
    setActivation(true);
    const opened = getFileBackend().openFile({ filters: [{ label: 'Film', patterns: ['*.pfc'] }] });
    captured!.dispatchEvent(new Event('cancel'));
    await expect(opened).resolves.toBeNull();
  });

  it('отмена в запросе возвращает null и снимает запрос', async () => {
    setActivation(false);
    const opened = getFileBackend().openFile({ filters: [{ label: 'Film', patterns: ['*.pfc'] }] });
    (document.querySelector('[data-testid="file-prompt-cancel"]') as HTMLButtonElement).click();
    await expect(opened).resolves.toBeNull();
    expect(document.querySelector('[data-testid="file-prompt"]')).toBeNull();
  });
});
