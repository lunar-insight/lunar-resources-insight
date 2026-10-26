# syntax=docker/dockerfile:1

# Stage 1: build
FROM node:24.22.0-alpine@sha256:44fce696f38ba8c987c4db89954051000bbd05ffd8d8659ba15ed4a8602e937f AS builder
WORKDIR /app

COPY package*.json .npmrc ./
RUN npm ci
RUN npm audit signatures
RUN npm audit --audit-level=high

COPY . .
RUN node scripts/check-dependencies.cjs
RUN --network=none node scripts/check-hardening.cjs
RUN --network=none node --test "scripts/tests/*.test.cjs"
RUN --network=none ./node_modules/.bin/vitest run
RUN --network=none npm run build
RUN --network=none node scripts/check-bundle-hosts.cjs dist

# Stage 2: serve
FROM openresty/openresty:1.31.1.1-4-alpine@sha256:52ff9a6e337bd0138745c73cdfeb5aaa0e783e29eeec0695eec6971c1231f3bd AS server
COPY --from=builder /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf

RUN chown -R nobody:nobody /usr/share/nginx/html && \
    chmod -R 755 /usr/share/nginx/html

EXPOSE 80
CMD ["openresty", "-g", "daemon off;"]
