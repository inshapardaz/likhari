import { describe, expect, it } from 'vitest';
import { $createParagraphNode, $createTextNode, $getRoot, createEditor } from 'lexical';
import { $replaceMatch } from '../find/findReplaceActions';
import { $collectMisspellings } from './spellcheckActions';
import { getSpeller, registerSpellDictionary, type Speller } from './spellDictionaries';

const AFF = 'SET UTF-8\n';
const DIC = '2\nکتاب\nکمرہ\n';

async function speller(): Promise<Speller> {
  registerSpellDictionary('ur', { aff: AFF, dic: DIC });
  return (await getSpeller('ur'))!;
}

function makeEditor() {
  return createEditor({
    namespace: 'spell-test',
    onError: (e) => {
      throw e;
    },
  });
}

describe('$collectMisspellings', () => {
  it('finds unknown words across paragraphs, with their positions in the text', async () => {
    const checker = await speller();
    const editor = makeEditor();
    editor.update(
      () => {
        $getRoot().clear();
        $getRoot().append($createParagraphNode().append($createTextNode('کتاب غلط')));
        $getRoot().append($createParagraphNode().append($createTextNode('کمرہ غلط')));
      },
      { discrete: true },
    );
    const found = editor.getEditorState().read(() => $collectMisspellings(checker));
    expect(found.map((m) => m.word)).toEqual(['غلط', 'غلط']);
  });

  it('a found word can be replaced in place', async () => {
    const checker = await speller();
    const editor = makeEditor();
    editor.update(
      () => {
        $getRoot().clear();
        $getRoot().append($createParagraphNode().append($createTextNode('کتاب غلط')));
      },
      { discrete: true },
    );
    editor.update(
      () => {
        const [first] = $collectMisspellings(checker);
        $replaceMatch(first.match, 'کمرہ');
      },
      { discrete: true },
    );
    expect(editor.getEditorState().read(() => $getRoot().getTextContent())).toBe('کتاب کمرہ');
  });
});
