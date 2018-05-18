FROM node:8.11.1-slim

ENV TERM=xterm-256color
ENV CGO_ENABLED=0
WORKDIR /ndidplatform/api
COPY src ./src
COPY devKey ./devKey
COPY package*.json ./
COPY .* ./

RUN npm install
ENTRYPOINT [ "npm","start" ]