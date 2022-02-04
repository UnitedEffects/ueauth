FROM node:16-alpine
LABEL author="borzou@theboeffect.com"
RUN mkdir /app

COPY . /app
WORKDIR /app
RUN yarn test && yarn build && yarn clean && yarn --production

EXPOSE 3000

CMD ["yarn", "start"]