#!/usr/bin/env bash

helm upgrade -i $APP_NAME -f ./k8s/fellrace-finder-server/values.yaml \
                          --set service.port=5555 \
                          --set image.repository=fellrace-finder-server \
                          --set image.tag=$DOCKER_TAG \
                          --set image.command=dev-server \
                          --set image.pullPolicy=IfNotPresent \
                          --set service.type=NodePort \
./k8s/fellrace-finder-server