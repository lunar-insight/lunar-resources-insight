#!/bin/sh
set -e

# Process nginx template, only substitute variables present in the environment,
# leaving nginx's own $variable syntax untouched.
mkdir -p /etc/nginx/conf.d
defined_envs=$(printf '${%s} ' $(env | cut -d= -f1))
envsubst "$defined_envs" \
    < /etc/nginx/templates/default.conf.template \
    > /etc/nginx/conf.d/default.conf

exec "$@"
