FROM node:8-alpine as build

WORKDIR /tmp

RUN apk update && apk add --no-cache --virtual .build-deps \
  python \
  g++ \
  make \
  git

COPY package*.json /tmp/api/main-server/

RUN cd api && npm install
RUN apk del .build-deps


FROM node:8-alpine
LABEL maintainer="NDID IT Team <it@ndid.co.th>"
ENV TERM=xterm-256color

# Set umask to 027
RUN umask 027 && echo "umask 0027" >> /etc/profile

COPY --from=build /var/cache/apk /var/cache/apk
RUN apk add --no-cache jq bash openssl curl && rm -rf /var/cache/apk

COPY . /api
COPY --from=build /tmp/api/main-server/node_modules /api/main-server/node_modules

WORKDIR /api/main-server

RUN npm run build && npm prune --production

# Change owner to nobodoy:nogroup and permission to 640
RUN chown -R nobody:nogroup /api/main-server
RUN chmod -R 640 /api/main-server
RUN chmod -R 740 /api/main-server/docker/start-api.sh

ENTRYPOINT [ "/api/main-server/docker/start-api.sh" ]
