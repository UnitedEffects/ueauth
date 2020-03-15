FROM mhart/alpine-node
LABEL author="borzou@theboeffect.com"
RUN mkdir /app

COPY . /app
WORKDIR /app
RUN yarn --production

EXPOSE 3000

CMD ["yarn", "start"]