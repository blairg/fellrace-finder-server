#!/usr/bin/env bash

source .env
echo "Mongo URL is -> $MONGO_URL"
# echo $MONGO_URL | base64 --decode
# MONGO_URL=$(echo $MONGO_URL | base64 --decode)

helm upgrade -i $APP_NAME -f ./k8s/fellrace-finder-server/values.yaml \
                          --set service.port=5555 \
                          --set image.repository=$REPOSITORY \
                          --set image.tag=$DOCKER_TAG \
                          --set image.command=dev-server \
                          --set image.pullPolicy=IfNotPresent \
                          --set service.type=$SERVICE_TYPE \
                          --set environment.mongo_url=$MONGO_URL \
./k8s/fellrace-finder-server