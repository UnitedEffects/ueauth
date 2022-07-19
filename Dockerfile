FROM node:16-alpine3.14
LABEL author="team@unitedeffects.com"
RUN mkdir /app

COPY . /app
WORKDIR /app
ARG PULSAR_VERSION=2.9.1
RUN apk update && apk add python3 make g++ dpkg git --no-cache && \
    wget --no-check-certificate --user-agent=Mozilla -O apache-pulsar-client-dev.deb "https://archive.apache.org/dist/pulsar/pulsar-$PULSAR_VERSION/DEB/apache-pulsar-client-dev.deb" && \
    wget --no-check-certificate --user-agent=Mozilla -O apache-pulsar-client.deb "https://archive.apache.org/dist/pulsar/pulsar-$PULSAR_VERSION/DEB/apache-pulsar-client.deb" && \
    dpkg --force-architecture -i apache-pulsar-client*.deb
RUN yarn test && yarn build && yarn clean && yarn --production

EXPOSE 3000

CMD ["yarn", "start"]