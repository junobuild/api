# use the official Bun image
# see all versions at https://hub.docker.com/r/oven/bun/tags
FROM oven/bun:1 AS base
WORKDIR /usr/src/app

# install dependencies into temp directory
# this will cache them and speed up future builds
FROM base AS install
RUN mkdir -p /temp/dev
COPY package.json bun.lock /temp/dev/
RUN cd /temp/dev && bun install --frozen-lockfile

# install with --production (exclude devDependencies)
RUN mkdir -p /temp/prod
COPY package.json bun.lock /temp/prod/
RUN cd /temp/prod && bun install --frozen-lockfile --production

# copy node_modules from temp directory
# then copy all (non-ignored) project files into the image
FROM base AS prerelease
COPY --from=install /temp/dev/node_modules node_modules

# copy required resources
COPY src src
COPY test test
COPY biome.json biome.json
COPY bunfig.toml bunfig.toml
COPY package.json package.json
COPY test-setup.ts test-setup.ts
COPY tsconfig.json tsconfig.json
COPY package.json package.json

# tests & build
ENV NODE_ENV=production
RUN bun run build

# build final image
FROM base AS release

RUN DEBIAN_FRONTEND=noninteractive apt update && apt install -y \
    openssl \
    && rm -rf /var/lib/apt/lists/*

COPY --from=install /temp/prod/node_modules node_modules
COPY --from=prerelease /usr/src/app/build/server .

# Add entrypoint script
COPY entrypoint.sh .
RUN chmod +x entrypoint.sh

# Prepare folder for generating the keys on start
RUN mkdir -p /usr/src/app/keys && chown -R bun:bun /usr/src/app/keys

# run the app
USER bun
EXPOSE 3000/tcp

CMD ["./entrypoint.sh"]