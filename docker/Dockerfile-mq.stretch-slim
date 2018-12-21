FROM node:10-stretch-slim as build

WORKDIR /tmp

RUN apt-get update && apt-get install -y \
  python \
  g++ \
  make \
  git \
  --no-install-recommends && rm -r /var/lib/apt/lists/*

COPY ./ndid-logger/package*.json /tmp/api/ndid-logger/
COPY ./mq-server/package*.json /tmp/api/mq-server/

RUN cd api/ndid-logger && npm install
RUN cd api/mq-server && npm install


FROM node:10-stretch-slim
LABEL maintainer="NDID IT Team <it@ndid.co.th>"
ENV TERM=xterm-256color

# Set umask to 027
RUN umask 027 && echo "umask 0027" >> /etc/profile

RUN apt-get update && apt-get install -y \
  jq \
  openssl \
  curl \
  --no-install-recommends && rm -r /var/lib/apt/lists/*

COPY ./ndid-error /api/ndid-error

COPY ./ndid-logger /api/ndid-logger
COPY --from=build /tmp/api/ndid-logger/node_modules /api/ndid-logger/node_modules

WORKDIR /api/ndid-logger

RUN npm prune --production

COPY ./mq-server /api/mq-server
COPY --from=build /tmp/api/mq-server/node_modules /api/mq-server/node_modules

WORKDIR /api/mq-server

RUN npm run build && npm prune --production

COPY ./protos /api/protos
COPY COPYING /api/
COPY VERSION /api/

# Change owner to nobodoy:nogroup and permission to 640
RUN chown -R nobody:nogroup /api
RUN chmod -R 640 /api

ENTRYPOINT [ "node", "/api/mq-server/build/server.js" ]
