FROM node:8-alpine as build

WORKDIR /tmp

RUN apk update && apk add --no-cache --virtual .build-deps \
  python \
  g++ \
  make \
  git

COPY ./ndid-logger/package*.json /tmp/api/ndid-logger/
COPY ./main-server/package*.json /tmp/api/main-server/

RUN cd api/ndid-logger && npm install
RUN cd api/main-server && npm install
RUN apk del .build-deps


FROM node:8-alpine
LABEL maintainer="NDID IT Team <it@ndid.co.th>"
ENV TERM=xterm-256color

# Set umask to 027
RUN umask 027 && echo "umask 0027" >> /etc/profile

COPY --from=build /var/cache/apk /var/cache/apk
RUN apk add --no-cache jq bash openssl curl && rm -rf /var/cache/apk

COPY ./ndid-error /api/ndid-error

COPY ./ndid-logger /api/ndid-logger
COPY --from=build /tmp/api/ndid-logger/node_modules /api/ndid-logger/node_modules

WORKDIR /api/ndid-logger

RUN npm prune --production

COPY ./main-server /api/main-server
COPY --from=build /tmp/api/main-server/node_modules /api/main-server/node_modules

WORKDIR /api/main-server

RUN npm run build && npm prune --production

COPY ./protos /api/protos
COPY COPYING /api/
COPY VERSION /api/

COPY ./docker/start-api.sh /api/docker/

# Change owner to nobodoy:nogroup and permission to 640
RUN chown -R nobody:nogroup /api
RUN chmod -R 640 /api
RUN chmod -R 740 /api/docker/start-api.sh

ENTRYPOINT [ "/api/docker/start-api.sh" ]
