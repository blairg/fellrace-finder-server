#!/usr/bin/env bash

helm repo add coreos https://s3-eu-west-1.amazonaws.com/coreos-charts/stable/
helm install coreos/prometheus-operator --name prometheus-operator
helm install coreos/kube-prometheus --name kube-prometheus --set global.rbacEnable=true

# kubectl apply -f ./kubernetes/config/service-monitor.yml


# kubectl port-forward prometheus-kube-prometheus-0 9090

# kubectl port-forward $(kubectl get pods --selector=app=kube-prometheus-grafana --output=jsonpath="{.items..metadata.name}")  3000

# Grafana is admin:admin