# Docker Multi-Arch Manifest

A GitHub Action that downloads per-platform digest artifacts, merges them into a multi-arch manifest, and tags the image. Uses [`docker buildx imagetools create`](https://docs.docker.com/reference/cli/docker/buildx/imagetools/create/) — the modern, stable approach — rather than the legacy experimental `docker manifest` command. Designed to run after parallel platform builds from [`docker-digest-builder`](https://github.com/carry0987/docker-digest-builder).

## Usage

```yaml
- uses: carry0987/docker-multi-arch-manifest@v1
  with:
    image: ghcr.io/my-org/my-app
    tags: |
      latest
      1.0.0
```

### Full example with docker-digest-builder

```yaml
jobs:
  build:
    strategy:
      matrix:
        platform: [linux/amd64, linux/arm64]
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v6

      - uses: docker/login-action@v3
        with:
          registry: ghcr.io
          username: ${{ github.actor }}
          password: ${{ secrets.GITHUB_TOKEN }}

      - uses: carry0987/docker-digest-builder@v1
        with:
          image: ghcr.io/${{ github.repository }}
          platform: ${{ matrix.platform }}

  manifest:
    needs: build
    runs-on: ubuntu-latest
    steps:
      - uses: docker/login-action@v3
        with:
          registry: ghcr.io
          username: ${{ github.actor }}
          password: ${{ secrets.GITHUB_TOKEN }}

      - uses: carry0987/docker-multi-arch-manifest@v1
        id: manifest
        with:
          image: ghcr.io/${{ github.repository }}
          tags: |
            latest
            1.0.0
          annotations: |
            org.opencontainers.image.description=My application
            org.opencontainers.image.source=https://github.com/${{ github.repository }}
```

## Inputs

| Name | Required | Default | Description |
|------|:--------:|---------|-------------|
| `image` | Yes | — | Full image name (e.g. `ghcr.io/org/app`) |
| `tags` | Yes | — | Tags to apply (multi-line, one per line) |
| `annotations` | No | `''` | OCI annotations (multi-line `key=value`), applied at index level for GHCR metadata display |
| `artifact-pattern` | No | `digests-*` | Glob pattern for digest artifacts |
| `verify` | No | `true` | Whether to verify the manifest after creation |

## Outputs

| Name | Description |
|------|-------------|
| `digest` | The digest of the multi-arch manifest |

## How it works

1. Downloads all artifacts matching the `artifact-pattern` glob (default: `digests-*`)
2. Collects digest files from the downloaded artifacts
3. Creates a Docker Buildx builder
4. Runs `docker buildx imagetools create` to merge all per-platform digests into a single multi-arch manifest, applying the specified tags and annotations
5. Optionally verifies the manifest with `docker buildx imagetools inspect` and extracts the final digest

## Annotations

Annotations are applied at the **index level** (`index:` prefix), which means they appear on the manifest list itself rather than individual platform images. This is the correct level for GHCR to display metadata like description and source URL.

```yaml
annotations: |
  org.opencontainers.image.description=My application
  org.opencontainers.image.source=https://github.com/my-org/my-app
```

## License

[Apache-2.0](LICENSE)
