FROM node:16-alpine
LABEL author="team@unitedeffects.com"
RUN mkdir /app

COPY . /app
WORKDIR /app
RUN apk update && apk add make g++ dpkg wget git --no-cache && \
    wget --no-check-certificate --user-agent=Mozilla -O apache-pulsar-client-dev.deb "https://archive.apache.org/dist/pulsar/pulsar-2.4.2/DEB/apache-pulsar-client-dev.deb" && \
    wget --no-check-certificate --user-agent=Mozilla -O apache-pulsar-client.deb "https://archive.apache.org/dist/pulsar/pulsar-2.4.2/DEB/apache-pulsar-client.deb" && \
    dpkg --force-architecture -i apache-pulsar-client*.deb


RUN yarn test && yarn build && yarn clean && yarn --production

EXPOSE 3000

CMD ["yarn", "start"]