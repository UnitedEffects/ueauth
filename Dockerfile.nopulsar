FROM node:16-alpine3.14
LABEL author="help@unitedeffects.com"
RUN mkdir /app

COPY . /app
WORKDIR /app
RUN yarn test && yarn build && yarn clean && yarn --production

EXPOSE 3000

CMD ["yarn", "start"]