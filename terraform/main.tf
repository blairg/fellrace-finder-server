# Google Cloud Storage Backend
terraform {
  backend "gcs" {
    bucket  = "fellrace-finder-server"
    prefix  = "terraform/state"
    credentials = "gcsauth.json"
  }
}

# Create a Digital Ocean Kubernetes Cluster
module "do-cluster" {
  source = "./do-cluster"

  do_token = "${var.do_token}"
}

# Install Helm and Fellrace-Finder-Server app
module "deploy-app" {
  source = "./deploy-app"
  
  cluster_host = "${module.do-cluster.cluster_host}"
  cluster_client_certificate = "${module.do-cluster.cluster_client_certificate}"
  cluster_client_key = "${module.do-cluster.cluster_client_key}"
  cluster_ca_certificate = "${module.do-cluster.cluster_ca_certificate}"
  cluster_config="${module.do-cluster.cluster_config}"
  mongo_url="${var.mongo_url}"
}