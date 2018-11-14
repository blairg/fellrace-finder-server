FROM node:10.13.0-alpine

ARG YARN_PRODUCTION=false
ARG YARN_RUNTIME=start

ADD ./docker-config/nginxErrorPages/ /var/lib/nginx/html

RUN apk update && \
    apk add nginx python python-dev py-pip supervisor && \
    adduser -D -g 'www' www && \
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