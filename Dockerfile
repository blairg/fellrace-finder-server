FROM node:10.5.0-alpine

ARG YARN_PRODUCTION=false
ARG YARN_RUNTIME=start

# RUN echo "http://dl-cdn.alpinelinux.org/alpine/edge/testing" > /etc/apk/repositories && \
#     echo "http://dl-cdn.alpinelinux.org/alpine/edge/community" >> /etc/apk/repositories && \
#     echo "http://dl-cdn.alpinelinux.org/alpine/edge/main" >> /etc/apk/repositories && \
RUN apk update && \
    apk add nginx python python-dev py-pip supervisor

RUN adduser -D -g 'www' www && \
    mkdir /www && \
    mkdir -p /run/nginx/ && \
    touch /run/nginx/nginx.pid && \
    chown -R www:www /run/nginx && \
    chown -R www:www /var/lib/nginx && \
    chown -R www:www /www

COPY ./docker-config/nginx.conf /etc/nginx/nginx.conf
COPY ./docker-config/supervisord.conf /etc/supervisor/conf.d/supervisord.conf

WORKDIR /usr/src/app

COPY . /usr/src/app

RUN yarn install --production=${YARN_PRODUCTION} && \
    if [[ ${YARN_RUNTIME} == "start" ]] ; then yarn build ; else yarn global add nodemon ; fi

EXPOSE 80

CMD ["/usr/bin/supervisord", "-c", "/etc/supervisor/conf.d/supervisord.conf"]