import type { RouteCtx } from '../router.ts';
import { el, toast } from '../../ui/dom.ts';
import {
  applyTheme, getSettings, saveSettings, type LlmConfig, type Mode,
} from '../../storage/settings.ts';
import { defaultModel, testConnection } from '../../llm/provider.ts';

const SKINS: [string, string][] = [
  ['classic', 'Classic'],
  ['midnight', 'Midnight'],
  ['botanical', 'Botanical'],
  ['art-deco', 'Art Deco'],
  ['ocean', 'Ocean'],
  ['terracotta', 'Terracotta'],
  ['mono', 'Mono'],
  ['beach', 'Beach Day'],
  ['harvest', 'Harvest'],
  ['hearth', 'Hearth'],
];

const PROVIDERS: [LlmConfig['provider'], string][] = [
  ['anthropic', 'Anthropic (Claude)'],
  ['openai', 'OpenAI (GPT)'],
  ['gemini', 'Google (Gemini)'],
  ['xai', 'xAI (Grok)'],
  ['custom', 'Custom endpoint'],
];

export function renderSettings(root: HTMLElement, _ctx: RouteCtx): void {
  const settings = getSettings();

  // --- Appearance ---------------------------------------------------------
  const skinGallery = el('div', { className: 'skin-gallery' });
  const renderSkins = (): void => {
    const current = getSettings().skin;
    skinGallery.replaceChildren(
      ...SKINS.map(([key, label]) => {
        const swatch = el('button', {
          className: `skin-swatch ${key === current ? 'active' : ''}`,
          'data-skin-preview': key,
        },
          el('span', { className: 'sw-preview' },
            el('span', { style: 'background: var(--sw-a, #ccc)' }),
            el('span', { style: 'background: var(--sw-b, #999)' }),
            el('span', { style: 'background: var(--sw-c, #333)' }),
          ),
          el('span', { className: 'sw-name' }, label),
        );
        swatch.addEventListener('click', () => {
          saveSettings({ skin: key });
          renderSkins();
        });
        return swatch;
      }),
    );
  };
  renderSkins();

  const modeRow = el('div', { className: 'picker-row' });
  const renderModes = (): void => {
    const current = getSettings().mode;
    modeRow.replaceChildren(
      ...([['light', 'Light'], ['dark', 'Dark'], ['system', 'Match system']] as [Mode, string][]).map(
        ([value, label]) => {
          const chip = el('button', { className: `chip ${value === current ? 'active' : ''}` }, label);
          chip.addEventListener('click', () => {
            saveSettings({ mode: value });
            applyTheme();
            renderModes();
          });
          return chip;
        },
      ),
    );
  };
  renderModes();

  // --- Solving toggles ------------------------------------------------------
  const toggle = (key: 'autocheck' | 'smartSkip' | 'adaptive' | 'sound', title: string, sub: string): HTMLElement => {
    const input = el('input', { type: 'checkbox' }) as HTMLInputElement;
    input.checked = getSettings()[key];
    input.addEventListener('change', () => saveSettings({ [key]: input.checked }));
    return el('div', { className: 'settings-row' },
      el('div', { className: 'grow' },
        el('div', { className: 'row-title' }, title),
        el('div', { className: 'row-sub' }, sub),
      ),
      el('label', { className: 'switch' }, input, el('span', { className: 'track' })),
    );
  };

  // --- AI provider -----------------------------------------------------------
  const llm = settings.llm ?? { provider: 'anthropic' as const, apiKey: '' };
  let provider = llm.provider;

  const providerRow = el('div', { className: 'picker-row' });
  const keyInput = el('input', {
    className: 'text-input',
    type: 'password',
    placeholder: 'API key (stored only on this device)',
    value: llm.apiKey,
    'aria-label': 'API key',
  }) as HTMLInputElement;
  const modelInput = el('input', {
    className: 'text-input',
    type: 'text',
    placeholder: `Model (default: ${defaultModel(provider) || 'required for custom'})`,
    value: llm.model ?? '',
    'aria-label': 'Model override',
  }) as HTMLInputElement;
  const baseUrlInput = el('input', {
    className: 'text-input',
    type: 'text',
    placeholder: 'Base URL (OpenAI-compatible, e.g. https://api.example.com/v1)',
    value: llm.baseUrl ?? '',
    'aria-label': 'Custom base URL',
  }) as HTMLInputElement;

  const renderProviders = (): void => {
    providerRow.replaceChildren(
      ...PROVIDERS.map(([value, label]) => {
        const chip = el('button', { className: `chip ${value === provider ? 'active' : ''}` }, label);
        chip.addEventListener('click', () => {
          provider = value;
          modelInput.placeholder = `Model (default: ${defaultModel(provider) || 'required for custom'})`;
          baseUrlInput.style.display = provider === 'custom' ? '' : 'none';
          renderProviders();
        });
        return chip;
      }),
    );
  };
  renderProviders();
  baseUrlInput.style.display = provider === 'custom' ? '' : 'none';

  const saveLlm = (): LlmConfig | null => {
    const apiKey = keyInput.value.trim();
    if (!apiKey) {
      saveSettings({ llm: null });
      return null;
    }
    const cfg: LlmConfig = {
      provider,
      apiKey,
      ...(modelInput.value.trim() ? { model: modelInput.value.trim() } : {}),
      ...(baseUrlInput.value.trim() ? { baseUrl: baseUrlInput.value.trim() } : {}),
    };
    saveSettings({ llm: cfg });
    return cfg;
  };

  const saveBtn = el('button', { className: 'btn primary' }, 'Save');
  saveBtn.addEventListener('click', () => {
    saveLlm();
    toast(keyInput.value.trim() ? 'AI settings saved' : 'AI key removed');
  });

  const testBtn = el('button', { className: 'btn' }, 'Test connection');
  testBtn.addEventListener('click', async () => {
    const cfg = saveLlm();
    if (!cfg) {
      toast('Enter an API key first');
      return;
    }
    testBtn.textContent = 'Testing…';
    (testBtn as HTMLButtonElement).disabled = true;
    try {
      await testConnection(cfg);
      toast('✓ Connected — themed generation is live');
    } catch (err) {
      toast(`✗ ${err instanceof Error ? err.message.slice(0, 80) : 'Connection failed'}`);
    } finally {
      testBtn.textContent = 'Test connection';
      (testBtn as HTMLButtonElement).disabled = false;
    }
  });

  // Keep global solver keys away from real inputs.
  for (const input of [keyInput, modelInput, baseUrlInput]) {
    input.addEventListener('keydown', (e) => e.stopPropagation());
  }

  root.append(
    el('div', { className: 'view-pad' },
      el('h1', { className: 'view-title' }, 'Settings'),

      el('div', { className: 'settings-group' },
        el('h2', { className: 'section-label' }, 'Appearance'),
        modeRow,
        skinGallery,
      ),

      el('div', { className: 'settings-group' },
        el('h2', { className: 'section-label' }, 'Solving'),
        toggle('autocheck', 'Autocheck', 'Mark letters right or wrong the moment you type them.'),
        toggle('smartSkip', 'Smart cursor', 'Typing skips over letters you’ve already placed.'),
        toggle('adaptive', 'Adapt puzzles to me', 'Generated puzzles lean gently toward the categories you enjoy. Dailies are never changed.'),
        toggle('sound', 'Sounds', 'Little dings for milestones.'),
      ),

      el('div', { className: 'settings-group' },
        el('h2', { className: 'section-label' }, 'AI theme engine (optional)'),
        el('p', { className: 'muted', style: 'font-size:0.88rem' },
          'Bring your own key from any major provider to unlock made-to-order themed puzzles. ',
          'The key lives in this browser’s storage only — use a limited-spend key.'),
        providerRow,
        el('div', { style: 'display:flex; flex-direction:column; gap:10px; max-width:460px' },
          keyInput, modelInput, baseUrlInput,
          el('div', { style: 'display:flex; gap:10px' }, saveBtn, testBtn),
        ),
      ),
    ),
  );
}
