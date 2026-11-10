# syntax=docker/dockerfile:1
#
# Runtime image for the Dellorto Jetting Calculator: a static web app served
# by unprivileged nginx (port 8080, user 101). The app has no build step, so
# there is no build stage either — the image contains only nginx plus the
# files the browser loads (plus LICENSE, required for GPL-2.0 distribution).
# Published to ghcr.io by .github/workflows/docker.yml; usage: README,
# section "Docker".

FROM nginxinc/nginx-unprivileged:1.29-alpine-slim

LABEL org.opencontainers.image.title="Dellorto Jetting Calculator" \
      org.opencontainers.image.description="Jetting calculator for Dellorto carburetors (static PWA served by nginx)" \
      org.opencontainers.image.licenses="GPL-2.0-only"

# Drop the base image's sample pages so only the app is served.
USER root
RUN rm -f /usr/share/nginx/html/*
USER 101

COPY docker/nginx.conf /etc/nginx/conf.d/default.conf

# Keep in sync with what the app loads at runtime (sw.js PRECACHE_URLS);
# test/docker.test.mjs checks that every precached file is copied here.
COPY index.html manifest.json sw.js LICENSE /usr/share/nginx/html/
COPY css/   /usr/share/nginx/html/css/
COPY js/    /usr/share/nginx/html/js/
COPY icons/ /usr/share/nginx/html/icons/

EXPOSE 8080

HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget -q -O /dev/null http://127.0.0.1:8080/healthz || exit 1
