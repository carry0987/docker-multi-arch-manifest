import * as path from 'node:path';

/**
 * Parse multi-line tags input into an array of non-empty trimmed strings.
 */
export function parseTags(input: string): string[] {
    return input
        .split('\n')
        .map((t) => t.trim())
        .filter(Boolean);
}

/**
 * Convert a simple glob pattern (supporting `*` and `?`) into a RegExp
 * that matches the full string.
 */
export function globToRegex(pattern: string): RegExp {
    const escaped = pattern.replace(/[.+^${}()|[\]\\]/g, '\\$&');
    return new RegExp(`^${escaped.replace(/\*/g, '.*').replace(/\?/g, '.')}$`);
}

/**
 * Build `image@sha256:<basename>` references from digest file paths.
 */
export function buildDigestRefs(image: string, files: string[]): string[] {
    return files.map((f) => `${image}@sha256:${path.basename(f)}`);
}

/**
 * Parse multi-line annotations input and prefix each with `index:`.
 * Only lines containing `=` are included.
 */
export function parseAnnotations(input: string): string[] {
    const result: string[] = [];
    for (const line of input.split('\n')) {
        const trimmed = line.trim();
        if (trimmed?.includes('=')) {
            result.push(`index:${trimmed}`);
        }
    }
    return result;
}

/**
 * Assemble the full argument list for `docker buildx imagetools create`.
 */
export function buildImagetoolsArgs(image: string, tags: string[], annotations: string[], digests: string[]): string[] {
    const args = ['buildx', 'imagetools', 'create'];

    for (const tag of tags) {
        args.push('-t', `${image}:${tag}`);
    }

    for (const annotation of annotations) {
        args.push('--annotation', annotation);
    }

    args.push(...digests);
    return args;
}

/**
 * Extract the first `sha256:...` digest from `docker buildx imagetools inspect` output.
 */
export function extractDigest(output: string): string | null {
    const match = output.match(/Digest:\s+(sha256:[a-f0-9]+)/);
    return match ? match[1] : null;
}
