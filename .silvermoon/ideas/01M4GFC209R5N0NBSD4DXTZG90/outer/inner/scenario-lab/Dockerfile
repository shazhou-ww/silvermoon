FROM node:24-trixie-slim

RUN apt-get -o Acquire::Retries=5 update \
    && apt-get -o Acquire::Retries=5 install --yes --no-install-recommends ca-certificates git \
    && rm -rf /var/lib/apt/lists/* \
    && corepack enable \
    && corepack prepare pnpm@11.22.0 --activate

ARG SOURCE_REVISION=unknown
ARG SOURCE_DIRTY=unknown
ENV HOME=/home/scenario-device
ENV PATH=/home/scenario-device/.npm-global/bin:${PATH}
ENV SCENARIO_SOURCE_REVISION=${SOURCE_REVISION}
ENV SCENARIO_SOURCE_DIRTY=${SOURCE_DIRTY}

RUN useradd --create-home --uid 10001 scenario-device \
    && mkdir --parents /checkout /workspace \
    && chown --recursive scenario-device:scenario-device /checkout /workspace /home/scenario-device

USER scenario-device
WORKDIR /checkout

COPY --chown=scenario-device:scenario-device package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig.base.json tsconfig.json tsconfig.build.json /checkout/
RUN npm config set prefix "${HOME}/.npm-global" \
    && pnpm install --frozen-lockfile

COPY --chown=scenario-device:scenario-device bin /checkout/bin
COPY --chown=scenario-device:scenario-device tools /checkout/tools
COPY --chown=scenario-device:scenario-device src /checkout/src
COPY --chown=scenario-device:scenario-device skills /checkout/skills
COPY --chown=scenario-device:scenario-device schema /checkout/schema
COPY --chown=scenario-device:scenario-device .silvermoon /checkout/.silvermoon
COPY --chown=scenario-device:scenario-device .silvermoon/ideas/01M4GFC209R5N0NBSD4DXTZG90/outer/inner/scenario-lab/source.bundle /scenario-source.bundle

ENTRYPOINT ["bash", "/scenario-lab/run-container.sh"]
