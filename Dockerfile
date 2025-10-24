# syntax=docker/dockerfile:1.7

FROM oven/bun:1.2-alpine AS builder
WORKDIR /opt/app-root/src

COPY package.json .
COPY bun.lock .

RUN bun install --frozen-lockfile

ADD public /opt/app-root/src/public
ADD app /opt/app-root/src/app
ADD components /opt/app-root/src/components
ADD config /opt/app-root/src/config
ADD contexts /opt/app-root/src/contexts
ADD hooks /opt/app-root/src/hooks
ADD scripts /opt/app-root/src/scripts
ADD styles /opt/app-root/src/styles
ADD lib /opt/app-root/src/lib
ADD migrations /opt/app-root/src/migrations
ADD tailwind.config.ts .
ADD middleware.js .
ADD postcss.config.mjs .
ADD tsconfig.json .
ADD components.json .
ADD next.config.mjs .

ARG NEXT_PUBLIC_SUPABASE_ANON_KEY
ARG SUPABASE_URL
ARG NEXT_PUBLIC_SUPABASE_URL
ARG SUPABASE_SERVICE_ROLE_KEY
ARG NEXT_PUBLIC_SITE_URL
ARG GOOGLE_CLIENT_ID
ARG GOOGLE_CLIENT_SECRET
ARG NEXT_PUBLIC_DEV_SUPABASE_REDIRECT_URL
ARG NODE_ENV=production
ARG NEXT_TELEMETRY_DISABLED=1

RUN bun run build

FROM oven/bun:1.2-distroless

WORKDIR /opt/app-root/src

COPY --from=builder --chown=nonroot --chmod=755 /opt/app-root/src/.next/cache ./.next/cache
COPY --from=builder --chown=root --chmod=005 /opt/app-root/src/.next/standalone ./
COPY --from=builder --chown=root --chmod=005 /opt/app-root/src/.next/static ./.next/static
COPY --from=builder --chown=root --chmod=005 /opt/app-root/src/public ./public
COPY --from=builder --chown=root --chmod=005 /opt/app-root/src/migrations ./migrations

ENV NODE_ENV=production

EXPOSE 3000

ENV HOSTNAME="0.0.0.0"
CMD ["server.js"]
