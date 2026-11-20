import { describe, expect, it } from 'vitest';
import { APP_DISPLAY_NAME } from '@/config/app';
import { formatFilenameWithStatus, formatPageTitle } from './usePageTitle';

describe('formatFilenameWithStatus', () => {
  it('returns plain filename when pristine', () => {
    expect(formatFilenameWithStatus('보고서.docx', 'pristine')).toBe('보고서.docx');
    expect(formatFilenameWithStatus('보고서.docx')).toBe('보고서.docx');
  });

  it('appends " - 수정됨" when modified', () => {
    expect(formatFilenameWithStatus('보고서.docx', 'modified')).toBe('보고서.docx - 수정됨');
  });

  it('appends " - 저장됨" when saved', () => {
    expect(formatFilenameWithStatus('보고서.docx', 'saved')).toBe('보고서.docx - 저장됨');
  });

  it('returns empty string for empty or nullish names', () => {
    expect(formatFilenameWithStatus('', 'modified')).toBe('');
    expect(formatFilenameWithStatus(null, 'saved')).toBe('');
  });
});

describe('formatPageTitle', () => {
  it('includes save status next to the filename in the page title', () => {
    expect(formatPageTitle('문서.hwp', 'pristine')).toBe(`문서.hwp - ${APP_DISPLAY_NAME}`);
    expect(formatPageTitle('문서.hwp', 'modified')).toBe(`문서.hwp - 수정됨 - ${APP_DISPLAY_NAME}`);
    expect(formatPageTitle('문서.hwp', 'saved')).toBe(`문서.hwp - 저장됨 - ${APP_DISPLAY_NAME}`);
  });
});
