#!/usr/bin/env bash

# set up helm
helm init --service-account tiller

kubectl apply -f ./k8s/config/infrastructure.yaml

# Tiller running
counter=0

until kubectl get pods -n kube-system | grep "tiller" | grep -q "Running"; do
    echo "Waiting for tiller (Helm) to initialise  - try ${counter}"
    sleep 2

    if [[ "$counter" -gt 120 ]]; then
        echo "Helm taking longer than 2 minutes to start up"
        exit 1
    fi

    counter=$((counter+1))
done

echo "Tiller is running"

# Tiller ready
counter=0

until helm status 2> >(grep Error) | grep "release name"; do
    echo "Waiting for tiller (Helm) to become ready  - try ${counter}"
    sleep 2

    if [[ "$counter" -gt 120 ]]; then
        echo "Helm is taking to long to become ready"
        exit 1
    fi

    counter=$((counter+1))
done

echo "Tiller is ready"