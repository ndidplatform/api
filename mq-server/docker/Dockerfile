FROM node:8-alpine as build

WORKDIR /tmp

RUN apk update && apk add --no-cache --virtual .build-deps \
  python \
  g++ \
  make \
  git

COPY package*.json /tmp/api/mq-server/

RUN cd api/mq-server && npm install
RUN apk del .build-deps


FROM node:8-alpine
LABEL maintainer="NDID IT Team <it@ndid.co.th>"
ENV TERM=xterm-256color

# Set umask to 027
RUN umask 027 && echo "umask 0027" >> /etc/profile

COPY --from=build /var/cache/apk /var/cache/apk
RUN apk add --no-cache jq bash openssl curl && rm -rf /var/cache/apk

COPY . /api/mq-server
COPY --from=build /tmp/api/mq-server/node_modules /api/mq-server/node_modules

WORKDIR /api/mq-server

RUN npm run build && npm prune --production

# Change owner to nobodoy:nogroup and permission to 640
RUN chown -R nobody:nogroup /api/mq-server
RUN chmod -R 640 /api/mq-server

ENTRYPOINT [ "node", "/api/mq-server/build/mq_server/server.js" ]
