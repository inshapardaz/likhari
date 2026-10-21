import { describe, expect, it } from 'vitest';
import { canJoinParagraphs, endsMidSentence, joinParagraphs } from './continuation';
import { elementBase, paragraph, textNode, type SNode } from '../shared/serialized';

const para = (text: string, extra: Record<string, unknown> = {}) => paragraph([textNode(text)], extra);

describe('endsMidSentence', () => {
  it.each([
    ['English words', 'and then they went'],
    ['a comma', 'first, second,'],
    ['a colon', 'he said:'],
    ['a semicolon', 'one; two;'],
    ['an Urdu comma', 'پہلا، دوسرا،'],
    ['an Urdu semicolon', 'پہلا؛'],
    ['a dash', 'to be continued -'],
    ['an Urdu word', 'یہ ایک جملہ ہے جو ختم نہیں'],
    ['trailing spaces', 'unfinished   '],
    ['an opening quote', 'he said “'],
    ['a comma inside a closing quote', '“Come here,”'],
  ])('is true for %s', (_, text) => {
    expect(endsMidSentence(para(text))).toBe(true);
  });

  it.each([
    ['an Urdu full stop', 'یہ جملہ ختم ہوا۔'],
    ['an Urdu question mark', 'کیا یہ ٹھیک ہے؟'],
    ['a full stop', 'It ended.'],
    ['a question mark', 'Did it end?'],
    ['an exclamation mark', 'Stop!'],
    ['an ellipsis', 'and so on…'],
    ['a full stop inside closing quotes', 'He said, “Go.”'],
    ['an Urdu full stop inside a closing quote', 'اس نے کہا، “جاؤ۔”'],
    ['a full stop inside brackets', 'It ended (see above.)'],
    ['an empty block', ''],
    ['whitespace only', '   '],
  ])('is false for %s', (_, text) => {
    expect(endsMidSentence(para(text))).toBe(false);
  });

  it('reads through formatting and links, only the end counts', () => {
    const block = paragraph([textNode('plain '), textNode('bold', 1), elementBase('link', [textNode(' link')], { url: 'https://x.test' })]);
    expect(endsMidSentence(block)).toBe(true);
    expect(endsMidSentence(paragraph([textNode('done', 1), textNode('۔', 0)]))).toBe(false);
  });
});

describe('canJoinParagraphs', () => {
  it('joins two plain paragraphs', () => {
    expect(canJoinParagraphs(para('a'), para('b'))).toBe(true);
  });

  it.each([
    ['there is no previous block', undefined, para('b')],
    ['there is no next block', para('a'), undefined],
    ['the previous block is a heading', elementBase('heading', [textNode('a')], { tag: 'h1' }), para('b')],
    ['the next block is a heading', para('a'), elementBase('heading', [textNode('b')], { tag: 'h1' })],
    ['the next block is a list', para('a'), elementBase('list', [], { listType: 'bullet' })],
    ['the previous block is a quote', elementBase('quote', [textNode('a')]), para('b')],
    ['the next paragraph is indented', para('a'), para('b', { indent: 1 })],
    ['the next paragraph is empty', para('a'), paragraph()],
    ['the previous paragraph is empty', paragraph(), para('b')],
    ['directions differ', para('a', { direction: 'ltr' }), para('ب', { direction: 'rtl' })],
    ['alignment differs', para('a', { format: 'center' }), para('b')],
  ])('refuses when %s', (_, previous, next) => {
    expect(canJoinParagraphs(previous, next)).toBe(false);
  });

  it('treats an unset direction, and "" versus "start" alignment, as compatible', () => {
    expect(canJoinParagraphs(para('a', { direction: null }), para('ب', { direction: 'rtl' }))).toBe(true);
    expect(canJoinParagraphs(para('a', { format: '' }), para('b', { format: 'start' }))).toBe(true);
    expect(canJoinParagraphs(para('a', { format: 'center' }), para('b', { format: 'center' }))).toBe(true);
  });
});

describe('joinParagraphs', () => {
  const texts = (block: SNode) => (block.children ?? []).map((c) => c.text);

  it('puts one space between the two', () => {
    const a = para('first');
    joinParagraphs(a, para('second'));
    expect(texts(a)).toEqual(['first', ' ', 'second']);
  });

  it('adds no space when one is already there', () => {
    const a = para('first ');
    joinParagraphs(a, para('second'));
    expect(texts(a)).toEqual(['first ', 'second']);
    const b = para('first');
    joinParagraphs(b, para(' second'));
    expect(texts(b)).toEqual(['first', ' second']);
  });

  it('keeps each run\'s own formatting and the added space unformatted', () => {
    const a = paragraph([textNode('bold', 1)]);
    joinParagraphs(a, paragraph([textNode('italic', 2)]));
    expect((a.children ?? []).map((c) => c.format)).toEqual([1, 0, 2]);
  });

  it('takes the next paragraph\'s direction only when the first had none', () => {
    const unset = para('a', { direction: null });
    joinParagraphs(unset, para('ب', { direction: 'rtl' }));
    expect(unset.direction).toBe('rtl');
    const set = para('a', { direction: 'ltr' });
    joinParagraphs(set, para('b', { direction: null }));
    expect(set.direction).toBe('ltr');
  });
});
