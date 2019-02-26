#!/usr/bin/env bash

echo "Checking Helm is installed"
if [[ $((helm) 2>&1 | grep "command not found" ) ]]; then
    echo "You must install Helm. https://github.com/helm/helm/blob/master/docs/install.md"
    exit 1
fi

# echo "Checking Kubernetes is installed with Docker for Mac"
# if [[ $((kubectl config use-context docker-for-desktop) 2>&1 | grep "error" ) ]]; then
#     echo "This deployment requires Kubernetes running with Docker for Mac"
#     exit 1
# else
#     echo "Kubernetes is installed with Docker For Desktop. Yaay!!!"
# fi

# echo "Setting context as docker-for-desktop"
# kubectl config use-context docker-for-desktop

export KUBECONFIG=~/Downloads/bgtest-cluster-kubeconfig.yaml



echo "Installing Kubernetes Dashboard"
mkdir $HOME/certs
kubectl create secret generic kubernetes-dashboard-certs --from-file=$HOME/certs -n kube-system
kubectl apply -f https://raw.githubusercontent.com/kubernetes/dashboard/v1.10.1/src/deploy/recommended/kubernetes-dashboard.yaml

echo "Installing Helm"
bash ./k8s/scripts/start_helm.sh

# Update Helm repo
helm repo update

echo "Setting App Name and Namespace"
export NAMESPACE=fellrace-finder
export APP_NAME=dev-fellrace-finder-server

echo "Installing Namespace"
bash ./k8s/scripts/install_namespace.sh

#echo "Installing Redis with Helm"
# bash ./k8s/scripts/helm_install_redis.sh

# echo "Installing Promethus with Helm"
# bash ./k8s/scripts/helm_install_promethus.sh

# echo "Installing Jaeger"
# bash ./k8s/scripts/install_jaeger.sh

source .env

export REPOSITORY=blairguk/fellrace-finder-server
export SERVICE_TYPE=NodePort
export DOCKER_TAG=latest

echo "Installing $REPOSITORY App with Helm"
bash ./k8s/scripts/helm_install_fellrace_finder_server.sh


# echo "Checking if the pods are ready"
# bash ./k8s/scripts/check_pod_readiness.sh

# echo "To test Fell Race Finder Server locally hit this in your browser - http://localhost:5555"

# kubectl port-forward svc/$APP_NAME -n $NAMESPACE 5555:5555

export KUBECONFIG=~/.kube/config