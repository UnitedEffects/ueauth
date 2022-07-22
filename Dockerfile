FROM node:16-alpine3.14
LABEL author="help@unitedeffects.com"
RUN mkdir /app

COPY . /app
WORKDIR /app

RUN apk update && apk add --no-cache \
	-X https://dl-cdn.alpinelinux.org/alpine/edge/main \
	-X https://dl-cdn.alpinelinux.org/alpine/edge/community \
	-X https://dl-cdn.alpinelinux.org/alpine/edge/testing \
	pulsar-client-cpp-dev py3-pulsar-client-cpp py3-six py3-certifi make g++ python3

RUN yarn test && yarn build && yarn clean && yarn --production

EXPOSE 3000

CMD ["yarn", "start"]