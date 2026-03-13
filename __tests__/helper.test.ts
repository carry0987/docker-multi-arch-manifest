import { describe, expect, it } from 'vitest';
import {
    buildDigestRefs,
    buildImagetoolsArgs,
    extractDigest,
    globToRegex,
    parseAnnotations,
    parseTags
} from '../src/helper';

describe('parseTags', () => {
    it('should parse multi-line tags', () => {
        expect(parseTags('latest\nv1.0\nv1.1')).toEqual(['latest', 'v1.0', 'v1.1']);
    });

    it('should trim whitespace and filter empty lines', () => {
        expect(parseTags('  latest \n\n  v1.0  \n  ')).toEqual(['latest', 'v1.0']);
    });

    it('should return empty array for blank input', () => {
        expect(parseTags('')).toEqual([]);
        expect(parseTags('  \n  \n  ')).toEqual([]);
    });
});

describe('globToRegex', () => {
    it('should match wildcard patterns', () => {
        const re = globToRegex('digest-*');
        expect(re.test('digest-linux-amd64')).toBe(true);
        expect(re.test('digest-')).toBe(true);
        expect(re.test('other-prefix')).toBe(false);
    });

    it('should match single-char wildcard', () => {
        const re = globToRegex('digest-?');
        expect(re.test('digest-a')).toBe(true);
        expect(re.test('digest-ab')).toBe(false);
    });

    it('should escape regex special characters', () => {
        const re = globToRegex('my.artifact');
        expect(re.test('my.artifact')).toBe(true);
        expect(re.test('myXartifact')).toBe(false);
    });

    it('should match exact string without wildcards', () => {
        const re = globToRegex('exact-name');
        expect(re.test('exact-name')).toBe(true);
        expect(re.test('exact-name-extra')).toBe(false);
    });
});

describe('buildDigestRefs', () => {
    it('should build image@sha256:<basename> references', () => {
        const files = ['/tmp/digests/abc123', '/tmp/digests/def456'];
        expect(buildDigestRefs('myimage', files)).toEqual(['myimage@sha256:abc123', 'myimage@sha256:def456']);
    });

    it('should return empty array for no files', () => {
        expect(buildDigestRefs('myimage', [])).toEqual([]);
    });
});

describe('parseAnnotations', () => {
    it('should parse annotations with index: prefix', () => {
        const input = 'org.opencontainers.image.title=MyApp\norg.opencontainers.image.version=1.0';
        expect(parseAnnotations(input)).toEqual([
            'index:org.opencontainers.image.title=MyApp',
            'index:org.opencontainers.image.version=1.0'
        ]);
    });

    it('should skip lines without =', () => {
        const input = 'valid=value\ninvalid line\nalso.valid=ok';
        expect(parseAnnotations(input)).toEqual(['index:valid=value', 'index:also.valid=ok']);
    });

    it('should trim whitespace from lines', () => {
        expect(parseAnnotations('  key=value  ')).toEqual(['index:key=value']);
    });

    it('should return empty array for blank input', () => {
        expect(parseAnnotations('')).toEqual([]);
        expect(parseAnnotations('no equals here')).toEqual([]);
    });
});

describe('buildImagetoolsArgs', () => {
    it('should build full args with tags, annotations, and digests', () => {
        const result = buildImagetoolsArgs(
            'myimage',
            ['latest', 'v1.0'],
            ['index:key=value'],
            ['myimage@sha256:abc123']
        );
        expect(result).toEqual([
            'buildx',
            'imagetools',
            'create',
            '-t',
            'myimage:latest',
            '-t',
            'myimage:v1.0',
            '--annotation',
            'index:key=value',
            'myimage@sha256:abc123'
        ]);
    });

    it('should work with no annotations', () => {
        const result = buildImagetoolsArgs('img', ['latest'], [], ['img@sha256:aaa']);
        expect(result).toEqual(['buildx', 'imagetools', 'create', '-t', 'img:latest', 'img@sha256:aaa']);
    });

    it('should work with multiple digests', () => {
        const result = buildImagetoolsArgs('img', ['latest'], [], ['img@sha256:aaa', 'img@sha256:bbb']);
        expect(result).toEqual([
            'buildx',
            'imagetools',
            'create',
            '-t',
            'img:latest',
            'img@sha256:aaa',
            'img@sha256:bbb'
        ]);
    });
});

describe('extractDigest', () => {
    it('should extract sha256 digest from inspect output', () => {
        const output = `Name:      myimage:latest
MediaType: application/vnd.oci.image.index.v1+json
Digest:    sha256:abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890
`;
        expect(extractDigest(output)).toBe('sha256:abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890');
    });

    it('should return null when no digest found', () => {
        expect(extractDigest('no digest here')).toBeNull();
        expect(extractDigest('')).toBeNull();
    });
});
