FROM node:8-alpine as build

WORKDIR /tmp

COPY package*.json /tmp/api/

RUN apk update && apk add --no-cache --virtual .build-deps \
        python \
        g++ \
        make \
	git
RUN cd api && npm install
RUN apk del .build-deps


FROM node:8-alpine

RUN apk add --no-cache jq bash openssl curl

COPY . /api
COPY --from=build /var/cache/apk /var/cache/apk
COPY --from=build /tmp/api/node_modules /api/node_modules

ENV TERM=xterm-256color

WORKDIR /api

RUN npm run build

ENTRYPOINT [ "/api/docker/start-api.sh" ]
