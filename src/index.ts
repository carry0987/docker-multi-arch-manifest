import * as fs from 'node:fs';
import { DefaultArtifactClient } from '@actions/artifact';
import * as core from '@actions/core';
import * as exec from '@actions/exec';
import * as glob from '@actions/glob';
import {
    buildDigestRefs,
    buildImagetoolsArgs,
    extractDigest,
    globToRegex,
    parseAnnotations,
    parseTags
} from './helper';

async function run(): Promise<void> {
    try {
        // --- Read inputs ---
        const image = core.getInput('image', { required: true });
        const tagsInput = core.getInput('tags', { required: true });
        const annotationsInput = core.getInput('annotations');
        const artifactPattern = core.getInput('artifact-pattern');
        const verify = core.getBooleanInput('verify');

        // --- Parse tags ---
        const tags = parseTags(tagsInput);

        if (tags.length === 0) {
            throw new Error('No tags provided');
        }
        core.info(`Tags to apply: ${tags.join(', ')}`);

        // --- Download digest artifacts ---
        core.startGroup('Download digest artifacts');
        const digestDir = '/tmp/digests';
        fs.mkdirSync(digestDir, { recursive: true });

        const artifact = new DefaultArtifactClient();

        // List all artifacts and filter by pattern
        const { artifacts } = await artifact.listArtifacts();
        const patternRegex = globToRegex(artifactPattern);
        const matchingArtifacts = artifacts.filter((a) => patternRegex.test(a.name));

        if (matchingArtifacts.length === 0) {
            throw new Error(`No artifacts matching pattern "${artifactPattern}" found`);
        }

        // Download each matching artifact
        for (const art of matchingArtifacts) {
            await artifact.downloadArtifact(art.id, { path: digestDir });
        }

        core.info(
            `Downloaded ${matchingArtifacts.length} artifact(s): ${matchingArtifacts.map((a) => a.name).join(', ')}`
        );
        core.endGroup();

        // --- Collect digest files ---
        core.startGroup('Collect digests');
        const globber = await glob.create(`${digestDir}/**/*`, {
            followSymbolicLinks: false
        });
        const digestFiles = (await globber.glob()).filter((f) => fs.statSync(f).isFile());

        if (digestFiles.length === 0) {
            throw new Error('No digest files found after downloading artifacts');
        }

        const digests = buildDigestRefs(image, digestFiles);
        core.info(`Digests:\n${digests.join('\n')}`);
        core.endGroup();

        // --- Set up Docker Buildx ---
        core.startGroup('Set up Docker Buildx');
        await exec.exec('docker', ['buildx', 'create', '--use', '--driver', 'docker-container']).catch(() => {
            core.info('Buildx builder already exists or creation failed, attempting to use default');
            return exec.exec('docker', ['buildx', 'use', 'default']);
        });
        core.endGroup();

        // --- Create multi-arch manifest ---
        core.startGroup('Create multi-arch manifest');
        const annotations = annotationsInput ? parseAnnotations(annotationsInput) : [];
        const imagetoolsArgs = buildImagetoolsArgs(image, tags, annotations, digests);

        await exec.exec('docker', imagetoolsArgs);
        core.endGroup();

        // --- Verify manifest (optional) ---
        if (verify) {
            core.startGroup('Verify manifest');
            const firstTag = tags[0];
            let inspectOutput = '';

            await exec.exec('docker', ['buildx', 'imagetools', 'inspect', `${image}:${firstTag}`], {
                listeners: {
                    stdout: (data: Buffer) => {
                        inspectOutput += data.toString();
                    }
                }
            });

            core.info(inspectOutput);

            // Extract digest from inspect output
            const digest = extractDigest(inspectOutput);
            if (digest) {
                core.setOutput('digest', digest);
                core.info(`Multi-arch manifest digest: ${digest}`);
            } else {
                core.warning('Could not extract digest from imagetools inspect output');
            }
            core.endGroup();
        }
    } catch (error) {
        if (error instanceof Error) {
            core.setFailed(error.message);
        } else {
            core.setFailed('An unexpected error occurred');
        }
    }
}

run();
