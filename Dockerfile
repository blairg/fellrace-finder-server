FROM node:12.13.0-alpine

ARG YARN_PRODUCTION=false
ARG YARN_RUNTIME=start

WORKDIR /usr/src/app

COPY . /usr/src/app

RUN yarn install --production=${YARN_PRODUCTION} && \
    if [[ ${YARN_RUNTIME} == "start" ]] ; then yarn build ; else yarn global add nodemon ; fi

EXPOSE 5555

CMD ["yarn", "start"]