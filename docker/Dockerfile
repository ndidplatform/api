FROM node:12-alpine3.11 as build

WORKDIR /tmp

RUN sed -i -e 's/http:/https:/' /etc/apk/repositories

RUN apk update && apk add --no-cache --virtual .build-deps \
  python \
  g++ \
  make \
  git

COPY ./ndid-logger/package*.json /tmp/api/ndid-logger/
COPY ./main-server/package*.json /tmp/api/main-server/

WORKDIR /tmp/api/ndid-logger
RUN npm install && npm prune --production

WORKDIR /tmp/api/main-server
RUN npm install

COPY ./ndid-error /tmp/api/ndid-error
COPY ./ndid-logger /tmp/api/ndid-logger
COPY ./main-server /tmp/api/main-server

RUN npm run build && npm prune --production

RUN apk del .build-deps


FROM node:12-alpine3.11
LABEL maintainer="NDID IT Team <it@ndid.co.th>"

# Directory path for persistence data files
ENV DATA_DIRECTORY_PATH=/api/data

# Set umask to 027
RUN umask 027 && echo "umask 0027" >> /etc/profile

RUN sed -i -e 's/http:/https:/' /etc/apk/repositories
COPY --from=build /var/cache/apk /var/cache/apk
RUN apk add --no-cache bash openssl && rm -rf /var/cache/apk

COPY --from=build /tmp/api/ndid-error /api/ndid-error
COPY --from=build /tmp/api/ndid-logger /api/ndid-logger
COPY --from=build /tmp/api/main-server /api/main-server

COPY ./protos /api/protos
COPY ./dev_cert /api/dev_cert
COPY COPYING /api/main-server/build
COPY VERSION /api/

COPY docker/docker-entrypoint.sh /usr/bin/docker-entrypoint.sh

WORKDIR /api/main-server

ENTRYPOINT [ "/usr/bin/docker-entrypoint.sh", "node", "/api/main-server/build/server.js" ]
