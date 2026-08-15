#!/bin/sh
set -e

# Process nginx template, only substitute variables present in the environment,
# leaving nginx's own $variable syntax untouched.
mkdir -p /etc/nginx/conf.d
# nginx creates only the last path segment of proxy_cache_path, so the parent
# has to exist before it starts.
mkdir -p /var/cache/nginx
defined_envs=$(printf '${%s} ' $(env | cut -d= -f1))
envsubst "$defined_envs" \
    < /etc/nginx/templates/default.conf.template \
    > /etc/nginx/conf.d/default.conf

exec "$@"
