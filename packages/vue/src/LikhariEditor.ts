import { defineComponent, h, onBeforeUnmount, onMounted, ref, watch, type PropType } from 'vue';
import '@inshapardaz/likhari-webcomponent';
import type { EditorFeatureConfig } from '@inshapardaz/likhari-core';
import type { FormatId } from '@inshapardaz/likhari-converters';
import { toElementAttributes } from './attributes';

/** The element's surface, as this wrapper uses it. */
interface EditorElement extends HTMLElement {
  featureConfig: EditorFeatureConfig | undefined;
  getContent(format: FormatId): string;
  setContent(value: string, format: FormatId): void;
  hasUnsavedChanges(): boolean;
  confirmDiscard(): Promise<boolean>;
  focus(): void;
}

/**
 * `<LikhariEditor>` for Vue. A thin wrapper over the `<likhari-editor>` Web
 * Component: props become attributes, `featureConfig` is set as a property, and the
 * element's `editor-change` and `editor-save` events are re-emitted as `change` and
 * `save`. Template refs can call `getContent`, `setContent`, `hasUnsavedChanges`,
 * `confirmDiscard` and `focus`, which are exposed below.
 */
export const LikhariEditor = defineComponent({
  name: 'LikhariEditor',
  props: {
    documentId: String,
    locale: String as PropType<string>,
    colorScheme: String as PropType<'light' | 'dark'>,
    accentColor: String,
    placeholder: String,
    height: String,
    // Vue makes an absent Boolean prop false; `default: undefined` keeps "not set" distinct from false.
    showSave: { type: Boolean, default: undefined },
    autosave: { type: Boolean, default: undefined },
    featurePreset: String as PropType<'minimal' | 'standard' | 'full' | 'poetry'>,
    featureConfig: Object as PropType<EditorFeatureConfig>,
  },
  emits: {
    change: (state: unknown) => state !== undefined,
    save: (payload: { content: string; format: FormatId }) => payload !== undefined,
  },
  setup(props, { emit, expose }) {
    const element = ref<EditorElement | null>(null);

    const onChange = (event: Event) => emit('change', (event as CustomEvent).detail);
    const onSave = (event: Event) => emit('save', (event as CustomEvent).detail);

    const applyConfig = () => {
      if (element.value) element.value.featureConfig = props.featureConfig;
    };

    onMounted(() => {
      element.value?.addEventListener('editor-change', onChange);
      element.value?.addEventListener('editor-save', onSave);
      applyConfig();
    });

    onBeforeUnmount(() => {
      element.value?.removeEventListener('editor-change', onChange);
      element.value?.removeEventListener('editor-save', onSave);
    });

    watch(() => props.featureConfig, applyConfig, { deep: true });

    expose({
      getContent: (format: FormatId) => element.value?.getContent(format) ?? '',
      setContent: (value: string, format: FormatId) => element.value?.setContent(value, format),
      hasUnsavedChanges: () => element.value?.hasUnsavedChanges() ?? false,
      confirmDiscard: () => element.value?.confirmDiscard() ?? Promise.resolve(true),
      focus: () => element.value?.focus(),
    });

    return () => h('likhari-editor', { ref: element, ...toElementAttributes(props) });
  },
});
